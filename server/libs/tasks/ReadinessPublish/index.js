/**
 * Readiness 发布任务：问卷确认后，把题目写入「新 AI 面试」并开启数据采集项目。
 * input.params = { kind, roleName, language, deadline, digitalId, questionnaireVersion, questionnaire, interview }
 *
 * 步骤（调用 AI 面试 open-api/admin，均按「题目 / 数字人」幂等，失败可直接重试）：
 *   1. 校验确认时选定的数字人确实分配给了该客户
 *   2. 添加问题：访谈题逐个建成题库问题（数据采集场景，已存在则复用）；无访谈题则跳过
 *   3. 转数字人：有访谈题时轮询直到全部 existed；无访谈题则跳过
 *   4. 添加项目：数据采集类型；配置问卷 schema；有题则配题；直接开启
 *      （仅问卷、无访谈题时依赖 AI 面试侧允许「空题库 + 有效问卷」开项目）
 * 返回值即阶段输出，发送阶段据此取 projectId 与截止日期。
 */
const { buildProjectName, deadlineEndTime, buildInterviewQuestions, buildQuestionnaireSchema, digitalsOf } = require('../../utils/readiness-publish');

const DEFAULT_POLL_INTERVAL = 8 * 1000;
const DEFAULT_TIMEOUT = 20 * 60 * 1000;
// 同一题目反复进入 created，说明数字人生成任务失败了，不能无限重建
const MAX_RECREATE = 2;
const PROJECT_MAX_COUNT = 1000;

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

const runner = async (fastify, options, { task, log }) => {
  const { params = {}, tenantId } = task.input || {};
  const { kind, roleName, language, deadline, digitalId, questionnaireVersion, questionnaire, interview } = params;
  // 任务 runner 的 options.name 是任务插件自己的命名空间，业务服务统一挂在 fastify.project 下
  const { services } = fastify.project;
  const pollInterval = Number(fastify.config.READINESS_PUBLISH_POLL_INTERVAL) || DEFAULT_POLL_INTERVAL;
  const timeout = Number(fastify.config.READINESS_PUBLISH_TIMEOUT) || DEFAULT_TIMEOUT;

  const step = async (message, data) => log({ message, data });
  const fail = async message => {
    await step('发布失败', { error: message });
    throw new Error(message);
  };

  if (!tenantId || !deadline || !roleName) {
    await fail('发布任务缺少 tenantId / roleName / deadline');
  }

  const setting = await services.talentReviewSetting.detail({ tenantId });
  const clientId = setting.clientId;
  if (!clientId) {
    await fail('AI面试设置中缺少客户信息，请在 AI面试设置里重新保存连接');
  }
  await step('读取 AI 面试连接', { apiUrl: setting.url, clientId });

  const digitals = await services.aiInterview.adminListDigitals({ tenantId, clientId });
  if (!digitalId) {
    await fail('确认问卷时没有选择数字人，请回退到“确认问卷”重新确认');
  }
  const digital = digitalsOf(digitals?.pageData).find(item => item.id === String(digitalId));
  if (!digital) {
    await fail('所选数字人未分配给该 AI 面试客户或已停用，请回退到“确认问卷”重新选择');
  }
  await step('使用数字人', { digitalId, name: digital.name, language: digital.language });

  const questions = buildInterviewQuestions({ interview, language });
  const questionnaireSchema = buildQuestionnaireSchema({ questionnaire, language });
  const questionnaireFieldCount = (questionnaireSchema.blocks || []).reduce((sum, block) => sum + (block.list || []).length, 0);
  if (!questions.length && questionnaireFieldCount === 0) {
    await fail('问卷没有访谈题也没有问卷题，无法创建数据采集项目');
  }

  const questionMap = [];
  for (const item of questions) {
    const created = await services.aiInterview.adminCreateQuestion({ tenantId, body: item.body });
    questionMap.push({ no: item.no, questionId: String(created.id), existed: !!created.existed });
    await step('添加问题', { no: item.no, questionId: String(created.id), existed: !!created.existed, title: item.body.title });
  }
  const questionIds = questionMap.map(item => item.questionId);

  if (!questionIds.length) {
    await step('无访谈题，跳过建题与转数字人（仅问卷项目）', { questionnaireFieldCount });
  } else {
    const recreated = new Map();
    const startedAt = Date.now();
    // 首次调用带 forceRetry：重试发布时清掉 AI 面试侧上次 failed，重新建任务；轮询期间不再强制重建
    let forceRetry = true;
    for (;;) {
      const results = await services.aiInterview.adminGenerateDigital({
        tenantId,
        digitalIds: [digitalId],
        questionIds,
        forceRetry
      });
      forceRetry = false;
      const failed = (results || []).filter(item => item.status === 'failed');
      if (failed.length) {
        const detail = failed.map(item => `${item.questionId}: ${item.error || '转数字人失败'}`).join('；');
        await fail(`题目转数字人失败：${detail}`);
      }
      const pending = (results || []).filter(item => item.status !== 'existed');
      if (!pending.length) {
        await step('题目已全部转为数字人', { count: questionIds.length });
        break;
      }
      pending.forEach(item => {
        if (item.status === 'created') {
          recreated.set(item.questionId, (recreated.get(item.questionId) || 0) + 1);
        }
      });
      const broken = [...recreated.entries()].find(([, times]) => times > MAX_RECREATE);
      if (broken) {
        await fail(`题目 ${broken[0]} 转数字人多次失败，请到 AI 面试后台检查数字人与题目`);
      }
      await step('等待转数字人', {
        pending: pending.map(item => ({ questionId: item.questionId, status: item.status, error: item.error || null }))
      });
      if (Date.now() - startedAt > timeout) {
        await fail(`转数字人超过 ${Math.round(timeout / 60000)} 分钟仍未完成，请稍后重试`);
      }
      await sleep(pollInterval);
    }
  }

  const name = buildProjectName(roleName);
  const body = {
    name,
    clientId: String(clientId),
    digitalId,
    scene: 'dataCollection',
    language,
    status: 'open',
    questionIds,
    startTime: new Date().toISOString(),
    endTime: deadlineEndTime(deadline),
    maxCount: PROJECT_MAX_COUNT,
    description: `Readiness / ${kind} / ${roleName}`,
    setting: { questionnaire: { enabled: true, timing: 'before', schema: questionnaireSchema } }
  };
  await step('创建项目', { name, deadline, questionCount: questionIds.length, questionnaireCount: questionnaireFieldCount });
  const project = await services.aiInterview.adminCreateProject({ tenantId, body });
  if (!project?.id) {
    await fail('AI 面试创建项目未返回项目 ID');
  }
  await step('项目已开启', { projectId: String(project.id), name });

  return {
    kind,
    projectId: String(project.id),
    projectName: name,
    clientId: String(clientId),
    digitalId,
    deadline,
    questionnaireVersion: questionnaireVersion ?? null,
    questions: questionMap,
    questionnaireFields: body.setting.questionnaire.schema.blocks.flatMap(block => block.list.map(field => field.name))
  };
};

module.exports = runner;
