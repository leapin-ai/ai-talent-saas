const fp = require('fastify-plugin');
const dayjs = require('dayjs');
const ensureSlash = require('@kne/ensure-slash');
const { QUESTIONNAIRE_KINDS, questionnaireOf } = require('../utils/readiness-stages');
const { normalizeRecipients } = require('../utils/readiness-send');
const { moduleInfo } = require('../utils/readiness-publish');

const CONFIRM_SHORTEN_TYPE = 'readinessConfirm';
const CONFIRM_TTL_DAYS = 14;
const MAX_RECIPIENTS = 20;
const MAX_TARGETS = 50;
const MAIL_LANGUAGES = ['zh-CN', 'en-US'];
const INVALID_LINK_MESSAGE = '确认链接无效或已过期';

/**
 * 确认问卷邮件：一次可发多份待确认问卷；收件人共用一封邮件、一个入口链接。
 * 免登录页内每份问卷仍各自点确认（各自填截止日期），先到先得。
 * 真正的确认动作复用 readiness.confirmQuestionnaire。
 */
module.exports = fp(async (fastify, options) => {
  const { models, services } = fastify[options.name];
  const idOrNull = value => (value == null || value === '' ? null : String(value));

  const requireShorten = () => {
    const shorten = fastify.shorten?.services;
    if (!shorten?.sign || !shorten?.decode) {
      throw new Error('短链服务未就绪');
    }
    return shorten;
  };

  const targetKeyOf = ({ runId, kind, personId }) => `${String(runId)}:${kind}:${personId ? String(personId) : ''}`;

  const normalizeTargetsInput = ({ runId, kind, personId, targets } = {}) => {
    if (Array.isArray(targets) && targets.length) {
      return targets.map(item => ({
        runId: String(item.runId),
        kind: item.kind,
        personId: idOrNull(item.personId)
      }));
    }
    if (runId && kind) {
      return [{ runId: String(runId), kind, personId: idOrNull(personId) }];
    }
    throw new Error('请指定要确认的问卷');
  };

  const loadTarget = async ({ tenantId, runId, kind, personId }) => {
    const info = QUESTIONNAIRE_KINDS[kind];
    if (!info) {
      throw new Error('问卷类型不正确');
    }
    const run = await models.readinessRun.findOne({ where: { id: String(runId), tenantId } });
    if (!run) {
      throw new Error('流程不存在');
    }
    let person = null;
    if (info.scope === 'person') {
      person = await models.readinessRunPerson.findOne({ where: { id: String(personId), runId: String(run.id), tenantId } });
      if (!person) {
        throw new Error('参与人不存在');
      }
    }
    const stage = info.scope === 'role' ? run.stage : person.stage;
    const version = await services.readiness.questionnaireVersion({ run, kind, personId: person?.id });
    return { info, run, person, stage, version, kind };
  };

  const publicLanguage = language => (MAIL_LANGUAGES.includes(language) ? language : 'zh-CN');

  /** 当前确认状态：confirmed 以当前版本的确认数据为准（回退后会失效）；驳回仍停在确认阶段 */
  const confirmState = async ({ run, info, person, stage }) => {
    if (stage === info.confirmStage) {
      const row = await models.readinessStageData.findOne({
        where: { runId: String(run.id), stage: info.confirmStage, personId: idOrNull(info.scope === 'person' ? person.id : null), isCurrent: true, status: 'succeeded' }
      });
      if (row?.output?.rejected === true) {
        return {
          confirmed: false,
          rejected: true,
          rejectComment: row.output?.comment || '',
          rejectedAt: row.output?.rejectedAt || null,
          rejectedByEmail: row.output?.rejectedByEmail || '',
          rejectedByName: row.output?.rejectedByName || ''
        };
      }
      return { confirmed: false, rejected: false };
    }
    const row = await models.readinessStageData.findOne({
      where: { runId: String(run.id), stage: info.confirmStage, personId: idOrNull(info.scope === 'person' ? person.id : null), isCurrent: true, status: 'succeeded' }
    });
    if (!row || row.output?.rejected || row.output?.skipped) {
      return { confirmed: false, notReached: true };
    }
    return { confirmed: true, deadline: row.output?.deadline || null, confirmedAt: row.output?.confirmedAt || null };
  };

  const mapQuestionnaire = output => {
    const { questionnaire, interview } = questionnaireOf(output);
    return {
      questionnaire: questionnaire.map(item => ({
        no: item.no,
        type: item.type,
        module: item.module,
        moduleInfo: { 'zh-CN': moduleInfo(item.module, 'zh-CN'), 'en-US': moduleInfo(item.module, 'en-US') },
        question: item.question,
        options: item.options,
        showIf: item.show_if?.no ? { no: String(item.show_if.no), op: item.show_if.op === 'not_in' ? 'not_in' : 'in', values: [].concat(item.show_if.values ?? []).map(String) } : null
      })),
      interview: interview.map(item => ({ no: item.no, question: item.question }))
    };
  };

  const buildItemDetail = async ({ tenantId, runId, kind, personId, questionnaireVersion }) => {
    const { info, run, person, stage, version } = await loadTarget({ tenantId, runId, kind, personId });
    const state = await confirmState({ run, info, person, stage });
    const item = {
      key: targetKeyOf({ runId: run.id, kind, personId: person?.id }),
      runId: String(run.id),
      kind,
      personId: person ? String(person.id) : null,
      roleName: run.roleName,
      personName: person?.name || '',
      outdated: version != null && Number(version) !== Number(questionnaireVersion),
      stage,
      ...state,
      questionnaire: [],
      interview: []
    };
    // 已确认也可预览题目；仅问卷已更新时不再返回旧题
    if (!item.outdated && version != null) {
      const row = await models.readinessStageData.findOne({
        where: { runId: String(run.id), stage: info.questionnaireStage, personId: idOrNull(info.scope === 'person' ? person.id : null), isCurrent: true, status: 'succeeded' }
      });
      Object.assign(item, mapQuestionnaire(row?.output));
    }
    return item;
  };

  /** 向有关人发送确认邮件；同一次发送可含多份问卷，共用一封邮件与一个入口链接 */
  const sendMails = async ({ tenantId, userId }, body = {}) => {
    const { recipients, language, digitalId } = body;
    if (!idOrNull(digitalId)) {
      throw new Error('请选择数字人');
    }
    const inputTargets = normalizeTargetsInput(body);
    if (inputTargets.length > MAX_TARGETS) {
      throw new Error(`一次最多发送 ${MAX_TARGETS} 份确认问卷`);
    }
    const seen = new Set();
    const loaded = [];
    for (const target of inputTargets) {
      const key = targetKeyOf(target);
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      const row = await loadTarget({ tenantId, ...target });
      if (row.stage !== row.info.confirmStage) {
        throw new Error(`${row.run.roleName}${row.person ? ` / ${row.person.name}` : ''}：当前阶段为 ${row.stage}，不能发送确认邮件`);
      }
      if (row.version == null) {
        throw new Error(`${row.run.roleName}${row.person ? ` / ${row.person.name}` : ''}：问卷尚未生成`);
      }
      loaded.push(row);
    }
    if (!loaded.length) {
      throw new Error('请指定要确认的问卷');
    }

    const { valid, invalid } = normalizeRecipients(recipients);
    if (invalid.length) {
      throw new Error(`邮箱格式不正确：${invalid.map(item => item.email).join(', ')}`);
    }
    if (!valid.length) {
      throw new Error('请至少填写一个有效的收件人邮箱');
    }
    const managerOnly = loaded.every(item => item.kind === 'manager');
    if (managerOnly && valid.length > 1) {
      throw new Error('经理问卷确认邮件最多只能发送给一位收件人');
    }
    if (valid.length > MAX_RECIPIENTS) {
      throw new Error(`一次最多发送给 ${MAX_RECIPIENTS} 个收件人`);
    }

    // 指定了语言：邮件与链接页面都固定为该语言；未指定：邮件用首个流程语言，页面可自行切换
    const fixedLanguage = MAIL_LANGUAGES.includes(language) ? language : null;
    const mailLanguage = fixedLanguage || publicLanguage(loaded[0].run.language);
    const expires = dayjs().add(CONFIRM_TTL_DAYS, 'day').valueOf();
    const payloadTargets = loaded.map(({ run, person, kind, version }) => ({
      runId: String(run.id),
      kind,
      personId: person ? String(person.id) : null,
      questionnaireVersion: version
    }));
    const tenant = await services.shareReport.getTenant(tenantId);
    const context = services.shareReport.buildMailContext(tenant, mailLanguage, expires);
    const names = loaded.map(({ run, person }) => (person ? `${run.roleName} / ${person.name}` : run.roleName));
    const subject =
      mailLanguage === 'zh-CN'
        ? `${context.companyName ? `${context.companyName} ` : ''}请确认岗位就绪度问卷${names.length > 1 ? `（${names.length}）` : `：${names[0]}`}`
        : `${context.companyName ? `${context.companyName} ` : ''}Please confirm the Role Readiness Questionnaire${names.length > 1 ? ` (${names.length})` : `: ${names[0]}`}`;

    const items = names.map(name => ({ name }));
    const sent = [];
    const failed = [];
    const langQuery = fixedLanguage ? `&lang=${fixedLanguage}` : '';
    // 每个收件人单独签发短链（带 email），驳回/确认时可记下操作人邮箱
    for (const recipient of valid) {
      try {
        const code = await requireShorten().sign(
          JSON.stringify({
            type: CONFIRM_SHORTEN_TYPE,
            tenantId: String(tenantId),
            language: mailLanguage,
            digitalId: String(digitalId),
            targets: payloadTargets,
            email: recipient.email,
            name: recipient.name || ''
          }),
          expires
        );
        const url = `${ensureSlash(fastify.config.ORIGIN || '')}/readiness-confirm?code=${encodeURIComponent(code)}${langQuery}`;
        await services.shareReport.sendMail({
          email: recipient.email,
          code: `READINESSCONFIRM[${mailLanguage}]`,
          subject,
          props: Object.assign({}, context, { items, sharedConfirmUrl: url, recipientName: recipient.name })
        });
        sent.push(recipient.email);
      } catch (e) {
        failed.push({ email: recipient.email, reason: e.message || '发送失败' });
      }
    }
    const kindLabel = loaded.length === 1 ? `confirm:${loaded[0].kind}` : 'confirm:batch';
    const batch = await models.readinessSendBatch.create({
      tenantId,
      kind: kindLabel,
      runIds: [...new Set(loaded.map(({ run }) => String(run.id)))],
      recipients: valid.map(item => item.email),
      subject,
      result: {
        targets: payloadTargets,
        sent,
        failed
      },
      createdUserId: idOrNull(userId)
    });
    return { batchId: String(batch.id), sent, failed, targetCount: loaded.length };
  };

  const decode = async code => {
    if (!code) {
      throw new Error(INVALID_LINK_MESSAGE);
    }
    let payload;
    try {
      payload = JSON.parse(await requireShorten().decode(String(code)));
    } catch (e) {
      throw new Error(INVALID_LINK_MESSAGE);
    }
    if (payload?.type !== CONFIRM_SHORTEN_TYPE || !payload.tenantId) {
      throw new Error(INVALID_LINK_MESSAGE);
    }
    // 兼容旧链接：单 runId/kind 打成 targets[]
    if (!Array.isArray(payload.targets) || !payload.targets.length) {
      if (!payload.runId || !QUESTIONNAIRE_KINDS[payload.kind]) {
        throw new Error(INVALID_LINK_MESSAGE);
      }
      payload.targets = [
        {
          runId: String(payload.runId),
          kind: payload.kind,
          personId: payload.personId ? String(payload.personId) : null,
          questionnaireVersion: payload.questionnaireVersion
        }
      ];
    }
    if (payload.targets.some(item => !item?.runId || !QUESTIONNAIRE_KINDS[item.kind])) {
      throw new Error(INVALID_LINK_MESSAGE);
    }
    return payload;
  };

  /** 免登录页：一次展示本批全部待确认问卷；每份各自确认 */
  const publicDetail = async ({ code }) => {
    const payload = await decode(code);
    const tenant = await services.shareReport.getTenant(payload.tenantId);
    const items = [];
    for (const target of payload.targets) {
      items.push(
        await buildItemDetail({
          tenantId: payload.tenantId,
          runId: target.runId,
          kind: target.kind,
          personId: target.personId,
          questionnaireVersion: target.questionnaireVersion
        })
      );
    }
    const first = items[0] || {};
    return {
      language: payload.language,
      companyName: tenant?.company?.name || tenant?.name || '',
      items,
      // 兼容旧前端字段（仅单份时有意义）
      kind: first.kind,
      roleName: first.roleName,
      personName: first.personName,
      outdated: first.outdated,
      stage: first.stage,
      confirmed: first.confirmed,
      notReached: first.notReached,
      rejected: first.rejected,
      rejectComment: first.rejectComment,
      rejectedAt: first.rejectedAt,
      deadline: first.deadline,
      confirmedAt: first.confirmedAt,
      questionnaire: first.questionnaire || [],
      interview: first.interview || []
    };
  };

  const resolveTarget = (payload, { key, runId, kind, personId }) =>
    payload.targets.find(item => targetKeyOf(item) === String(key || '')) ||
    payload.targets.find(item => String(item.runId) === String(runId) && item.kind === kind && String(item.personId || '') === String(personId || '')) ||
    (payload.targets.length === 1 ? payload.targets[0] : null);

  /** 免登录页提交确认：只确认本批中的一份；先到先得 */
  const publicConfirm = async ({ code, deadline, key, runId, kind, personId }) => {
    const payload = await decode(code);
    if (!payload.digitalId) {
      throw new Error('该确认链接缺少数字人，请联系管理员重新发送');
    }
    const target = resolveTarget(payload, { key, runId, kind, personId });
    if (!target) {
      throw new Error('确认目标不存在或不属于本链接');
    }
    const output = await services.readiness.confirmQuestionnaire({
      tenantId: payload.tenantId,
      runId: target.runId,
      kind: target.kind,
      personId: target.personId,
      questionnaireVersion: target.questionnaireVersion,
      deadline,
      digitalId: payload.digitalId,
      operator: { via: 'email', email: payload.email || '', name: payload.name || '' }
    });
    return { confirmedAt: output.confirmedAt, deadline: output.deadline, key: targetKeyOf(target) };
  };

  /** 免登录页驳回：须填写修改意见；不推进阶段，管理员可见意见后改题重发或自行确认 */
  const publicReject = async ({ code, comment, key, runId, kind, personId }) => {
    const payload = await decode(code);
    const target = resolveTarget(payload, { key, runId, kind, personId });
    if (!target) {
      throw new Error('确认目标不存在或不属于本链接');
    }
    const output = await services.readiness.rejectQuestionnaire({
      tenantId: payload.tenantId,
      runId: target.runId,
      kind: target.kind,
      personId: target.personId,
      questionnaireVersion: target.questionnaireVersion,
      comment,
      operator: { via: 'email', email: payload.email || '', name: payload.name || '' }
    });
    return { rejectedAt: output.rejectedAt, key: targetKeyOf(target) };
  };

  Object.assign(services, {
    readinessConfirm: { sendMails, publicDetail, publicConfirm, publicReject }
  });
});
