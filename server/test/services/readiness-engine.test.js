/**
 * Readiness 引擎集成测试：真实的 Readiness runner + readiness service + 真实模型定义（sqlite 内存库），
 * 上游用本地假 HTTP 服务代替，回调由测试用例按 task 投递（等价于上游 POST /task/callback）。
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const Fastify = require('fastify');
const fp = require('fastify-plugin');
const { Sequelize, DataTypes } = require('sequelize');
const runner = require('../../libs/tasks/Readiness');
const publishRunner = require('../../libs/tasks/ReadinessPublish');
const roleApplyRunner = require('../../libs/tasks/ReadinessRoleApply');
// 视频转写调用阿里云：测试里替换为固定结果（须在加载任务 runner 之前）
require('../../libs/utils/ali-filetrans-asr').transcribeFileLink = async () => ({ text: '我负责迁移', statusText: 'SUCCESS' });
const videoRunner = require('../../libs/tasks/invite-video-asr');
const readinessService = require('../../libs/services/readiness');
const readinessConfirmService = require('../../libs/services/readinessConfirm');
const readinessSendService = require('../../libs/services/readinessSend');

const DEADLINE = new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString().slice(0, 10);

const RESULTS = {
  '/role/draft': { result: { tasks: [{ task_id: 't1', task: '写代码' }] } },
  '/role/question/manager': {
    result: {
      questionnaire: [
        {
          no: 'Q01',
          type: 'single',
          question: 'q',
          options: [
            { label: '是', value: 'A' },
            { label: '否', value: 'B' }
          ],
          module: '基础'
        },
        {
          no: 'Q02',
          type: 'multiple',
          question: 'q2',
          options: [
            { label: '甲', value: 'A' },
            { label: '乙', value: 'B' }
          ],
          module: '基础',
          show_if: { no: 'Q01', op: 'in', values: ['A'] }
        }
      ],
      interview: [{ no: 'I01', type: 'video', question: '访谈题', design: '了解岗位', options: [{ label: '追问一' }] }]
    }
  },
  '/role/revise': { result: { tasks: [{ task_id: 't1', task: '写代码' }] } },
  '/role/question/staff': {
    result: {
      questionnaire: [
        {
          no: 'S01',
          type: 'single',
          question: 's',
          options: [
            { label: '是', value: 'A' },
            { label: '否', value: 'B' }
          ],
          module: '基础'
        }
      ],
      interview: [{ no: 'I01', type: 'video', question: '员工访谈', design: '了解工作', options: [] }]
    }
  },
  '/role/recall': { result: { external: [{ source: 'web' }] } },
  '/role/skills': { result: { skills: [] } },
  '/role/forecast': { result: { tasks: [{ task_id: 't1' }] } },
  '/role/report': { result: { report: 'ok' } },
  '/person/assess': { result: { profile_completion_pct: 50 } },
  '/person/question/reassess': {
    result: {
      questionnaire: [
        {
          no: 'R01',
          type: 'single',
          question: 'r',
          options: [
            { label: '是', value: 'A' },
            { label: '否', value: 'B' }
          ],
          module: '补卷'
        }
      ],
      interview: [{ no: 'I01', type: 'video', question: '补充访谈', design: '补充', options: [] }]
    }
  },
  '/person/assess/update': { result: { profile_completion_pct: 90 } },
  '/person/claims': { result: { internal: [{ claim: 'c1' }] } },
  '/person/report': { result: { report: 'p' } }
};

const createHarness = async ({ failPaths = [], responseByPath = {} } = {}) => {
  // ---- 假上游 ----
  const received = [];
  const upstream = http.createServer((req, res) => {
    let raw = '';
    req.on('data', chunk => (raw += chunk));
    req.on('end', () => {
      received.push({ path: req.url, body: JSON.parse(raw || '{}') });
      if (failPaths.includes(req.url)) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ detail: 'boom' }));
        return;
      }
      const custom = responseByPath[req.url];
      if (custom) {
        res.writeHead(custom.status || 200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(custom.body != null ? custom.body : { accepted: true }));
        return;
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ accepted: true }));
    });
  });
  await new Promise(resolve => upstream.listen(0, '127.0.0.1', resolve));

  // ---- sqlite 内存库 + 真实模型定义 ----
  const sequelize = new Sequelize({ dialect: 'sqlite', storage: ':memory:', logging: false });
  const Types = new Proxy(DataTypes, { get: (target, key) => (key === 'JSONB' ? target.JSON : target[key]) });
  const models = {};
  models.tenant = sequelize.define('tenant', { name: DataTypes.STRING });
  models.position = sequelize.define('position', {
    name: DataTypes.STRING,
    description: DataTypes.TEXT,
    requirement: DataTypes.TEXT,
    language: DataTypes.STRING,
    tenantId: DataTypes.INTEGER,
    assessmentStatus: { type: DataTypes.STRING(32), allowNull: false, defaultValue: 'pending' }
  });
  models.employee = sequelize.define('employee', { name: DataTypes.STRING, email: DataTypes.STRING, tenantUserId: DataTypes.STRING, tenantId: DataTypes.INTEGER });
  models.tenantUser = sequelize.define('tenantUser', { name: DataTypes.STRING, email: DataTypes.STRING, tenantId: DataTypes.INTEGER });
  const modelOptions = {
    getTenantModels: () => ({ tenant: models.tenant })
  };
  const defs = ['readinessRun', 'readinessRunPerson', 'readinessStageData', 'readinessInvite', 'readinessSendBatch'].map(name => {
    const def = require(`../../libs/models/${name}`)({ DataTypes: Types, definePrimaryType: (field, opts) => Object.assign({ type: DataTypes.BIGINT }, opts), options: modelOptions });
    models[name] = sequelize.define(name, def.model, Object.assign({ underscored: true, paranoid: true }, def.options));
    return { name, def };
  });
  defs.forEach(({ def }) => def.associate && def.associate(models));
  await sequelize.sync();

  // ---- fastify + 假 task 服务（执行真实 runner；回调由测试投递） ----
  const fastify = Fastify();
  fastify.decorate('sequelize', sequelize);
  fastify.decorate('config', {
    READINESS_API_URL: `http://127.0.0.1:${upstream.address().port}`,
    ORIGIN: 'http://192.168.1.10:3040',
    READINESS_COMPLETION_THRESHOLD: 80,
    READINESS_PUBLISH_POLL_INTERVAL: 5,
    ALI_ASR_APP_KEY: 'test-app-key'
  });
  fastify.decorate('tenant', { models: { user: models.tenantUser } });
  fastify.decorate('fileManager', { services: { getFileUrl: async ({ id }) => `http://files.example.com/${id}` } });

  // ---- 假 AI 面试（open-api/admin）：记录调用，转数字人第一次返回 created、之后 existed ----
  const publishCalls = { questions: [], generate: [], projects: [] };
  const generated = new Set();
  const projectEnds = new Map();
  const interviewRows = [];
  const interviewDetails = {};
  const inviteCalls = [];
  const transferCalls = [];
  let failProject = false;
  let failDigital = false;
  const aiServices = {
    talentReviewSetting: {
      detail: async () => ({ clientId: 'c1', url: 'http://ai.example.com' }),
      getCredentials: async () => ({ apiUrl: 'http://ai.example.com/api/v1', origin: 'http://ai.example.com' }),
      getRemote: async () => ({ url: 'http://cdn.example.com/ai', version: '1.2.3' })
    },
    aiInterview: {
      detail: async () => ({ apiUrl: 'http://ai.example.com/api/v1', appId: 'app', hasSecretKey: true }),
      getAjaxBaseUrl: apiUrl => String(apiUrl || '').replace(/\/api\/v\d+$/i, ''),
      getProjectDetail: async ({ id }) => ({ id, name: `项目${id}`, projectQuestions: [], endTime: projectEnds.get(String(id)) }),
      getInterviewList: async () => ({ pageData: interviewRows, totalCount: interviewRows.length }),
      getInterviewDetail: async ({ id }) => interviewDetails[id],
      getFileUrl: async ({ id }) => `http://ai.example.com/files/${id}`,
      transferFile: async ({ id }) => {
        transferCalls.push(id);
        return `local-${id}`;
      },
      inviteCandidate: async args => {
        inviteCalls.push(args);
        return { shorten: `sh${inviteCalls.length}`, inviteId: `i${inviteCalls.length}` };
      },
      adminListDigitals: async () => ({
        pageData: [
          { digitalId: 'd-en', digital: { id: 'd-en', name: 'Emma', language: 'en-US' } },
          { digitalId: 'd-zh', digital: { id: 'd-zh', name: '小智', language: 'zh-CN' } }
        ]
      }),
      adminCreateQuestion: async ({ body }) => {
        publishCalls.questions.push(body);
        return { id: `q${publishCalls.questions.length}`, existed: false };
      },
      adminGenerateDigital: async ({ digitalIds, questionIds, forceRetry }) => {
        publishCalls.generate.push({ digitalIds, questionIds, forceRetry: !!forceRetry });
        if (failDigital) {
          return questionIds.map(questionId => ({
            questionId,
            digitalId: digitalIds[0],
            status: 'failed',
            error: 'Avatar video generation timeout: 300'
          }));
        }
        return questionIds.map(questionId => {
          const key = `${digitalIds[0]}|${questionId}`;
          const status = generated.has(key) ? 'existed' : 'created';
          generated.add(key);
          return { questionId, digitalId: digitalIds[0], status };
        });
      },
      adminCreateProject: async ({ body }) => {
        if (failProject) {
          throw new Error('project boom');
        }
        publishCalls.projects.push(body);
        projectEnds.set(`p${publishCalls.projects.length}`, body.endTime);
        return { id: `p${publishCalls.projects.length}` };
      }
    }
  };
  // ---- 假短链 / 邮件：sign 把 payload 原样编码，sendMail 只记录 ----
  const mails = [];
  const shortenStore = new Map();
  fastify.decorate('shorten', {
    services: {
      sign: async (payload, expires) => {
        const code = `code-${shortenStore.size + 1}`;
        shortenStore.set(code, { payload, expires });
        return code;
      },
      decode: async code => {
        const item = shortenStore.get(code);
        if (!item) {
          throw new Error('not found');
        }
        return item.payload;
      }
    }
  });
  aiServices.shareReport = {
    getTenant: async () => ({ id: 1, name: '测试公司' }),
    buildMailContext: (tenant, language, expires) => ({ companyName: tenant.name, language, expires }),
    sendMail: async mail => {
      if (mail.email.startsWith('bad@')) {
        throw new Error('smtp boom');
      }
      mails.push(mail);
    }
  };
  // 写回岗位：测试不落真实 workforce / skillAnalysis，只记录调用
  const roleApplyCalls = { replaceTasks: [], skillAnalysisSave: [] };
  aiServices.workforce = {
    replaceTasks: async (auth, payload) => {
      roleApplyCalls.replaceTasks.push({ auth, payload });
      return [];
    }
  };
  aiServices.position = {
    skillAnalysisSave: async (auth, payload) => {
      roleApplyCalls.skillAnalysisSave.push({ auth, payload });
      return { id: `sa-${roleApplyCalls.skillAnalysisSave.length}` };
    }
  };
  // 经理/员工/补充问卷发送走采集页：测试里用轻量 mock，不拉完整 talentCollectInvite 服务
  const collectInviteIds = [];
  const collectInviteCalls = [];
  aiServices.talentCollectInvite = {
    createForReadiness: async args => {
      const { tenantId, inviteType, name, email, projectId, expiresAt } = args;
      collectInviteCalls.push(args);
      const id = String(collectInviteIds.length + 1);
      collectInviteIds.push(id);
      const code = await fastify.shorten.services.sign(JSON.stringify({ type: 'talentCollectInvite', inviteId: id }), new Date(expiresAt).getTime());
      return {
        invite: { id, tenantId, inviteType, name, email, projectId, code },
        inviteUrl: `${fastify.config.ORIGIN}/collect-profile?code=${encodeURIComponent(code)}`,
        code
      };
    },
    bindReadinessInvite: async () => null
  };
  fastify.decorate('project', { models, services: aiServices });

  const tasks = new Map();
  const cancelled = [];
  const pending = [];
  const inflight = new Set();
  let seq = 0;
  const taskServices = {
    create: async ({ type, targetId, targetType, input }) => {
      const task = { id: String(++seq), type, targetId, targetType, input, logs: [], status: 'pending' };
      tasks.set(task.id, task);
      return task;
    },
    claimTask: async task => task,
    processSystemTask: async task => {
      const work = (async () => {
        try {
          // 真实任务框架里 runner 的 options.name 是任务插件命名空间（fastify.task），业务服务只在 fastify.project 下
          if (task.type === 'invite-video-asr') {
            // 与任务框架一致：runner 只转写，结果由 server.js 的 handler 按 targetType 交给发起方
            try {
              const result = await videoRunner(fastify, { prefix: '/api/v1/task', name: 'task' }, { task, updateProgress: async () => {}, log: async item => task.logs.push(item) });
              task.status = 'success';
              await fastify.project.services.readinessSend.onVideoAsrSuccess({ task, result });
            } catch (error) {
              task.status = 'failed';
              await fastify.project.services.readinessSend.onVideoAsrFailed({ task, error });
            }
            return;
          }
          const run = task.type === 'ReadinessPublish' ? publishRunner : task.type === 'ReadinessRoleApply' ? roleApplyRunner : runner;
          const outcome = await run(fastify, { prefix: '/api/v1/task', name: 'task' }, { task, log: async item => task.logs.push(item) });
          task.status = outcome === false ? 'running' : 'success';
          if (outcome === false) {
            pending.push(task);
          } else {
            // 与任务框架一致：runner 直接返回结果时，由 handler 落到阶段数据
            await fastify.project.services.readiness.onTaskSuccess({ task, result: outcome });
          }
        } catch (error) {
          task.status = 'failed';
          await fastify.project.services.readiness.onTaskFailed({ task, error });
        }
      })();
      inflight.add(work);
      await work;
      inflight.delete(work);
    },
    cancel: async ({ id }) => cancelled.push(String(id)),
    detail: async ({ id }) => {
      const task = tasks.get(String(id));
      return { id: task.id, status: task.status, options: { logs: task.logs } };
    }
  };
  fastify.decorate('task', {
    services: taskServices,
    models: {
      task: { findOne: async ({ where }) => [...tasks.values()].find(item => item.type === where.type && item.targetType === where.targetType && item.targetId === where.targetId && ['pending', 'running'].includes(item.status)) || null }
    }
  });
  await fastify.register(fp(readinessService), { name: 'project' });
  await fastify.register(fp(readinessConfirmService), { name: 'project', prefix: '/api/v1' });
  await fastify.register(fp(readinessSendService), { name: 'project' });
  await fastify.ready();
  const readiness = fastify.project.services.readiness;

  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
  /** 投递所有待回调任务的成功回调，直到没有新的任务产生 */
  const settle = async () => {
    for (let i = 0; i < 300; i += 1) {
      await sleep(15);
      await Promise.all([...inflight]);
      const task = pending.shift();
      if (!task) {
        await sleep(15);
        if (!inflight.size && !pending.length) {
          return;
        }
        continue;
      }
      await readiness.onTaskSuccess({ task, result: RESULTS[task.input.path] });
    }
    throw new Error('settle 超过上限，疑似死循环');
  };

  const auth = { tenantId: 1, userId: 7 };
  const tenant = await models.tenant.create({ name: 't' });
  assert.equal(String(tenant.id), '1');
  const position = await models.position.create({ name: '前端工程师', description: '负责前端', requirement: '3 年经验', language: 'zh-CN', tenantId: 1 });

  const reload = async id => {
    const run = await models.readinessRun.findByPk(id);
    return run.toJSON();
  };
  const versions = async (id, stage, personId = null) =>
    (await models.readinessStageData.findAll({ where: { runId: String(id), stage, personId }, order: [['version', 'ASC']] })).map(row => ({ version: row.version, isCurrent: row.isCurrent, status: row.status }));

  return {
    fastify,
    models,
    readiness,
    auth,
    position,
    received,
    publishCalls,
    roleApplyCalls,
    projectEnds,
    interviewRows,
    interviewDetails,
    transferCalls,
    inviteCalls,
    collectInviteCalls,
    mails,
    confirmService: () => fastify.project.services.readinessConfirm,
    sendService: () => fastify.project.services.readinessSend,
    setFailProject: value => (failProject = value),
    setFailDigital: value => (failDigital = value),
    cancelled,
    pending,
    tasks,
    settle,
    deadline: DEADLINE,
    digitalId: 'd-zh',
    reload,
    versions,
    close: async () => {
      await fastify.close();
      await sequelize.close();
      await new Promise(resolve => upstream.close(resolve));
    }
  };
};

const runToManagerConfirm = async h => {
  const { id } = await h.readiness.createRun(h.auth, { positionId: h.position.id, hasStaffQuestionnaire: false });
  await h.settle();
  return id;
};

test('创建流程：draft 任务按 input.path/params 调用上游，补全 callback_url，日志完整，经理问卷生成后阻塞等确认', async () => {
  const h = await createHarness();
  try {
    const id = await runToManagerConfirm(h);
    assert.deepEqual(
      h.received.map(item => item.path),
      ['/role/draft', '/role/question/manager']
    );
    const draft = h.received[0].body;
    assert.equal(draft.jd, '负责前端\n\n3 年经验');
    assert.equal(draft.job_title, '前端工程师');
    assert.equal(draft.language, 'zh-CN');
    assert.equal(draft.callback_url, `http://192.168.1.10:3040/api/v1/task/callback?taskId=${[...h.tasks.values()][0].id}`);
    // 任务统一为 Readiness 类型，path/params 都在 input 里
    const task = [...h.tasks.values()][0];
    assert.equal(task.type, 'Readiness');
    assert.equal(task.input.path, '/role/draft');
    assert.ok(task.input.params.callback_url === undefined, 'callback_url 由 runner 补，不写进 input.params');
    assert.deepEqual(
      task.logs.map(item => item.message),
      ['发起调用', '上游已受理，等待回调']
    );
    // manager_questionnaire 的请求体用的是 draft 的输出
    assert.deepEqual(h.received[1].body.catalog.tasks, [{ task_id: 't1', task: '写代码' }]);

    const run = await h.reload(id);
    assert.equal(run.stage, 'manager_confirm');
    assert.equal(run.status, 'blocked');
    assert.deepEqual(await h.versions(id, 'draft'), [{ version: 1, isCurrent: true, status: 'succeeded' }]);
  } finally {
    await h.close();
  }
});

test('无员工问卷：人工确认/发送/答卷 → revise → 触发报告 → 一路到 done', async () => {
  const h = await createHarness();
  try {
    const id = await runToManagerConfirm(h);
    await h.readiness.confirm(h.auth, { runId: id, kind: 'manager', deadline: h.deadline, digitalId: h.digitalId });
    // 确认后自动进入发布阶段，任务完成后才到发送
    assert.equal((await h.reload(id)).stage, 'manager_publish');
    await h.settle();
    assert.equal((await h.reload(id)).stage, 'manager_send');
    const [published] = await h.models.readinessStageData.findAll({ where: { runId: String(id), stage: 'manager_publish' } });
    assert.equal(published.status, 'succeeded');
    assert.equal(published.output.projectId, 'p1');
    assert.equal(published.output.deadline, h.deadline);
    assert.match(published.output.projectName, /^前端工程师-\d{4}-\d{2}-\d{2}-\d+$/);
    await h.readiness.completeSend({ run: { id }, kind: 'manager', output: { sent: 1 }, userId: 7 });
    assert.equal((await h.reload(id)).stage, 'manager_answers');
    await h.readiness.submitAnswers(h.auth, { runId: id, kind: 'manager', answers: { 1: 'a' } });
    await h.settle();
    // revise 的请求体带上了经理问卷与答卷
    const revise = h.received.find(item => item.path === '/role/revise');
    assert.deepEqual(revise.body.answers, { 1: 'a' });
    assert.equal(revise.body.questionnaire.length, 2);
    assert.equal((await h.reload(id)).stage, 'await_persons');

    await h.readiness.triggerReports(h.auth, { runId: id });
    await h.settle();
    const run = await h.reload(id);
    assert.equal(run.stage, 'done');
    assert.equal(run.status, 'done');
    assert.deepEqual(
      h.received.map(item => item.path),
      ['/role/draft', '/role/question/manager', '/role/revise', '/role/recall', '/role/skills', '/role/forecast', '/role/report']
    );
  } finally {
    await h.close();
  }
});

test('退回到 draft：旧版本保留为历史、产生 v2；迟到的旧回调被忽略；未完成任务被取消', async () => {
  const h = await createHarness();
  try {
    const { id } = await h.readiness.createRun(h.auth, { positionId: h.position.id, hasStaffQuestionnaire: false });
    await new Promise(resolve => setTimeout(resolve, 80));
    const staleTask = h.pending.shift();
    assert.equal(staleTask.input.path, '/role/draft');

    // draft 还在等回调时退回 draft：v1 作废并取消，v2 重新发起
    await h.readiness.rollback(h.auth, { runId: id, scope: 'role', stage: 'draft' });
    await new Promise(resolve => setTimeout(resolve, 80));
    assert.deepEqual(h.cancelled, [staleTask.id]);
    assert.deepEqual(await h.versions(id, 'draft'), [
      { version: 1, isCurrent: false, status: 'superseded' },
      { version: 2, isCurrent: true, status: 'running' }
    ]);

    // 迟到的 v1 回调不能推进流程
    await h.readiness.onTaskSuccess({ task: staleTask, result: RESULTS['/role/draft'] });
    assert.equal((await h.reload(id)).stage, 'draft');
    assert.equal(h.received.filter(item => item.path === '/role/question/manager').length, 0);

    await h.settle();
    assert.equal((await h.reload(id)).stage, 'manager_confirm');

    // 到 manager_confirm 后再退回 draft，draft 与 manager_questionnaire 都产生新版本
    await h.readiness.rollback(h.auth, { runId: id, scope: 'role', stage: 'draft' });
    await h.settle();
    assert.deepEqual(
      (await h.versions(id, 'draft')).map(item => `${item.version}:${item.isCurrent}`),
      ['1:false', '2:false', '3:true']
    );
    assert.deepEqual(
      (await h.versions(id, 'manager_questionnaire')).map(item => `${item.version}:${item.isCurrent}`),
      ['1:false', '2:true']
    );
    assert.equal((await h.reload(id)).stage, 'manager_confirm');

    // 不能退回到还没到达的阶段
    await assert.rejects(() => h.readiness.rollback(h.auth, { runId: id, scope: 'role', stage: 'forecast' }), /已经到达过/);
  } finally {
    await h.close();
  }
});

test('/role/draft 返回 code 423：阶段 failed，流程 canceled（无待办），岗位 assessmentStatus=error', async () => {
  const h = await createHarness({ responseByPath: { '/role/draft': { status: 200, body: { code: 423, msg: 'invalid role input' } } } });
  try {
    const { id } = await h.readiness.createRun(h.auth, { positionId: h.position.id, hasStaffQuestionnaire: false });
    await h.settle();
    const run = await h.reload(id);
    assert.equal(run.stage, 'draft');
    assert.equal(run.status, 'canceled');
    const [failed] = await h.models.readinessStageData.findAll({ where: { runId: String(id), stage: 'draft', isCurrent: true } });
    assert.equal(failed.status, 'failed');
    assert.match(failed.error, /code 423/);
    const position = await h.models.position.findByPk(h.position.id);
    assert.equal(position.assessmentStatus, 'error');
    const { runTodos } = require('../../libs/utils/readiness-stages');
    assert.deepEqual(runTodos({ run, failed: [failed] }), []);
  } finally {
    await h.close();
  }
});

test('/role/draft 回调 code 423：流程 canceled，岗位 assessmentStatus=error', async () => {
  const h = await createHarness();
  try {
    const { id } = await h.readiness.createRun(h.auth, { positionId: h.position.id, hasStaffQuestionnaire: false });
    await Promise.all([...h.tasks.values()].map(() => null));
    // 不走 settle 成功回调：模拟上游回调失败（仅 message，code 在日志里）
    const task = h.pending.shift();
    assert.ok(task);
    task.options = { logs: [{ message: '回调结果', data: { code: 423, message: 'invalid role input', data: null }, time: new Date() }] };
    await h.readiness.onTaskFailed({ task, error: 'invalid role input' });
    const run = await h.reload(id);
    assert.equal(run.status, 'canceled');
    const position = await h.models.position.findByPk(h.position.id);
    assert.equal(position.assessmentStatus, 'error');
  } finally {
    await h.close();
  }
});

test('上游返回 500：阶段 failed 且记录错误，run 为 failed；重试后产生新版本并继续', async () => {
  const h = await createHarness({ failPaths: ['/role/question/manager'] });
  try {
    const { id } = await h.readiness.createRun(h.auth, { positionId: h.position.id, hasStaffQuestionnaire: false });
    await h.settle();
    let run = await h.reload(id);
    assert.equal(run.stage, 'manager_questionnaire');
    assert.equal(run.status, 'failed');
    const [failed] = await h.models.readinessStageData.findAll({ where: { runId: String(id), stage: 'manager_questionnaire' } });
    assert.equal(failed.status, 'failed');
    assert.match(failed.error, /HTTP 500/);
    const failedTask = [...h.tasks.values()].find(item => item.input.stage === 'manager_questionnaire');
    assert.ok(failedTask.logs.some(item => item.message === '调用失败' && item.data.status === 500));

    // 重试会重新调用上游（假上游仍返回 500，所以 v2 也是 failed）
    const stillFailing = h.received.length;
    await h.readiness.retry(h.auth, { runId: id, scope: 'role', stage: 'manager_questionnaire' });
    await h.settle();
    assert.ok(h.received.length > stillFailing, '重试会重新调用上游');
    assert.deepEqual(
      (await h.versions(id, 'manager_questionnaire')).map(item => `${item.version}:${item.status}`),
      ['1:failed', '2:failed']
    );
  } finally {
    await h.close();
  }
});

test('有员工问卷：补卷分支（完整度 50 < 80）→ reassess → assess_update → claims；各 Person 与 Role 独立推进到 done', async () => {
  const h = await createHarness();
  try {
    const emp = await h.models.employee.create({ name: '张三', email: 'zs@x.com', tenantId: 1 });
    const { id } = await h.readiness.createRun(h.auth, { positionId: h.position.id, hasStaffQuestionnaire: true, employeeIds: [String(emp.id)] });
    await h.settle();
    await h.readiness.confirm(h.auth, { runId: id, kind: 'manager', deadline: h.deadline, digitalId: h.digitalId });
    await h.settle();
    await h.readiness.completeSend({ run: { id }, kind: 'manager', output: {}, userId: 7 });
    await h.readiness.submitAnswers(h.auth, { runId: id, kind: 'manager', answers: { 1: 'a' } });
    await h.settle();
    assert.equal((await h.reload(id)).stage, 'staff_confirm');
    const [person] = await h.readiness.loadPersons({ id, tenantId: 1 });
    assert.equal(person.stage, 'pending');

    await h.readiness.confirm(h.auth, { runId: id, kind: 'staff', deadline: h.deadline, digitalId: h.digitalId });
    await h.settle();
    await h.readiness.completeSend({ run: { id }, kind: 'staff', personId: person.id, output: {}, userId: 7 });
    assert.equal((await h.reload(id)).stage, 'await_persons');
    assert.equal((await h.models.readinessRunPerson.findByPk(person.id)).stage, 'answers');

    // 员工答卷 → assess（50%）→ 低于阈值走 reassess，人工确认补卷
    await h.readiness.submitAnswers(h.auth, { runId: id, kind: 'staff', personId: person.id, answers: { 1: 'x' } });
    await h.settle();
    let current = await h.models.readinessRunPerson.findByPk(person.id);
    assert.equal(current.stage, 'reassess_confirm');
    assert.equal(current.profileCompletionPct, 50);

    await h.readiness.confirm(h.auth, { runId: id, kind: 'reassess', personId: person.id, deadline: h.deadline, digitalId: h.digitalId });
    await h.settle();
    assert.equal((await h.models.readinessRunPerson.findByPk(person.id)).stage, 'reassess_send');
    await h.readiness.completeSend({ run: { id }, kind: 'reassess', personId: person.id, output: {}, userId: 7 });
    await h.readiness.submitAnswers(h.auth, { runId: id, kind: 'reassess', personId: person.id, answers: { 9: 'y' } });
    await h.settle();
    current = await h.models.readinessRunPerson.findByPk(person.id);
    assert.equal(current.stage, 'done');
    assert.equal(current.profileCompletionPct, 90);

    // 触发报告：要求全部参与人完成；person_reports 每人一次，随后 role_report → role_apply → done
    await h.readiness.triggerReports(h.auth, { runId: id });
    await h.settle();
    const run = await h.reload(id);
    assert.equal(run.stage, 'done');
    assert.equal(run.status, 'done');
    const paths = h.received.map(item => item.path);
    assert.deepEqual(
      paths.filter(item => item.startsWith('/person/')),
      ['/person/assess', '/person/question/reassess', '/person/assess/update', '/person/claims', '/person/report']
    );
    // person_reports 的请求体用的是补评后的评估结果
    assert.equal(h.received.find(item => item.path === '/person/report').body.assess.profile_completion_pct, 90);
  } finally {
    await h.close();
  }
});

test('补充问卷可人工跳过：reassess_confirm 直接进入 assess_update，不发补卷、不收答卷，补评用空题目空答卷', async () => {
  const h = await createHarness();
  try {
    const emp = await h.models.employee.create({ name: '李四', email: 'ls@x.com', tenantId: 1 });
    const { id } = await h.readiness.createRun(h.auth, { positionId: h.position.id, hasStaffQuestionnaire: true, employeeIds: [String(emp.id)] });
    await h.settle();
    await h.readiness.confirm(h.auth, { runId: id, kind: 'manager', deadline: h.deadline, digitalId: h.digitalId });
    await h.settle();
    await h.readiness.completeSend({ run: { id }, kind: 'manager', output: {}, userId: 7 });
    await h.readiness.submitAnswers(h.auth, { runId: id, kind: 'manager', answers: { 1: 'a' } });
    await h.settle();
    const [person] = await h.readiness.loadPersons({ id, tenantId: 1 });
    await h.readiness.confirm(h.auth, { runId: id, kind: 'staff', deadline: h.deadline, digitalId: h.digitalId });
    await h.settle();
    await h.readiness.completeSend({ run: { id }, kind: 'staff', personId: person.id, output: {}, userId: 7 });
    await h.readiness.submitAnswers(h.auth, { runId: id, kind: 'staff', personId: person.id, answers: { 1: 'x' } });
    await h.settle();
    assert.equal((await h.models.readinessRunPerson.findByPk(person.id)).stage, 'reassess_confirm');

    // 非确认补充问卷阶段不能跳过（先校验阶段，再动数据）
    await assert.rejects(h.readiness.skipReassessConfirm(h.auth, { runId: id, personId: 'not-exist' }));

    await h.readiness.skipReassessConfirm(h.auth, { runId: id, personId: person.id });
    await h.settle();
    const current = await h.models.readinessRunPerson.findByPk(person.id);
    assert.equal(current.stage, 'done');
    assert.equal(current.profileCompletionPct, 90);
    const paths = h.received.map(item => item.path);
    // 补卷题在进入确认前已生成一次；跳过后不再发补卷、不再收答卷
    assert.equal(paths.filter(item => item === '/person/question/reassess').length, 1);
    assert.equal(paths.filter(item => item === '/person/assess/update').length, 1);
    const update = h.received.find(item => item.path === '/person/assess/update').body;
    assert.deepEqual(update.questionnaire, []);
    assert.deepEqual(update.answers, {});

    // 跳过记录为带 skipped 标记的人工版本，不计入“已确认”
    const skipRow = await h.models.readinessStageData.findOne({ where: { runId: String(id), personId: String(person.id), stage: 'reassess_confirm', isCurrent: true } });
    assert.equal(skipRow.output.skipped, true);
    assert.equal(skipRow.output.confirmedAt, undefined);
    // detail 的阶段摘要不含 output，需单独带出 skipped 标记，前端据此把后续阶段置灰
    const detail = await h.readiness.detail(h.auth, { id });
    assert.deepEqual(
      detail.stageData.filter(item => item.skipped).map(item => `${item.stage}:${item.personId}`),
      [`reassess_confirm:${person.id}`]
    );

    // 已跳过后再次跳过：阶段不符，拒绝
    await assert.rejects(h.readiness.skipReassessConfirm(h.auth, { runId: id, personId: person.id }), /不能跳过补充问卷确认/);
  } finally {
    await h.close();
  }
});

test('个人报告失败：Role 为失败，但参与人自己的流程已完成，状态仍为 done', async () => {
  const h = await createHarness({ failPaths: ['/person/report'] });
  try {
    const emp = await h.models.employee.create({ name: '王五', email: 'ww@x.com', tenantId: 1 });
    const { id } = await h.readiness.createRun(h.auth, { positionId: h.position.id, hasStaffQuestionnaire: true, employeeIds: [String(emp.id)] });
    await h.settle();
    await h.readiness.confirm(h.auth, { runId: id, kind: 'manager', deadline: h.deadline, digitalId: h.digitalId });
    await h.settle();
    await h.readiness.completeSend({ run: { id }, kind: 'manager', output: {}, userId: 7 });
    await h.readiness.submitAnswers(h.auth, { runId: id, kind: 'manager', answers: { 1: 'a' } });
    await h.settle();
    const [person] = await h.readiness.loadPersons({ id, tenantId: 1 });
    await h.readiness.confirm(h.auth, { runId: id, kind: 'staff', deadline: h.deadline, digitalId: h.digitalId });
    await h.settle();
    await h.readiness.completeSend({ run: { id }, kind: 'staff', personId: person.id, output: {}, userId: 7 });
    await h.readiness.submitAnswers(h.auth, { runId: id, kind: 'staff', personId: person.id, answers: { 1: 'x' } });
    await h.settle();
    await h.readiness.skipReassessConfirm(h.auth, { runId: id, personId: person.id });
    await h.settle();
    await h.readiness.triggerReports(h.auth, { runId: id });
    await h.settle();

    assert.equal((await h.reload(id)).status, 'failed');
    const current = await h.models.readinessRunPerson.findByPk(person.id);
    assert.equal(current.stage, 'done');
    assert.equal(current.status, 'done');
  } finally {
    await h.close();
  }
});

test('任务取消回调 cancelHandler：阶段立即记为失败', async () => {
  const h = await createHarness();
  try {
    const { id } = await h.readiness.createRun(h.auth, { positionId: h.position.id, hasStaffQuestionnaire: false });
    await new Promise(resolve => setTimeout(resolve, 80));
    const draftTask = [...h.tasks.values()][0];

    draftTask.status = 'canceled';
    await h.readiness.onTaskCanceled({ task: draftTask });

    assert.equal((await h.reload(id)).status, 'failed');
    const [row] = await h.models.readinessStageData.findAll({ where: { runId: String(id), stage: 'draft' } });
    assert.equal(row.error, '任务已在任务管理中取消');
  } finally {
    await h.close();
  }
});

test('任务取消后：阶段记为失败、run 为 failed，之后可重试恢复', async () => {
  const h = await createHarness();
  try {
    const { id } = await h.readiness.createRun(h.auth, { positionId: h.position.id, hasStaffQuestionnaire: false });
    await new Promise(resolve => setTimeout(resolve, 80));
    const draftTask = [...h.tasks.values()][0];
    assert.equal((await h.reload(id)).status, 'running');

    // 任务管理页取消任务：框架回调 cancelHandler
    draftTask.status = 'canceled';
    await h.readiness.onTaskCanceled({ task: draftTask });
    const run = await h.reload(id);
    assert.equal(run.status, 'failed');
    assert.deepEqual(await h.versions(id, 'draft'), [{ version: 1, isCurrent: true, status: 'failed' }]);
    const [row] = await h.models.readinessStageData.findAll({ where: { runId: String(id), stage: 'draft' } });
    assert.equal(row.error, '任务已在任务管理中取消');

    // 重复回调不重复修改
    await h.readiness.onTaskCanceled({ task: draftTask });
    assert.equal((await h.reload(id)).status, 'failed');

    // 重试后流程继续
    await h.readiness.retry(h.auth, { runId: id, scope: 'role', stage: 'draft' });
    await h.settle();
    assert.equal((await h.reload(id)).stage, 'manager_confirm');
    assert.equal((await h.reload(id)).status, 'blocked');
  } finally {
    await h.close();
  }
});

test('确认问卷必须填写截止日期：缺失/过去日期被拒，阶段不推进', async () => {
  const h = await createHarness();
  try {
    const id = await runToManagerConfirm(h);
    await assert.rejects(() => h.readiness.confirm(h.auth, { runId: id, kind: 'manager', digitalId: h.digitalId }), /请填写问卷截止日期/);
    await assert.rejects(() => h.readiness.confirm(h.auth, { runId: id, kind: 'manager', deadline: '2020-01-01', digitalId: h.digitalId }), /不能早于今天/);
    await assert.rejects(() => h.readiness.confirm(h.auth, { runId: id, kind: 'manager', deadline: h.deadline }), /请选择数字人/);
    assert.equal((await h.reload(id)).stage, 'manager_confirm');
    assert.equal(await h.models.readinessStageData.count({ where: { runId: String(id), stage: 'manager_confirm' } }), 0);
  } finally {
    await h.close();
  }
});

/** 走到员工问卷待发送：有一位员工参与人（zs@x.com） */
const toStaffSend = async h => {
  const emp = await h.models.employee.create({ name: '张三', email: 'zs@x.com', tenantId: 1 });
  const { id } = await h.readiness.createRun(h.auth, { positionId: h.position.id, hasStaffQuestionnaire: true, employeeIds: [String(emp.id)] });
  await h.settle();
  await h.readiness.confirm(h.auth, { runId: id, kind: 'manager', deadline: h.deadline, digitalId: h.digitalId });
  await h.settle();
  await h.readiness.completeSend({ run: { id }, kind: 'manager', output: {}, userId: 7 });
  await h.readiness.submitAnswers(h.auth, { runId: id, kind: 'manager', answers: { 1: 'a' } });
  await h.settle();
  await h.readiness.confirm(h.auth, { runId: id, kind: 'staff', deadline: h.deadline, digitalId: h.digitalId });
  await h.settle();
  return { id, emp };
};

test('员工问卷发送：可选择参与人，也可添加员工 / 手填姓名邮箱（落成流程参与人），已有参与人按邮箱不重复', async () => {
  const h = await createHarness();
  try {
    const { id } = await toStaffSend(h);
    const extra = await h.models.employee.create({ name: '李四', email: 'ls@x.com', tenantId: 1 });
    const recipients = [
      { name: '李四', email: 'ls@x.com', employeeId: String(extra.id) },
      { name: '王五', email: 'ww@x.com' },
      { name: '张三', email: 'ZS@x.com' }
    ];
    // 预览：不落库；personIds=[] 表示不发已有参与人，但手动添加的收件人照发（张三按邮箱对应到已有参与人）
    const preview = await h.sendService().preview(h.auth, { kind: 'staff', runIds: [String(id)], recipients, personIds: [] });
    assert.deepEqual(preview.eligible[0].targets.map(item => item.email).sort(), ['ls@x.com', 'ww@x.com', 'zs@x.com']);
    assert.equal(await h.models.readinessRunPerson.count({ where: { runId: String(id) } }), 1, '预览不新增参与人');

    const result = await h.sendService().send(h.auth, { kind: 'staff', runIds: [String(id)], recipients, personIds: [], language: 'zh-CN' });
    assert.equal(result.sent.length, 3);
    const persons = await h.models.readinessRunPerson.findAll({ where: { runId: String(id) }, order: [['id', 'ASC']] });
    assert.deepEqual(
      persons.map(item => item.email),
      ['zs@x.com', 'ls@x.com', 'ww@x.com']
    );
    assert.equal(String(persons[1].employeeId), String(extra.id));
    assert.equal(persons[2].employeeId, null);
    assert.ok(persons.every(item => item.stage === 'answers'));
  } finally {
    await h.close();
  }
});

test('员工问卷发送：选择的租户成员按租户用户 / 关联员工取邮箱；取不到邮箱的在预览里提示，不静默丢弃', async () => {
  const h = await createHarness();
  try {
    const { id } = await toStaffSend(h);
    const user = await h.models.tenantUser.create({ name: '赵六', email: 'zl@x.com', tenantId: 1 });
    const linked = await h.models.employee.create({ name: '赵六', email: 'old@x.com', tenantUserId: String(user.id), tenantId: 1 });
    // 只填手机号的成员：租户用户无邮箱，但关联员工有邮箱 → 回退到员工邮箱
    const phoneOnly = await h.models.tenantUser.create({ name: '钱七', email: null, tenantId: 1 });
    const phoneEmp = await h.models.employee.create({ name: '钱七', email: 'qq@x.com', tenantUserId: String(phoneOnly.id), tenantId: 1 });
    // 只填手机号且没有员工档案 → 无邮箱，预览里提示
    const noMail = await h.models.tenantUser.create({ name: '孙八', email: null, tenantId: 1 });
    const other = await h.models.tenantUser.create({ name: '外租户', email: 'other@x.com', tenantId: 2 });
    const recipients = [{ tenantUserId: String(user.id), name: '赵六' }, { tenantUserId: String(phoneOnly.id), name: '钱七' }, { tenantUserId: String(noMail.id), name: '孙八' }, { tenantUserId: String(other.id) }, { tenantUserId: '9999' }];
    const preview = await h.sendService().preview(h.auth, { kind: 'staff', runIds: [String(id)], recipients, personIds: [] });
    assert.deepEqual(preview.eligible[0].targets.map(item => item.email).sort(), ['qq@x.com', 'zl@x.com']);
    assert.deepEqual(
      preview.invalidRecipients.map(item => [item.name, item.reason]),
      [
        ['孙八', '未填写邮箱'],
        ['', '成员不存在'],
        ['', '成员不存在']
      ]
    );
    const result = await h.sendService().send(h.auth, { kind: 'staff', runIds: [String(id)], recipients, personIds: [], language: 'zh-CN' });
    assert.deepEqual(result.sent.map(item => item.email).sort(), ['qq@x.com', 'zl@x.com']);
    const person = await h.models.readinessRunPerson.findOne({ where: { runId: String(id), email: 'zl@x.com' } });
    assert.equal(String(person.employeeId), String(linked.id));
    const phonePerson = await h.models.readinessRunPerson.findOne({ where: { runId: String(id), email: 'qq@x.com' } });
    assert.equal(String(phonePerson.employeeId), String(phoneEmp.id));
  } finally {
    await h.close();
  }
});

test('员工问卷发送：已有参与人勾选 + 选择 3 个租户成员（含已有参与人本人），预览应列出 3 人', async () => {
  const h = await createHarness();
  try {
    const { id } = await toStaffSend(h);
    const persons = await h.models.readinessRunPerson.findAll({ where: { runId: String(id) } });
    const jane = await h.models.tenantUser.create({ name: 'Jane', email: 'jane@x.com', tenantId: 1 });
    const daisy = await h.models.tenantUser.create({ name: 'Daisy', email: 'daisy@x.com', tenantId: 1 });
    const zs = await h.models.tenantUser.create({ name: '张三', email: 'zs@x.com', tenantId: 1 });
    const recipients = [
      { tenantUserId: String(jane.id), name: 'Jane' },
      { tenantUserId: String(daisy.id), name: 'Daisy' },
      { tenantUserId: String(zs.id), name: '张三' }
    ];
    const preview = await h.sendService().preview(h.auth, { kind: 'staff', runIds: [String(id)], recipients, personIds: persons.map(item => String(item.id)) });
    assert.deepEqual(preview.eligible[0].targets.map(item => item.email).sort(), ['daisy@x.com', 'jane@x.com', 'zs@x.com']);
  } finally {
    await h.close();
  }
});

test('删除问卷邀请：经理邀请可删（只删邀请记录），已发送的也能删', async () => {
  const h = await createHarness();
  try {
    const { id } = await sendManager(h);
    const before = await h.models.readinessInvite.findAll({ where: { runId: String(id), isCurrent: true } });
    assert.equal(before.length, 1);
    const result = await h.sendService().deleteInvites(h.auth, { inviteIds: [String(before[0].id)] });
    assert.deepEqual(result.deleted, [String(before[0].id)]);
    assert.equal(await h.models.readinessInvite.count({ where: { runId: String(id), isCurrent: true } }), 0);
  } finally {
    await h.close();
  }
});

test('删除问卷邀请：员工邀请删除时同时删除参与人；已提交答卷的参与人不删', async () => {
  const h = await createHarness();
  try {
    const { id } = await toStaffSend(h);
    await h.sendService().send(h.auth, { kind: 'staff', runIds: [String(id)], language: 'zh-CN' });
    const invite = await h.models.readinessInvite.findOne({ where: { runId: String(id), isCurrent: true } });
    assert.ok(invite.personId, '员工邀请关联参与人');
    const deleted = await h.sendService().deleteInvites(h.auth, { inviteIds: [String(invite.id)] });
    assert.deepEqual(deleted.deleted, [String(invite.id)]);
    assert.equal(await h.models.readinessRunPerson.count({ where: { id: String(invite.personId) } }), 0, '参与人同时删除');

    // 已提交答卷（阶段越过 answers）的参与人：邀请与参与人都保留
    const again = await toStaffSend(h);
    await h.sendService().send(h.auth, { kind: 'staff', runIds: [String(again.id)], language: 'zh-CN' });
    const answered = await h.models.readinessInvite.findOne({ where: { runId: String(again.id), isCurrent: true } });
    await h.models.readinessRunPerson.update({ stage: 'assess' }, { where: { id: String(answered.personId) } });
    const skipped = await h.sendService().deleteInvites(h.auth, { inviteIds: [String(answered.id)] });
    assert.deepEqual(skipped.deleted, []);
    assert.equal(skipped.skipped.length, 1);
    assert.equal(await h.models.readinessInvite.count({ where: { id: String(answered.id), isCurrent: true } }), 1);
    assert.equal(await h.models.readinessRunPerson.count({ where: { id: String(answered.personId) } }), 1);
  } finally {
    await h.close();
  }
});

test('确认邮件详情：展示是否已确认与确认时间；确认后回退则不再算确认', async () => {
  const h = await createHarness();
  try {
    const id = await runToManagerConfirm(h);
    // 待确认阶段发送确认邮件
    await h.confirmService().sendMails(h.auth, { runId: String(id), kind: 'manager', recipients: [{ email: 'c@example.com' }], language: 'zh-CN', digitalId: h.digitalId });
    const before = await h.readiness.detail(h.auth, { id: String(id) });
    assert.equal(before.confirmMails.length, 1);
    assert.equal(before.confirmMails[0].confirmed, false, '尚未确认');
    assert.equal(before.confirmMails[0].confirmedAt, null);

    // 管理员确认（确认时间写入阶段数据）
    await h.readiness.confirm(h.auth, { runId: id, kind: 'manager', deadline: h.deadline, digitalId: h.digitalId });
    await h.settle();
    const after = await h.readiness.detail(h.auth, { id: String(id) });
    assert.equal(after.confirmMails[0].confirmed, true);
    assert.ok(after.confirmMails[0].confirmedAt, '有确认时间');
  } finally {
    await h.close();
  }
});

test('员工问卷发送：只传 personIds 时只发所选参与人；不传则发全部待发送参与人', async () => {
  const h = await createHarness();
  try {
    const { id } = await toStaffSend(h);
    const none = await h.sendService().preview(h.auth, { kind: 'staff', runIds: [String(id)], personIds: [] });
    assert.deepEqual(none.eligible[0].targets, []);
    const all = await h.sendService().preview(h.auth, { kind: 'staff', runIds: [String(id)] });
    assert.deepEqual(
      all.eligible[0].targets.map(item => item.email),
      ['zs@x.com']
    );
  } finally {
    await h.close();
  }
});

test('经理问卷发送：支持添加员工 / 手填姓名邮箱作为收件人，同邮箱去重', async () => {
  const h = await createHarness();
  try {
    const id = await runToManagerConfirm(h);
    await h.readiness.confirm(h.auth, { runId: id, kind: 'manager', deadline: h.deadline, digitalId: h.digitalId });
    await h.settle();
    const result = await h.sendService().send(h.auth, {
      kind: 'manager',
      runIds: [String(id)],
      recipients: [
        { name: '李四', email: 'ls@x.com', employeeId: '9' },
        { name: '王五', email: 'ww@x.com' },
        { name: '重复', email: 'LS@x.com' }
      ],
      language: 'zh-CN'
    });
    assert.deepEqual(result.sent.map(item => item.email).sort(), ['ls@x.com', 'ww@x.com']);
  } finally {
    await h.close();
  }
});

const sendManager = async (h, extra = {}) => {
  const id = await runToManagerConfirm(h);
  await h.readiness.confirm(h.auth, { runId: id, kind: 'manager', deadline: h.deadline, digitalId: h.digitalId });
  await h.settle();
  const result = await h.sendService().send(h.auth, { kind: 'manager', runIds: [String(id)], recipients: [{ email: 'a@example.com' }], language: 'zh-CN', ...extra });
  return { id, result, projectEnd: new Date(h.projectEnds.get('p1')).getTime() };
};

test('发送问卷：经理/员工走采集免登录页，有效期取问卷项目；发送时不立刻创建 AI 面试邀请', async () => {
  const h = await createHarness();
  try {
    const { id, result, projectEnd } = await sendManager(h);
    assert.equal(result.sent.length, 1);
    assert.equal(h.inviteCalls.length, 0);
    assert.equal(h.mails.at(-1).props.expires, projectEnd);
    const invite = await h.models.readinessInvite.findOne({ where: { runId: String(id), isCurrent: true } });
    assert.match(invite.url, /\/collect-profile\?code=/);
    assert.equal(invite.shorten, null);
    assert.ok(invite.collectInviteId);
    assert.equal(new Date(invite.expiresAt).getTime(), projectEnd);
    assert.equal(h.collectInviteCalls.at(-1).inviteType, 'manager');
  } finally {
    await h.close();
  }
});

test('发送补充问卷：与经理一样走本站 /collect-profile，inviteType=manager（仅面试步），不直达 AI 面试', async () => {
  const h = await createHarness();
  try {
    const emp = await h.models.employee.create({ name: '张三', email: 'zs@x.com', tenantId: 1 });
    const { id } = await h.readiness.createRun(h.auth, { positionId: h.position.id, hasStaffQuestionnaire: true, employeeIds: [String(emp.id)] });
    await h.settle();
    await h.readiness.confirm(h.auth, { runId: id, kind: 'manager', deadline: h.deadline, digitalId: h.digitalId });
    await h.settle();
    await h.readiness.completeSend({ run: { id }, kind: 'manager', output: {}, userId: 7 });
    await h.readiness.submitAnswers(h.auth, { runId: id, kind: 'manager', answers: { 1: 'a' } });
    await h.settle();
    const [person] = await h.readiness.loadPersons({ id, tenantId: 1 });
    await h.readiness.confirm(h.auth, { runId: id, kind: 'staff', deadline: h.deadline, digitalId: h.digitalId });
    await h.settle();
    await h.readiness.completeSend({ run: { id }, kind: 'staff', personId: person.id, output: {}, userId: 7 });
    await h.readiness.submitAnswers(h.auth, { runId: id, kind: 'staff', personId: person.id, answers: { 1: 'x' } });
    await h.settle();
    await h.readiness.confirm(h.auth, { runId: id, kind: 'reassess', personId: person.id, deadline: h.deadline, digitalId: h.digitalId });
    await h.settle();
    assert.equal((await h.models.readinessRunPerson.findByPk(person.id)).stage, 'reassess_send');

    const beforeInviteCalls = h.inviteCalls.length;
    const result = await h.sendService().send(h.auth, { kind: 'reassess', runIds: [String(id)], language: 'zh-CN' });
    assert.equal(result.sent.length, 1);
    assert.equal(h.inviteCalls.length, beforeInviteCalls, '补充问卷发送时不应立刻创建 AI 面试邀请');
    const invite = await h.models.readinessInvite.findOne({ where: { runId: String(id), kind: 'reassess', isCurrent: true } });
    assert.match(invite.url, /\/collect-profile\?code=/);
    assert.equal(invite.shorten, null);
    assert.ok(invite.collectInviteId);
    assert.equal(h.collectInviteCalls.at(-1).inviteType, 'manager');
  } finally {
    await h.close();
  }
});

test('发送问卷：手填截止日期只能提前，晚于项目有效期时仍取项目有效期', async () => {
  const today = new Date(Date.now() + 8 * 3600 * 1000).toISOString().slice(0, 10);
  const early = await createHarness();
  try {
    const { id, projectEnd } = await sendManager(early, { deadline: today });
    const invite = await early.models.readinessInvite.findOne({ where: { runId: String(id), isCurrent: true } });
    const expires = new Date(invite.expiresAt).getTime();
    assert.ok(expires < projectEnd, '提前的截止日期应早于项目有效期');
    assert.ok(expires > Date.now());
    assert.equal(early.mails.at(-1).props.expires, expires);
    assert.equal(early.inviteCalls.length, 0);
  } finally {
    await early.close();
  }
  const late = await createHarness();
  try {
    const { id, projectEnd } = await sendManager(late, { deadline: '2099-12-31' });
    const invite = await late.models.readinessInvite.findOne({ where: { runId: String(id), isCurrent: true } });
    assert.equal(new Date(invite.expiresAt).getTime(), projectEnd);
    assert.equal(late.inviteCalls.length, 0);
  } finally {
    await late.close();
  }
});

test('发送问卷：拿不到项目有效期或项目已过期时不发送', async () => {
  const h = await createHarness();
  try {
    const id = await runToManagerConfirm(h);
    await h.readiness.confirm(h.auth, { runId: id, kind: 'manager', deadline: h.deadline, digitalId: h.digitalId });
    await h.settle();
    h.projectEnds.set('p1', undefined);
    let result = await h.sendService().send(h.auth, { kind: 'manager', runIds: [String(id)], recipients: [{ email: 'a@example.com' }], language: 'zh-CN' });
    assert.equal(result.sent.length, 0);
    assert.match(result.skipped[0].reason, /无法获取问卷项目的有效期/);
    h.projectEnds.set('p1', new Date(Date.now() - 1000).toISOString());
    result = await h.sendService().send(h.auth, { kind: 'manager', runIds: [String(id)], recipients: [{ email: 'a@example.com' }], language: 'zh-CN' });
    assert.match(result.skipped[0].reason, /问卷项目已过期/);
    assert.equal(h.inviteCalls.length, 0);
  } finally {
    await h.close();
  }
});

test('发送弹窗默认截止日期：取问卷项目有效期的 UTC+8 日期，未发布时为空', async () => {
  const h = await createHarness();
  try {
    const id = await runToManagerConfirm(h);
    const before = await h.sendService().sendDefaults(h.auth, { kind: 'manager', runIds: [String(id)] });
    assert.equal(before.deadline, null);
    await h.readiness.confirm(h.auth, { runId: id, kind: 'manager', deadline: h.deadline, digitalId: h.digitalId });
    await h.settle();
    const projectEnd = h.projectEnds.get('p1');
    const after = await h.sendService().sendDefaults(h.auth, { kind: 'manager', runIds: [String(id)] });
    assert.equal(after.deadline, new Date(new Date(projectEnd).getTime() + 8 * 3600 * 1000).toISOString().slice(0, 10));
  } finally {
    await h.close();
  }
});

test('回收答卷：先保存到当前阶段，确认后才进入下一阶段', async () => {
  const h = await createHarness();
  try {
    const id = await runToManagerConfirm(h);
    await h.readiness.confirm(h.auth, { runId: id, kind: 'manager', deadline: h.deadline, digitalId: h.digitalId });
    await h.settle();
    await h.sendService().send(h.auth, { kind: 'manager', runIds: [String(id)], recipients: [{ email: 'a@example.com' }], language: 'zh-CN' });
    await h.settle();
    const invite = await h.models.readinessInvite.findOne({ where: { runId: String(id), isCurrent: true } });
    // 模拟采集页 ensureInvite 后回写 shorten
    await invite.update({ shorten: 'sh-c1', inviteId: 'i-c1' });
    // 候选人已提交问卷：面试记录的 code 即邀请的 shorten
    h.interviewRows.push({ id: 'c1', code: 'sh-c1', email: 'a@example.com' });
    h.interviewDetails.c1 = {
      options: { questionnaire: { submittedAt: new Date().toISOString(), answers: { Q01: 'A' } } },
      answers: { v1: { question: { id: 'v1', title: '请介绍一个项目' }, aiResult: [{ message: '我主导' }, { message: '过一次迁移' }], submit: true } }
    };
    const result = await h.sendService().syncAnswers(h.auth, { runId: id });
    assert.equal(result.saved, 1);
    assert.equal(result.video, 1);
    const [saved] = await h.models.readinessStageData.findAll({ where: { runId: String(id), stage: 'manager_answers', isCurrent: true } });
    assert.deepEqual(saved.output.videoAnswers, [{ questionId: 'v1', title: '请介绍一个项目', transcript: '我主导过一次迁移', submitted: true, fileIds: [] }]);
    assert.equal((await h.reload(id)).stage, 'manager_answers');
    assert.equal(await h.models.readinessStageData.count({ where: { runId: String(id), stage: 'manager_answers', isCurrent: true, status: 'succeeded' } }), 1);
    // 再次获取不会重复保存
    assert.equal((await h.sendService().syncAnswers(h.auth, { runId: id })).saved, 0);
    await h.readiness.advanceAnswers(h.auth, { runId: id, kind: 'manager' });
    await h.settle();
    const revise = h.received.find(item => item.path === '/role/revise');
    assert.deepEqual(revise.body.answers, { Q01: 'A' });
    assert.equal((await h.reload(id)).stage, 'await_persons');
  } finally {
    await h.close();
  }
});

test('回收答卷：已回收的答卷之后补充视频题作答，且只补一次', async () => {
  const h = await createHarness();
  try {
    const id = await runToManagerConfirm(h);
    await h.readiness.confirm(h.auth, { runId: id, kind: 'manager', deadline: h.deadline, digitalId: h.digitalId });
    await h.settle();
    await h.sendService().send(h.auth, { kind: 'manager', runIds: [String(id)], recipients: [{ email: 'a@example.com' }], language: 'zh-CN' });
    await h.settle();
    const invite = await h.models.readinessInvite.findOne({ where: { runId: String(id), isCurrent: true } });
    await invite.update({ shorten: 'sh-c2', inviteId: 'i-c2' });
    h.interviewRows.push({ id: 'c2', code: 'sh-c2', email: 'a@example.com' });
    // 第一次回收时视频题还没有作答：有访谈题时不能标 answered，也不能进入下一阶段
    h.interviewDetails.c2 = { options: { questionnaire: { submittedAt: new Date().toISOString(), answers: { Q01: 'B' } } }, answers: {} };
    assert.equal((await h.sendService().syncAnswers(h.auth, { runId: id })).saved, 1);
    await invite.reload();
    assert.equal(invite.status, 'sent');
    const [partial] = await h.models.readinessStageData.findAll({ where: { runId: String(id), stage: 'manager_answers', isCurrent: true } });
    assert.equal(partial.output.answersReady, false);
    await assert.rejects(() => h.readiness.advanceAnswers(h.auth, { runId: id, kind: 'manager' }), /访谈题未完成 AI 数据采集/);
    // 之后视频题作答完成，再次获取：补充到已保存的答卷上并标记 answered
    h.interviewDetails.c2 = {
      options: { questionnaire: { submittedAt: new Date().toISOString(), answers: { Q01: 'B' } } },
      answers: { v2: { question: { id: 'v2', title: '最近的挑战' }, aiResult: [{ message: '数据迁移' }], submit: true } }
    };
    const again = await h.sendService().syncAnswers(h.auth, { runId: id });
    assert.equal(again.saved, 0);
    assert.equal(again.video, 1);
    assert.equal(again.collected, 1);
    await invite.reload();
    assert.equal(invite.status, 'answered');
    const [row] = await h.models.readinessStageData.findAll({ where: { runId: String(id), stage: 'manager_answers', isCurrent: true } });
    assert.deepEqual(row.output.answers, { Q01: 'B' });
    assert.equal(row.output.videoAnswers[0].transcript, '数据迁移');
    assert.equal(row.output.answersReady, true);
    // 已补充过，不再重复
    assert.equal((await h.sendService().syncAnswers(h.auth, { runId: id })).video, 0);
  } finally {
    await h.close();
  }
});

test('视频题录像按真实地址转存本仓文件系统，转存后不重复转存', async () => {
  const h = await createHarness();
  try {
    const id = await runToManagerConfirm(h);
    await h.readiness.confirm(h.auth, { runId: id, kind: 'manager', deadline: h.deadline, digitalId: h.digitalId });
    await h.settle();
    await h.sendService().send(h.auth, { kind: 'manager', runIds: [String(id)], recipients: [{ email: 'a@example.com' }], language: 'zh-CN' });
    await h.settle();
    const invite = await h.models.readinessInvite.findOne({ where: { runId: String(id), isCurrent: true } });
    await invite.update({ shorten: 'sh-c3', inviteId: 'i-c3' });
    h.interviewRows.push({ id: 'c3', code: 'sh-c3', email: 'a@example.com' });
    h.interviewDetails.c3 = {
      options: { questionnaire: { submittedAt: new Date().toISOString(), answers: { Q01: 'B' } } },
      questionList: [{ questionDigital: { question: { id: 'v3', answerType: 'video' } } }],
      answers: { v3: { question: { id: 'v3', title: '最近的挑战' }, aiResult: [], submit: true, result: ['src1'], probeList: [{ result: ['src2'] }] } }
    };
    const first = await h.sendService().syncAnswers(h.auth, { runId: id });
    assert.equal(first.transcribing, 1);
    const load = () => h.models.readinessStageData.findOne({ where: { runId: String(id), stage: 'manager_answers', isCurrent: true } });
    for (let n = 0; n < 50 && ((await load()).output.videoAnswers[0].files || []).length < 2; n += 1) {
      await new Promise(resolve => setTimeout(resolve, 20));
    }
    assert.deepEqual((await load()).output.videoAnswers[0].files, [
      { sourceId: 'src1', fileId: 'local-src1' },
      { sourceId: 'src2', fileId: 'local-src2' }
    ]);
    for (let n = 0; n < 50 && !(await load()).output.videoAnswers[0].asrDone; n += 1) {
      await new Promise(resolve => setTimeout(resolve, 20));
    }
    const done = (await load()).output.videoAnswers[0];
    assert.equal(done.transcript, '我负责迁移我负责迁移');
    assert.equal([...h.tasks.values()].find(item => item.type === 'invite-video-asr').targetType, 'readiness-stage');
    // 已转存、已转写：再次获取不重复处理
    assert.equal((await h.sendService().syncAnswers(h.auth, { runId: id })).transcribing, 0);
    assert.deepEqual(h.transferCalls, ['src1', 'src2']);
  } finally {
    await h.close();
  }
});

test('回收答卷：未回收到答卷时不能确认进入下一阶段', async () => {
  const h = await createHarness();
  try {
    const id = await runToManagerConfirm(h);
    await h.readiness.confirm(h.auth, { runId: id, kind: 'manager', deadline: h.deadline, digitalId: h.digitalId });
    await h.settle();
    await h.sendService().send(h.auth, { kind: 'manager', runIds: [String(id)], recipients: [{ email: 'a@example.com' }], language: 'zh-CN' });
    await h.settle();
    await assert.rejects(() => h.readiness.advanceAnswers(h.auth, { runId: id, kind: 'manager' }), /尚未回收到经理答卷/);
    assert.equal((await h.reload(id)).stage, 'manager_answers');
  } finally {
    await h.close();
  }
});

test('重新回答：经理问卷作废答卷并按原收件人自动重发', async () => {
  const h = await createHarness();
  try {
    const id = await runToManagerConfirm(h);
    await h.readiness.confirm(h.auth, { runId: id, kind: 'manager', deadline: h.deadline, digitalId: h.digitalId });
    await h.settle();
    await h.sendService().send(h.auth, { kind: 'manager', runIds: [String(id)], recipients: [{ name: '经理甲', email: 'mgr@example.com' }], language: 'zh-CN' });
    await h.settle();
    await h.readiness.saveAnswers(h.auth, { runId: id, kind: 'manager', answers: { Q01: 'old' } });
    assert.equal((await h.reload(id)).stage, 'manager_answers');
    const before = await h.models.readinessInvite.findOne({ where: { runId: String(id), kind: 'manager', isCurrent: true } });
    assert.equal(before.email, 'mgr@example.com');

    const result = await h.readiness.reanswer(h.auth, { runId: id, kind: 'manager' });
    assert.ok((result.advanced || []).includes(String(id)));
    assert.equal((await h.reload(id)).stage, 'manager_answers');
    assert.equal(await h.models.readinessStageData.count({ where: { runId: String(id), stage: 'manager_answers', isCurrent: true, status: 'succeeded' } }), 0);
    const after = await h.models.readinessInvite.findAll({ where: { runId: String(id), kind: 'manager', isCurrent: true } });
    assert.equal(after.length, 1);
    assert.equal(after[0].email, 'mgr@example.com');
    assert.notEqual(String(after[0].id), String(before.id));
    assert.equal((await before.reload()).isCurrent, false);
  } finally {
    await h.close();
  }
});

test('重新回答：员工问卷回退参与人并自动重发；补充问卷同理', async () => {
  const h = await createHarness();
  try {
    const { id } = await toStaffSend(h);
    const person = await h.models.readinessRunPerson.findOne({ where: { runId: String(id) } });
    await h.sendService().send(h.auth, { kind: 'staff', runIds: [String(id)], personIds: [String(person.id)], language: 'zh-CN' });
    await h.settle();
    await h.readiness.saveAnswers(h.auth, { runId: id, kind: 'staff', personId: person.id, answers: { S01: 'old' } });
    assert.equal((await h.models.readinessRunPerson.findByPk(person.id)).stage, 'answers');
    const staffInvite = await h.models.readinessInvite.findOne({ where: { runId: String(id), kind: 'staff', personId: String(person.id), isCurrent: true } });
    assert.ok(staffInvite);

    await h.readiness.reanswer(h.auth, { runId: id, kind: 'staff', personId: person.id });
    assert.equal((await h.models.readinessRunPerson.findByPk(person.id)).stage, 'answers');
    assert.equal(await h.models.readinessStageData.count({ where: { runId: String(id), stage: 'answers', personId: String(person.id), isCurrent: true, status: 'succeeded' } }), 0);
    const staffAgain = await h.models.readinessInvite.findOne({ where: { runId: String(id), kind: 'staff', personId: String(person.id), isCurrent: true } });
    assert.ok(staffAgain);
    assert.notEqual(String(staffAgain.id), String(staffInvite.id));
    assert.equal(staffAgain.email, staffInvite.email);

    // 推到补充问卷答卷阶段后再重新回答
    await h.readiness.submitAnswers(h.auth, { runId: id, kind: 'staff', personId: person.id, answers: { S01: 'new' } });
    await h.settle();
    assert.equal((await h.models.readinessRunPerson.findByPk(person.id)).stage, 'reassess_confirm');
    await h.readiness.confirm(h.auth, { runId: id, kind: 'reassess', personId: person.id, deadline: h.deadline, digitalId: h.digitalId });
    await h.settle();
    await h.sendService().send(h.auth, { kind: 'reassess', runIds: [String(id)], personIds: [String(person.id)], language: 'zh-CN' });
    await h.settle();
    await h.readiness.saveAnswers(h.auth, { runId: id, kind: 'reassess', personId: person.id, answers: { R01: 'old' } });
    const reassessInvite = await h.models.readinessInvite.findOne({ where: { runId: String(id), kind: 'reassess', personId: String(person.id), isCurrent: true } });
    assert.ok(reassessInvite);
    await h.readiness.reanswer(h.auth, { runId: id, kind: 'reassess', personId: person.id });
    assert.equal((await h.models.readinessRunPerson.findByPk(person.id)).stage, 'reassess_answers');
    assert.equal(await h.models.readinessStageData.count({ where: { runId: String(id), stage: 'reassess_answers', personId: String(person.id), isCurrent: true, status: 'succeeded' } }), 0);
    const reassessAgain = await h.models.readinessInvite.findOne({ where: { runId: String(id), kind: 'reassess', personId: String(person.id), isCurrent: true } });
    assert.ok(reassessAgain);
    assert.notEqual(String(reassessAgain.id), String(reassessInvite.id));
    assert.equal(reassessAgain.email, reassessInvite.email);
  } finally {
    await h.close();
  }
});

test('预览面试项目：发布后返回项目详情与远程组件地址；未发布时提示', async () => {
  const h = await createHarness();
  try {
    const id = await runToManagerConfirm(h);
    await assert.rejects(() => h.sendService().projectPreview(h.auth, { runId: id, kind: 'manager' }), /尚未发布/);
    await h.readiness.confirm(h.auth, { runId: id, kind: 'manager', deadline: h.deadline, digitalId: h.digitalId });
    await h.settle();
    const preview = await h.sendService().projectPreview(h.auth, { runId: id, kind: 'manager' });
    assert.equal(preview.project.id, 'p1');
    assert.equal(preview.project.name, '项目p1');
    assert.deepEqual(preview.remote, { url: 'http://cdn.example.com/ai', version: '1.2.3' });
    assert.equal(preview.apiHost, 'http://ai.example.com/api/v1');
    await assert.rejects(() => h.sendService().projectPreview(h.auth, { runId: id, kind: 'bad' }), /问卷类型不正确/);
  } finally {
    await h.close();
  }
});

test('数字人：确认时选哪个就用哪个；列表按流程语言排序；所选数字人不属于该客户时发布失败', async () => {
  const h = await createHarness();
  try {
    const id = await runToManagerConfirm(h);
    const { pageData } = await h.readiness.listDigitals(h.auth, { runId: id });
    assert.deepEqual(pageData, [
      { id: 'd-zh', name: '小智', language: 'zh-CN' },
      { id: 'd-en', name: 'Emma', language: 'en-US' }
    ]);

    await h.readiness.confirm(h.auth, { runId: id, kind: 'manager', deadline: h.deadline, digitalId: 'd-missing' });
    await h.settle();
    let run = await h.reload(id);
    assert.equal(run.status, 'failed');
    const [failed] = await h.models.readinessStageData.findAll({ where: { runId: String(id), stage: 'manager_publish' } });
    assert.match(failed.error, /所选数字人未分配给该 AI 面试客户/);
    assert.equal(h.publishCalls.projects.length, 0);
    assert.equal(h.publishCalls.questions.length, 0);

    // 回退到确认重新选择：用选中的 d-en 发布
    await h.readiness.rollback(h.auth, { runId: id, scope: 'role', stage: 'manager_confirm' });
    await h.readiness.confirm(h.auth, { runId: id, kind: 'manager', deadline: h.deadline, digitalId: 'd-en' });
    await h.settle();
    run = await h.reload(id);
    assert.equal(run.stage, 'manager_send');
    assert.deepEqual(h.publishCalls.generate[0].digitalIds, ['d-en']);
    assert.equal(h.publishCalls.projects[0].digitalId, 'd-en');
  } finally {
    await h.close();
  }
});

test('发布任务：访谈题建题 → 转数字人（轮询到 existed）→ 建数据采集项目并开启', async () => {
  const h = await createHarness();
  try {
    const id = await runToManagerConfirm(h);
    await h.readiness.confirm(h.auth, { runId: id, kind: 'manager', deadline: h.deadline, digitalId: h.digitalId });
    await h.settle();

    const [question] = h.publishCalls.questions;
    assert.equal(h.publishCalls.questions.length, 1);
    assert.deepEqual(question, { title: '访谈题', type: 'main', language: 'zh-CN', answerType: 'video', enableDataCollection: true, determinant: '了解岗位\n\n追问方向：\n追问一' });
    // 第一次 created，第二次 existed：说明轮询了转数字人
    assert.equal(h.publishCalls.generate.length, 2);
    assert.deepEqual(h.publishCalls.generate[0], { digitalIds: ['d-zh'], questionIds: ['q1'], forceRetry: true });
    assert.equal(h.publishCalls.generate[1].forceRetry, false);

    const [project] = h.publishCalls.projects;
    assert.match(project.name, /^前端工程师-\d{4}-\d{2}-\d{2}-\d+$/);
    assert.equal(project.scene, 'dataCollection');
    assert.equal(project.status, 'open');
    assert.equal(project.clientId, 'c1');
    assert.equal(project.digitalId, 'd-zh');
    assert.deepEqual(project.questionIds, ['q1']);
    assert.ok(project.endTime.startsWith(h.deadline) || new Date(project.endTime).getTime() > Date.now());
    assert.equal(project.setting.questionnaire.enabled, true);
    assert.equal(project.setting.questionnaire.schema.blocks[0].list[0].name, 'Q01');

    const task = [...h.tasks.values()].find(item => item.type === 'ReadinessPublish');
    assert.equal(task.input.tenantId, '1');
    assert.equal(task.input.params.deadline, h.deadline);
    assert.ok(task.logs.some(item => item.message === '项目已开启'));
    // 发布阶段没有调用 Readiness 上游
    assert.ok(!h.received.some(item => item.path.includes('publish')));
  } finally {
    await h.close();
  }
});

test('转数字人返回 failed：发布阶段立刻 failed，并带上 AI 面试错误摘要', async () => {
  const h = await createHarness();
  try {
    const id = await runToManagerConfirm(h);
    h.setFailDigital(true);
    await h.readiness.confirm(h.auth, { runId: id, kind: 'manager', deadline: h.deadline, digitalId: h.digitalId });
    await h.settle();
    const run = await h.reload(id);
    assert.equal(run.stage, 'manager_publish');
    assert.equal(run.status, 'failed');
    const [failed] = await h.models.readinessStageData.findAll({ where: { runId: String(id), stage: 'manager_publish' } });
    assert.match(failed.error, /Avatar video generation timeout: 300/);
    assert.equal(h.publishCalls.projects.length, 0);
    assert.equal(h.publishCalls.generate[0].forceRetry, true);
  } finally {
    await h.close();
  }
});

test('发布失败：阶段 failed 且保留确认数据；重试成功后继续到发送', async () => {
  const h = await createHarness();
  try {
    const id = await runToManagerConfirm(h);
    h.setFailProject(true);
    await h.readiness.confirm(h.auth, { runId: id, kind: 'manager', deadline: h.deadline, digitalId: h.digitalId });
    await h.settle();
    let run = await h.reload(id);
    assert.equal(run.stage, 'manager_publish');
    assert.equal(run.status, 'failed');
    const [failed] = await h.models.readinessStageData.findAll({ where: { runId: String(id), stage: 'manager_publish' } });
    assert.match(failed.error, /project boom/);
    assert.equal((await h.models.readinessStageData.findOne({ where: { runId: String(id), stage: 'manager_confirm', isCurrent: true } })).output.deadline, h.deadline);

    h.setFailProject(false);
    await h.readiness.retry(h.auth, { runId: id, scope: 'role', stage: 'manager_publish' });
    await h.settle();
    run = await h.reload(id);
    assert.equal(run.stage, 'manager_send');
    assert.deepEqual(
      (await h.versions(id, 'manager_publish')).map(item => `${item.version}:${item.status}`),
      ['1:failed', '2:succeeded']
    );
  } finally {
    await h.close();
  }
});

test('没有访谈题但有问卷题：跳过建题与转数字人，创建仅问卷数据采集项目', async () => {
  const h = await createHarness();
  try {
    const original = RESULTS['/role/question/manager'];
    RESULTS['/role/question/manager'] = { result: { questionnaire: original.result.questionnaire, interview: [] } };
    try {
      const id = await runToManagerConfirm(h);
      await h.readiness.confirm(h.auth, { runId: id, kind: 'manager', deadline: h.deadline, digitalId: h.digitalId });
      await h.settle();
      const run = await h.reload(id);
      assert.equal(run.stage, 'manager_send');
      assert.equal(h.publishCalls.questions.length, 0);
      assert.equal(h.publishCalls.generate.length, 0);
      assert.equal(h.publishCalls.projects.length, 1);
      assert.deepEqual(h.publishCalls.projects[0].questionIds, []);
      assert.equal(h.publishCalls.projects[0].status, 'open');
      assert.equal(h.publishCalls.projects[0].setting.questionnaire.enabled, true);
      assert.ok(h.publishCalls.projects[0].setting.questionnaire.schema.blocks[0].list.length > 0);
    } finally {
      RESULTS['/role/question/manager'] = original;
    }
  } finally {
    await h.close();
  }
});

test('没有访谈题也没有问卷题：发布失败，不会建出空项目', async () => {
  const h = await createHarness();
  try {
    const original = RESULTS['/role/question/manager'];
    RESULTS['/role/question/manager'] = { result: { questionnaire: [], interview: [] } };
    try {
      const id = await runToManagerConfirm(h);
      await h.readiness.confirm(h.auth, { runId: id, kind: 'manager', deadline: h.deadline, digitalId: h.digitalId });
      await h.settle();
      const [row] = await h.models.readinessStageData.findAll({ where: { runId: String(id), stage: 'manager_publish' } });
      assert.equal(row.status, 'failed');
      assert.match(row.error, /没有访谈题也没有问卷题/);
      assert.equal(h.publishCalls.projects.length, 0);
    } finally {
      RESULTS['/role/question/manager'] = original;
    }
  } finally {
    await h.close();
  }
});

test('确认邮件：指定语言时邮件与链接固定该语言；不指定时用流程语言且链接不带 lang', async () => {
  const h = await createHarness();
  try {
    const id = await runToManagerConfirm(h);
    await assert.rejects(() => h.confirmService().sendMails(h.auth, { runId: id, kind: 'manager', recipients: [{ email: 'a@x.com' }] }), /请选择数字人/);
    await h.confirmService().sendMails(h.auth, { runId: id, kind: 'manager', recipients: [{ email: 'a@x.com' }], digitalId: h.digitalId, language: 'en-US' });
    const fixed = new URL(h.mails[0].props.sharedConfirmUrl);
    assert.equal(h.mails[0].code, 'READINESSCONFIRM[en-US]');
    assert.equal(fixed.searchParams.get('lang'), 'en-US');
    assert.equal((await h.confirmService().publicDetail({ code: fixed.searchParams.get('code') })).language, 'en-US');

    await h.confirmService().sendMails(h.auth, { runId: id, kind: 'manager', recipients: [{ email: 'b@x.com' }], digitalId: h.digitalId, language: 'auto' });
    const auto = new URL(h.mails[1].props.sharedConfirmUrl);
    assert.equal(h.mails[1].code, 'READINESSCONFIRM[zh-CN]');
    assert.equal(auto.searchParams.get('lang'), null);
  } finally {
    await h.close();
  }
});

test('确认邮件：多个收件人共用一条链接，任意一人确认即生效，其余人再确认会被拒绝', async () => {
  const h = await createHarness();
  try {
    const id = await runToManagerConfirm(h);
    const result = await h.confirmService().sendMails(h.auth, {
      runId: id,
      kind: 'manager',
      digitalId: h.digitalId,
      recipients: [{ name: '甲', email: 'a@x.com' }, { email: 'B@x.com' }, { email: 'a@x.com' }, { email: 'bad@x.com' }],
      language: 'zh-CN'
    });
    assert.deepEqual(result.sent, ['a@x.com', 'b@x.com']);
    assert.equal(result.failed.length, 1);
    assert.equal(result.failed[0].email, 'bad@x.com');
    assert.equal(h.mails.length, 2);
    const urls = h.mails.map(mail => mail.props.sharedConfirmUrl);
    assert.equal(new Set(urls).size, 1);
    assert.match(urls[0], /^http:\/\/192\.168\.1\.10:3040\/readiness-confirm\?code=/);
    assert.equal(h.mails[0].code, 'READINESSCONFIRM[zh-CN]');
    assert.equal(new URL(urls[0]).searchParams.get('lang'), 'zh-CN');
    const batch = await h.models.readinessSendBatch.findOne({ where: { kind: 'confirm:manager' } });
    assert.deepEqual(batch.runIds, [String(id)]);

    const code = new URL(urls[0]).searchParams.get('code');
    const detail = await h.confirmService().publicDetail({ code });
    assert.equal(detail.items.length, 1);
    assert.equal(detail.items[0].confirmed, false);
    assert.equal(detail.items[0].roleName, '前端工程师');
    assert.equal(detail.items[0].questionnaire.length, 2);
    assert.equal(detail.items[0].questionnaire[0].showIf, null);
    assert.deepEqual(detail.items[0].questionnaire[1].showIf, { no: 'Q01', op: 'in', values: ['A'] });
    assert.equal(detail.items[0].questionnaire[0].no, 'Q01');
    assert.deepEqual(detail.items[0].questionnaire[0].moduleInfo, { 'zh-CN': { title: '基础', description: '' }, 'en-US': { title: '基础', description: '' } });
    assert.equal(detail.items[0].interview.length, 1);

    await assert.rejects(() => h.confirmService().publicConfirm({ code, deadline: '', key: detail.items[0].key }), /请填写问卷截止日期/);
    // 并发确认：谁先到谁生效，恰好一个成功
    const results = await Promise.allSettled([h.confirmService().publicConfirm({ code, deadline: h.deadline, key: detail.items[0].key }), h.confirmService().publicConfirm({ code, deadline: h.deadline, key: detail.items[0].key })]);
    assert.equal(results.filter(item => item.status === 'fulfilled').length, 1);
    const rejected = results.find(item => item.status === 'rejected');
    assert.match(rejected.reason.message, /已被确认/);

    await h.settle();
    assert.equal((await h.reload(id)).stage, 'manager_send');
    const confirmed = await h.models.readinessStageData.findOne({ where: { runId: String(id), stage: 'manager_confirm', isCurrent: true } });
    assert.equal(confirmed.output.via, 'email');
    assert.equal(confirmed.output.deadline, h.deadline);
    // 确认后再打开链接：已确认状态，题目仍可预览
    const after = await h.confirmService().publicDetail({ code });
    assert.equal(after.items[0].confirmed, true);
    assert.equal(after.items[0].deadline, h.deadline);
    assert.equal(after.items[0].questionnaire.length, 2);
  } finally {
    await h.close();
  }
});

test('确认邮件：非确认阶段不能发；链接无效/问卷已更新被拒绝', async () => {
  const h = await createHarness();
  try {
    const { id } = await h.readiness.createRun(h.auth, { positionId: h.position.id, hasStaffQuestionnaire: false });
    await new Promise(resolve => setTimeout(resolve, 80));
    await assert.rejects(() => h.confirmService().sendMails(h.auth, { runId: id, kind: 'manager', recipients: [{ email: 'a@x.com' }], digitalId: h.digitalId }), /不能发送确认邮件/);
    await h.settle();
    await assert.rejects(() => h.confirmService().sendMails(h.auth, { runId: id, kind: 'manager', recipients: [{ email: 'not-an-email' }], digitalId: h.digitalId }), /邮箱格式不正确/);
    await assert.rejects(() => h.confirmService().sendMails(h.auth, { runId: id, kind: 'manager', recipients: [], digitalId: h.digitalId }), /至少填写一个/);
    await assert.rejects(() => h.confirmService().publicDetail({ code: 'nope' }), /无效或已过期/);

    await h.confirmService().sendMails(h.auth, { runId: id, kind: 'manager', recipients: [{ email: 'a@x.com' }], digitalId: h.digitalId });
    const code = new URL(h.mails[0].props.sharedConfirmUrl).searchParams.get('code');
    const beforeOutdated = await h.confirmService().publicDetail({ code });
    // 问卷重新生成（退回 draft）后，旧邮件里的链接不再可确认
    await h.readiness.rollback(h.auth, { runId: id, scope: 'role', stage: 'draft' });
    await h.settle();
    assert.equal((await h.confirmService().publicDetail({ code })).items[0].outdated, true);
    await assert.rejects(() => h.confirmService().publicConfirm({ code, deadline: h.deadline, key: beforeOutdated.items[0].key }), /问卷已更新/);
    assert.equal((await h.reload(id)).stage, 'manager_confirm');
  } finally {
    await h.close();
  }
});
