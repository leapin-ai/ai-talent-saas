const fp = require('fastify-plugin');
const dayjs = require('dayjs');
const utc = require('dayjs/plugin/utc');
const timezone = require('dayjs/plugin/timezone');
const { QUESTIONNAIRE_KINDS, inviteDeleteBlock, materialsFromProfileData } = require('../utils/readiness-stages');
const { createAdapter, NOT_READY_MESSAGE } = require('../utils/readiness-interview-adapter');
const { getApiBase } = require('../utils/aiInterviewOpenApi');
const { normalizeRecipients, groupItemsByEmail, isValidEmail } = require('../utils/readiness-send');
const { deadlineEndTime, DISPLAY_TZ } = require('../utils/readiness-publish');

dayjs.extend(utc);
dayjs.extend(timezone);

const VIDEO_TASK_TYPE = 'invite-video-asr';
const VIDEO_TARGET_TYPE = 'readiness-stage';
const MAIL_LANGUAGES = ['zh-CN', 'en-US'];

const trimSlash = value => String(value || '').replace(/\/+$/, '');

module.exports = fp(async (fastify, options) => {
  const { models, services } = fastify[options.name];
  const { Op } = fastify.sequelize.Sequelize;
  const idOrNull = value => (value == null || value === '' ? null : String(value));

  const resolveInviteOrigin = async tenantId => {
    const setting = await services.aiInterview.detail({ tenantId });
    if (!setting?.apiUrl) {
      throw new Error('未配置 AI 面试地址，无法生成问卷链接');
    }
    return trimSlash(services.aiInterview.getAjaxBaseUrl(setting.apiUrl));
  };

  /** 补充问卷仍直达 AI 面试免登录页；经理/员工走采集页 */
  const buildInterviewInviteUrl = (origin, shorten) => `${origin}/invite?nl=${encodeURIComponent(shorten)}`;

  /** 经理/员工：复用人才采集免登录页（员工含简历/项目经历） */
  const usesCollectProfile = kind => kind === 'manager' || kind === 'staff';

  /** 手填的截止日期 → 当天 23:59:59.999（UTC+8）的毫秒时间戳；留空返回 null，已过期报错 */
  const overrideExpires = deadline => {
    if (deadline == null || deadline === '') {
      return null;
    }
    const expires = dayjs(deadlineEndTime(deadline)).valueOf();
    if (!(expires > Date.now())) {
      throw new Error('有效期已过，请选择今天或之后的日期');
    }
    return expires;
  };

  /** 问卷项目（AI 面试项目）的有效期，毫秒时间戳；邀请链接的有效期不得晚于它 */
  const projectExpires = async ({ tenantId, projectId }) => {
    const project = await services.aiInterview.getProjectDetail({ tenantId, id: projectId });
    const expires = project?.endTime ? dayjs(project.endTime).valueOf() : NaN;
    if (!Number.isFinite(expires)) {
      throw new Error('无法获取问卷项目的有效期');
    }
    if (expires <= Date.now()) {
      throw new Error('问卷项目已过期，请回退到“确认问卷”重新确认');
    }
    return expires;
  };

  const subjectOf = ({ companyName, count, language }) => {
    const prefix = companyName ? `${companyName} ` : '';
    return language === 'zh-CN' ? `${prefix}岗位就绪度问卷（${count} 个岗位）` : `${prefix}Role Readiness Questionnaire (${count} role${count > 1 ? 's' : ''})`;
  };

  /** 确认后「发布」阶段的产出：AI 面试项目 ID、截止日期、对应问卷版本 */
  const currentPublish = async ({ run, kind, personId }) => {
    const info = QUESTIONNAIRE_KINDS[kind];
    const row = await models.readinessStageData.findOne({
      where: { runId: String(run.id), stage: info.publishStage, personId: idOrNull(info.scope === 'person' ? personId : null), isCurrent: true, status: 'succeeded' }
    });
    const output = row?.output;
    return output?.projectId ? { projectId: String(output.projectId), version: output.questionnaireVersion ?? null, deadline: output.deadline || null } : null;
  };

  /** Role 级可发送性：给出跳过原因，空表示可发 */
  const runSkipReason = ({ kind, run, persons, hasExtra }) => {
    if (kind === 'manager') {
      return run.stage === 'manager_send' ? '' : `经理问卷尚未确认或已发送（当前阶段：${run.stage}）`;
    }
    if (kind === 'staff') {
      if (!run.hasStaffQuestionnaire) {
        return '该流程不使用员工问卷';
      }
      if (!['staff_send', 'await_persons'].includes(run.stage)) {
        return `员工问卷尚未确认（当前阶段：${run.stage}）`;
      }
      return hasExtra || persons.some(person => person.stage === 'pending') ? '' : '没有待发送的参与人';
    }
    return persons.some(person => person.stage === 'reassess_send') ? '' : '没有需要复评问卷的参与人';
  };

  /**
   * 收件人里选择的租户成员（tenantUserId，来自 admin 的 TenantUserSelect）：补全姓名、邮箱，并带上其关联的员工 ID。
   * 邮箱取租户用户的邮箱，没有则取关联员工的邮箱（租户用户允许只填手机号）。
   * 成员不存在或不属于该租户、或两处都没有邮箱的，放进 unresolved 返回给前端提示，不静默丢弃
   */
  const resolveTenantUsers = async (tenantId, recipients) => {
    const list = Array.isArray(recipients) ? recipients : [];
    const ids = [...new Set(list.filter(item => item?.tenantUserId).map(item => String(item.tenantUserId)))];
    if (!ids.length) {
      return { list, unresolved: [] };
    }
    const users = await fastify.tenant.models.user.findAll({ where: { id: { [Op.in]: ids }, tenantId }, attributes: ['id', 'name', 'email'] });
    const employees = await models.employee.findAll({ where: { tenantUserId: { [Op.in]: ids }, tenantId }, attributes: ['id', 'tenantUserId', 'email'] });
    const userMap = new Map(users.map(user => [String(user.id), user]));
    const employeeMap = new Map(employees.map(item => [String(item.tenantUserId), item]));
    const unresolved = [];
    const resolved = list.flatMap(item => {
      if (!item?.tenantUserId) {
        return [item];
      }
      const key = String(item.tenantUserId);
      const user = userMap.get(key);
      const employee = employeeMap.get(key);
      const name = user?.name || employee?.name || item.name || '';
      const email = String(user?.email || employee?.email || '').trim();
      if (!user) {
        unresolved.push({ name, email: '', reason: '成员不存在' });
        return [];
      }
      if (!email) {
        unresolved.push({ name, email: '', reason: '未填写邮箱' });
        return [];
      }
      return [{ name, email, employeeId: employee ? String(employee.id) : item.employeeId }];
    });
    return { list: resolved, unresolved };
  };

  const emailKey = value =>
    String(value || '')
      .trim()
      .toLowerCase();

  /**
   * 员工问卷额外添加的收件人（选择的员工 / 手填的姓名邮箱）：按邮箱对应到流程里已有的参与人，没有则新增为参与人。
   * create=false（预览）时不落库，只给出虚拟参与人（没有 id）。返回补充后的参与人列表
   */
  const withExtraPersons = async ({ tenantId, run, persons, recipients, create }) => {
    const known = new Set(persons.map(person => emailKey(person.email)));
    const fresh = recipients.filter(item => !known.has(item.email));
    if (!fresh.length) {
      return persons;
    }
    const employeeIds = fresh.map(item => item.employeeId).filter(Boolean);
    const employees = create && employeeIds.length ? await models.employee.findAll({ where: { id: { [Op.in]: employeeIds }, tenantId } }) : [];
    const employeeSet = new Set(employees.map(item => String(item.id)));
    const added = [];
    for (const item of fresh) {
      const values = {
        tenantId,
        runId: String(run.id),
        employeeId: item.employeeId && employeeSet.has(item.employeeId) ? item.employeeId : null,
        name: item.name,
        email: item.email,
        respondentType: 'employee',
        stage: 'pending',
        materials: { resume: '', projects: '', reviews: '' }
      };
      added.push(create ? await models.readinessRunPerson.create(values) : Object.assign({}, values, { virtual: true }));
    }
    return [...persons, ...added];
  };

  /**
   * 每个可发 Role 的发送对象：{ run, person|null, name, email }
   * - manager：收件人即发送对象
   * - staff / reassess：待发送阶段的参与人；personIds 传了就只发这些（空数组表示都不发），不传则全部；
   *   staff 里额外添加的收件人（recipients）无论是否在 personIds 里都会发
   */
  const buildTargets = ({ kind, run, persons, recipients, personIds }) => {
    if (kind === 'manager') {
      return { targets: recipients.map(item => ({ run, person: null, name: item.name, email: item.email })), skippedPersons: [] };
    }
    const stage = kind === 'staff' ? 'pending' : 'reassess_send';
    const filter = Array.isArray(personIds) ? new Set(personIds.map(String)) : null;
    const extra = kind === 'staff' ? new Set(recipients.map(item => item.email)) : new Set();
    const candidates = persons.filter(person => person.stage === stage && (!filter || filter.has(String(person.id)) || extra.has(emailKey(person.email))));
    const targets = [];
    const skippedPersons = [];
    candidates.forEach(person => {
      if (!isValidEmail(person.email)) {
        skippedPersons.push({ runId: String(run.id), personId: String(person.id), name: person.name, reason: '未填写有效邮箱' });
        return;
      }
      targets.push({ run, person, name: person.name, email: emailKey(person.email) });
    });
    kind === 'staff' &&
      recipients.forEach(item => {
        const own = persons.find(person => emailKey(person.email) === item.email);
        if (own && own.stage !== stage) {
          skippedPersons.push({ runId: String(run.id), personId: String(own.id), name: own.name, reason: '该参与人已发送过问卷' });
        }
      });
    return { targets, skippedPersons };
  };

  const loadRuns = async ({ tenantId, runIds }) => {
    const ids = [...new Set((runIds || []).map(String))];
    const runs = ids.length ? await models.readinessRun.findAll({ where: { id: { [Op.in]: ids }, tenantId } }) : [];
    const persons = ids.length ? await models.readinessRunPerson.findAll({ where: { runId: { [Op.in]: ids }, tenantId }, order: [['id', 'ASC']] }) : [];
    const personMap = new Map();
    persons.forEach(person => {
      const key = String(person.runId);
      personMap.set(key, [...(personMap.get(key) || []), person]);
    });
    const found = new Set(runs.map(run => String(run.id)));
    return { runs, personMap, missing: ids.filter(id => !found.has(id)).map(id => ({ runId: id, roleName: '', reason: '流程不存在' })) };
  };

  /**
   * 发送计划：优先用 items（每个 run 各自收件人）；否则把共用 recipients/personIds 铺到全部 runIds。
   * items: [{ runId, recipients, personIds }]
   */
  const expandSendPlans = ({ runIds, recipients, personIds, items }) => {
    if (Array.isArray(items) && items.length) {
      return items.map(item => ({
        runId: String(item.runId),
        recipients: Array.isArray(item.recipients) ? item.recipients : [],
        personIds: item.personIds
      }));
    }
    const sharedRecipients = Array.isArray(recipients) ? recipients : [];
    return (runIds || []).map(id => ({ runId: String(id), recipients: sharedRecipients, personIds }));
  };

  const resolvePlanRecipients = async (tenantId, plan, kind) => {
    const resolved = await resolveTenantUsers(tenantId, plan.recipients);
    const normalized = normalizeRecipients(resolved.list);
    if (kind === 'manager' && normalized.valid.length > 1) {
      throw new Error('经理问卷最多只能发送给一位收件人');
    }
    return { normalized, unresolved: resolved.unresolved };
  };

  /** 预览：各 Role 是否可发、发给谁；不产生任何副作用。支持 items 按 run 各自指定收件人。 */
  const preview = async ({ tenantId }, body = {}) => {
    const { kind } = body;
    if (!QUESTIONNAIRE_KINDS[kind]) {
      throw new Error('问卷类型不正确');
    }
    const plans = expandSendPlans(body);
    const planMap = new Map(plans.map(item => [item.runId, item]));
    const runIds = plans.map(item => item.runId);
    const { runs, personMap, missing } = await loadRuns({ tenantId, runIds });
    const invalidRecipients = [];
    const skippedPersons = [];
    const eligibleItems = [];
    const skipped = [...missing];

    for (const run of runs) {
      const plan = planMap.get(String(run.id)) || { runId: String(run.id), recipients: [], personIds: undefined };
      const { normalized, unresolved } = await resolvePlanRecipients(tenantId, plan, kind);
      invalidRecipients.push(...normalized.invalid, ...unresolved);
      const hasExtra = kind === 'staff' && normalized.valid.length > 0;
      const reason = runSkipReason({ kind, run, persons: personMap.get(String(run.id)) || [], hasExtra });
      if (reason) {
        skipped.push({ runId: String(run.id), roleName: run.roleName, reason });
        continue;
      }
      const persons = kind === 'staff' ? await withExtraPersons({ tenantId, run, persons: personMap.get(String(run.id)) || [], recipients: normalized.valid, create: false }) : personMap.get(String(run.id)) || [];
      const result = buildTargets({ kind, run, persons, recipients: normalized.valid, personIds: plan.personIds });
      skippedPersons.push(...result.skippedPersons);
      eligibleItems.push({
        runId: String(run.id),
        roleName: run.roleName,
        targets: result.targets.map(item => ({ name: item.name, email: item.email, personId: item.person?.id ? String(item.person.id) : null }))
      });
    }
    return { eligible: eligibleItems, skipped, skippedPersons, invalidRecipients };
  };

  /** 发送弹窗的默认截止日期：取选中 Role 已发布问卷项目中最早的有效期，返回 UTC+8 日期（YYYY-MM-DD）；没有可用项目时为 null */
  const sendDefaults = async ({ tenantId }, { kind, runIds }) => {
    const info = QUESTIONNAIRE_KINDS[kind];
    if (!info) {
      throw new Error('问卷类型不正确');
    }
    const { runs } = await loadRuns({ tenantId, runIds });
    if (!runs.length) {
      return { deadline: null };
    }
    const rows = await models.readinessStageData.findAll({
      where: { runId: { [Op.in]: runs.map(run => String(run.id)) }, stage: info.publishStage, isCurrent: true, status: 'succeeded' }
    });
    const projectIds = [
      ...new Set(
        rows
          .map(row => row.output?.projectId)
          .filter(Boolean)
          .map(String)
      )
    ];
    let earliest = null;
    for (const projectId of projectIds) {
      try {
        const expires = await projectExpires({ tenantId, projectId });
        earliest = earliest == null ? expires : Math.min(earliest, expires);
      } catch (e) {
        // 取不到或已过期的项目不作为默认值；真正发送时会给出具体原因
      }
    }
    return { deadline: earliest == null ? null : dayjs(earliest).tz(DISPLAY_TZ).format('YYYY-MM-DD') };
  };

  const markInvites = async (invites, patch) => {
    for (const invite of invites) {
      await invite.update(patch);
    }
  };

  /** 同一邮箱一封邮件，列出其所有 Role 的链接 */
  const sendGroupedMails = async ({ tenantId, entries, language }) => {
    const tenant = await services.shareReport.getTenant(tenantId);
    const groups = groupItemsByEmail(entries.map(entry => ({ email: entry.email, name: entry.name, runId: entry.runId, roleName: entry.roleName, url: entry.url })));
    const sent = [];
    const failed = [];
    for (const group of groups) {
      const related = entries.filter(entry => entry.email === group.email);
      const context = services.shareReport.buildMailContext(tenant, language, Math.min(...related.map(entry => entry.expires)));
      try {
        await services.shareReport.sendMail({
          email: group.email,
          code: `READINESSQUESTIONNAIRE[${language}]`,
          subject: subjectOf({ companyName: context.companyName, count: group.items.length, language }),
          props: Object.assign({}, context, { items: group.items, recipientName: group.name })
        });
        await markInvites(
          related.map(entry => entry.invite),
          { status: 'sent', error: null }
        );
        sent.push({ email: group.email, roles: group.items.map(item => item.name) });
      } catch (e) {
        await markInvites(
          related.map(entry => entry.invite),
          { status: 'failed', error: e.message || '发送失败' }
        );
        failed.push({ email: group.email, roles: group.items.map(item => item.name), reason: e.message || '发送失败' });
      }
    }
    return { sent, failed };
  };

  /**
   * 批量发送：Role 之间互相独立。可发的 Role 照常发送并推进，未确认/无对象的 Role 只被跳过并如实返回，不影响其它 Role。
   * 同一收件邮箱只发一封邮件，包含其涉及的所有 Role 链接（经理/员工为采集页，补充问卷为 AI 面试页）。
   */
  const send = async ({ tenantId, userId }, body = {}) => {
    const { kind, language, deadline } = body;
    const info = QUESTIONNAIRE_KINDS[kind];
    if (!info) {
      throw new Error('问卷类型不正确');
    }
    const mailLanguage = MAIL_LANGUAGES.includes(language) ? language : 'zh-CN';
    const plans = expandSendPlans(body);
    const planMap = new Map(plans.map(item => [item.runId, item]));
    const runIds = plans.map(item => item.runId);
    // 手填截止日期时先整体校验；它只能把链接有效期往前缩，不会超过问卷项目的有效期；留空则取项目有效期
    const earlier = overrideExpires(deadline);
    const { runs, personMap, missing } = await loadRuns({ tenantId, runIds });
    const result = { skipped: [...missing], skippedPersons: [], sent: [], failed: [], advanced: [], advanceFailed: [], batchId: null };

    const eligible = [];
    for (const run of runs) {
      const plan = planMap.get(String(run.id)) || { runId: String(run.id), recipients: [], personIds: undefined };
      const { normalized } = await resolvePlanRecipients(tenantId, plan, kind);
      if (kind === 'manager' && !normalized.valid.length) {
        result.skipped.push({ runId: String(run.id), roleName: run.roleName, reason: '请至少填写一个有效的收件人邮箱' });
        continue;
      }
      const hasExtra = kind === 'staff' && normalized.valid.length > 0;
      const reason = runSkipReason({ kind, run, persons: personMap.get(String(run.id)) || [], hasExtra });
      if (reason) {
        result.skipped.push({ runId: String(run.id), roleName: run.roleName, reason });
        continue;
      }
      eligible.push({ run, plan, normalized });
    }
    if (!eligible.length) {
      return result;
    }

    const collectFlow = usesCollectProfile(kind);
    const interviewOrigin = collectFlow ? null : await resolveInviteOrigin(tenantId);
    const entries = [];
    const runEntries = new Map();

    for (const { run, plan, normalized } of eligible) {
      // 员工问卷里额外添加的收件人先落成流程参与人（有 id 才能记录答卷、推进阶段）
      const persons = kind === 'staff' ? await withExtraPersons({ tenantId, run, persons: personMap.get(String(run.id)) || [], recipients: normalized.valid, create: true }) : personMap.get(String(run.id)) || [];
      const { targets, skippedPersons } = buildTargets({ kind, run, persons, recipients: normalized.valid, personIds: plan.personIds });
      result.skippedPersons.push(...skippedPersons);
      if (!targets.length) {
        result.skipped.push({ runId: String(run.id), roleName: run.roleName, reason: '没有可发送的对象' });
        continue;
      }
      try {
        // 项目已在确认后的发布阶段建好并开启；同一 Role 的邀请共用一个项目，reassess 按人各自一份
        const groups = new Set(targets.map(target => (target.person && info.scope === 'person' ? String(target.person.id) : '_')));
        const projectIds = new Map();
        let runExpires = null;
        for (const key of groups) {
          const publish = await currentPublish({ run, kind, personId: key === '_' ? null : key });
          if (!publish) {
            throw new Error('问卷尚未发布到 AI 面试，请回退到“确认问卷”重新确认');
          }
          projectIds.set(key, publish);
          const projectEnd = await projectExpires({ tenantId, projectId: publish.projectId });
          const publishExpires = earlier == null ? projectEnd : Math.min(earlier, projectEnd);
          runExpires = runExpires == null ? publishExpires : Math.min(runExpires, publishExpires);
        }
        const runResult = [];
        for (const target of targets) {
          const key = target.person && info.scope === 'person' ? String(target.person.id) : '_';
          const { projectId, version } = projectIds.get(key);
          await models.readinessInvite.update({ isCurrent: false }, { where: { runId: String(run.id), kind, personId: idOrNull(target.person?.id), email: target.email, isCurrent: true } });
          try {
            let url;
            let inviteId = null;
            let shorten = null;
            let collectInviteId = null;
            if (collectFlow) {
              // 经理/员工：先发采集免登录链；AI 面试邀请在采集页进入面试步时再创建
              if (!services.talentCollectInvite?.createForReadiness) {
                throw new Error('采集邀请服务未就绪');
              }
              const collect = await services.talentCollectInvite.createForReadiness({
                tenantId,
                inviteType: kind === 'manager' ? 'manager' : 'employee',
                positionId: run.positionId,
                name: target.name,
                email: target.email,
                projectId,
                projectName: run.roleName || '',
                language: run.language || mailLanguage,
                expiresAt: runExpires
              });
              url = collect.inviteUrl;
              collectInviteId = collect.invite?.id ? String(collect.invite.id) : null;
            } else {
              const invite = await services.aiInterview.inviteCandidate({
                tenantId,
                projectId,
                name: target.name,
                email: target.email,
                description: `Readiness / ${kind} / run:${run.id}`,
                expires: dayjs(runExpires).toISOString(),
                needLoginShorten: true,
                needNotice: false
              });
              if (!invite?.shorten) {
                throw new Error('AI 面试系统未返回免登录 shorten');
              }
              url = buildInterviewInviteUrl(interviewOrigin, invite.shorten);
              inviteId = invite.inviteId ? String(invite.inviteId) : null;
              shorten = invite.shorten;
            }
            const row = await models.readinessInvite.create({
              tenantId,
              runId: String(run.id),
              personId: idOrNull(target.person?.id),
              kind,
              questionnaireVersion: version,
              name: target.name,
              email: target.email,
              projectId: String(projectId),
              collectInviteId,
              inviteId,
              shorten,
              url,
              expiresAt: new Date(runExpires),
              status: 'pending',
              isCurrent: true
            });
            if (collectInviteId && services.talentCollectInvite?.bindReadinessInvite) {
              await services.talentCollectInvite.bindReadinessInvite({ collectInviteId, readinessInviteId: String(row.id), tenantId });
            }
            const entry = { email: target.email, name: target.name, runId: String(run.id), roleName: run.roleName, url, invite: row, person: target.person, expires: runExpires };
            entries.push(entry);
            runResult.push(entry);
          } catch (e) {
            result.failed.push({ runId: String(run.id), roleName: run.roleName, email: target.email, reason: e.message || '创建邀请失败' });
          }
        }
        runEntries.set(String(run.id), { run, entries: runResult });
      } catch (e) {
        result.skipped.push({ runId: String(run.id), roleName: run.roleName, reason: e.message || '准备问卷失败' });
      }
    }

    if (entries.length) {
      const mailResult = await sendGroupedMails({ tenantId, entries, language: mailLanguage });
      result.sent = mailResult.sent;
      result.failed.push(...mailResult.failed);
    }

    const batch = await models.readinessSendBatch.create({
      tenantId,
      kind,
      runIds: [...runEntries.keys()],
      recipients: [...new Set(entries.map(entry => entry.email))],
      subject: subjectOf({ companyName: '', count: runEntries.size, language: mailLanguage }),
      result: { sent: result.sent, failed: result.failed, skipped: result.skipped },
      createdUserId: idOrNull(userId)
    });
    result.batchId = String(batch.id);

    // 每个 Role 独立推进：邀请已创建即推进（含邮件失败；失败可重发/复制链接，不算发送步骤失败）
    for (const { run, entries: list } of runEntries.values()) {
      const ready = list.filter(entry => ['sent', 'failed'].includes(entry.invite.status));
      if (!ready.length) {
        continue;
      }
      try {
        const output = {
          batchId: String(batch.id),
          recipients: ready.map(entry => entry.email),
          sentAt: new Date().toISOString(),
          mailFailed: ready.filter(entry => entry.invite.status === 'failed').map(entry => entry.email)
        };
        if (kind === 'manager') {
          await services.readiness.completeSend({ run, kind, output, userId });
        } else {
          const done = new Set();
          for (const entry of ready) {
            const personId = String(entry.person.id);
            if (!done.has(personId)) {
              done.add(personId);
              await services.readiness.completeSend({ run, kind, personId, output, userId });
            }
          }
        }
        result.advanced.push(String(run.id));
      } catch (e) {
        result.advanceFailed.push({ runId: String(run.id), roleName: run.roleName, reason: e.message || '推进阶段失败' });
      }
    }
    return result;
  };

  /**
   * 删除问卷邀请（软删除）：staff / reassess 的邀请同时删除对应参与人。
   * 邀请对应的阶段已过（参与人已提交答卷、经理问卷已越过回收答卷）的不删，原因放在 skipped 里返回，避免丢失已收回的答卷
   */
  const deleteInvites = async ({ tenantId }, { inviteIds }) => {
    const ids = [...new Set((inviteIds || []).map(String))];
    if (!ids.length) {
      throw new Error('请选择要删除的邀请');
    }
    const invites = await models.readinessInvite.findAll({ where: { id: { [Op.in]: ids }, tenantId, isCurrent: true } });
    const result = { deleted: [], skipped: [] };
    const runs = await models.readinessRun.findAll({ where: { id: { [Op.in]: [...new Set(invites.map(item => String(item.runId)))] }, tenantId } });
    const runMap = new Map(runs.map(run => [String(run.id), run]));
    await fastify.sequelize.transaction(async transaction => {
      for (const invite of invites) {
        const person = invite.personId ? await models.readinessRunPerson.findOne({ where: { id: String(invite.personId), runId: String(invite.runId), tenantId }, transaction }) : null;
        const reason = inviteDeleteBlock({ invite, run: runMap.get(String(invite.runId)), person });
        if (reason) {
          result.skipped.push({ inviteId: String(invite.id), name: person?.name || invite.name, reason });
          continue;
        }
        await invite.destroy({ transaction });
        if (person) {
          await person.destroy({ transaction });
        }
        result.deleted.push(String(invite.id));
      }
    });
    return result;
  };

  /** 重发邮件：沿用原链接（未过期的 sent/failed 邀请），同邮箱合并成一封 */
  const resend = async ({ tenantId, userId }, { inviteIds, language }) => {
    const ids = (inviteIds || []).map(String);
    if (!ids.length) {
      throw new Error('请选择要重发的邀请');
    }
    const invites = await models.readinessInvite.findAll({ where: { id: { [Op.in]: ids }, tenantId, isCurrent: true, status: { [Op.in]: ['sent', 'failed'] } } });
    const runs = await models.readinessRun.findAll({ where: { id: { [Op.in]: [...new Set(invites.map(item => String(item.runId)))] }, tenantId } });
    const runMap = new Map(runs.map(run => [String(run.id), run]));
    const valid = invites.filter(item => item.url && (!item.expiresAt || dayjs(item.expiresAt).isAfter(dayjs())));
    if (!valid.length) {
      throw new Error('没有可重发的邀请（可能已过期，请重新发送）');
    }
    const entries = valid.map(item => ({
      email: String(item.email).toLowerCase(),
      name: item.name,
      runId: String(item.runId),
      roleName: runMap.get(String(item.runId))?.roleName || '',
      url: item.url,
      invite: item,
      expires: item.expiresAt ? dayjs(item.expiresAt).valueOf() : 0
    }));
    const mailResult = await sendGroupedMails({ tenantId, entries, language: MAIL_LANGUAGES.includes(language) ? language : 'zh-CN' });
    // 仍停在发送阶段时：邀请已在即推进（与 send 一致，不因邮件失败卡住）
    const advanced = new Set();
    for (const invite of valid) {
      const run = runMap.get(String(invite.runId));
      const info = QUESTIONNAIRE_KINDS[invite.kind];
      if (!run || !info || run.stage !== info.sendStage) {
        continue;
      }
      const advanceKey = invite.kind === 'manager' ? `manager:${invite.runId}` : `${invite.kind}:${invite.runId}:${invite.personId}`;
      if (advanced.has(advanceKey) || (invite.kind !== 'manager' && !invite.personId)) {
        continue;
      }
      try {
        await services.readiness.completeSend({
          run,
          kind: invite.kind,
          personId: invite.kind === 'manager' ? undefined : String(invite.personId),
          output: { resend: true, recipients: [invite.email], sentAt: new Date().toISOString() },
          userId
        });
        advanced.add(advanceKey);
        // manager 推进后 Role 离开 sendStage；同批其它 manager 邀请跳过
        if (invite.kind === 'manager') {
          run.stage = info.answersStage;
        }
      } catch (e) {
        // 已推进或不在发送阶段时忽略
      }
    }
    return mailResult;
  };

  /** 采集页填写的简历 / 项目经历（talentCollectInvite.profileData） */
  const loadCollectProfile = async invite => {
    if (!invite?.collectInviteId || !models.talentCollectInvite) {
      return null;
    }
    const collect = await models.talentCollectInvite.findByPk(String(invite.collectInviteId));
    const profileData = collect?.profileData;
    if (!profileData || typeof profileData !== 'object' || !Object.keys(profileData).length) {
      return null;
    }
    return profileData;
  };

  /** 已回收答卷补写采集档案（历史同步可能尚未带上），并回填 person.materials */
  const attachProfileData = async invite => {
    const profileData = await loadCollectProfile(invite);
    if (!profileData) {
      return false;
    }
    const materials = materialsFromProfileData(profileData);
    if (materials && invite.personId) {
      const person = await models.readinessRunPerson.findByPk(String(invite.personId));
      if (person && !(person.materials?.resume || person.materials?.projects || person.materials?.reviews)) {
        await person.update({ materials: Object.assign({ resume: '', projects: '', reviews: '' }, person.materials || {}, materials) });
      }
    }
    const row = await findAnswersRow(invite);
    if (!row || row.output?.profileData) {
      return false;
    }
    await row.update({ output: Object.assign({}, row.output, { profileData }) });
    return true;
  };

  /** 从 AI 面试回收答卷并推进阶段；同一邀请已回收过则忽略 */
  /** 同一份问卷答卷的 JSON 比较（键顺序无关；jsonb 读出时键顺序可能变化） */
  const sameAnswers = (a, b) => {
    const sortKeys = obj =>
      Object.keys(obj || {})
        .sort()
        .reduce((acc, key) => Object.assign(acc, { [key]: obj[key] }), {});
    return JSON.stringify(sortKeys(a)) === JSON.stringify(sortKeys(b));
  };

  const findAnswersRow = invite =>
    models.readinessStageData.findOne({
      where: { runId: String(invite.runId), stage: QUESTIONNAIRE_KINDS[invite.kind].answersStage, personId: idOrNull(invite.personId), isCurrent: true, status: 'succeeded' }
    });

  const videoSignature = list => (list || []).map(item => [item.questionId, !!item.submitted, (item.fileIds || []).join(',')].join('|')).join(';');

  /** 视频题还需处理的数量：录像还没转存到本仓文件系统，或还没转写 */
  const pendingVideoCount = row => (row?.output?.videoAnswers || []).filter(item => item.fileIds?.length && ((item.files || []).length < item.fileIds.length || !item.asrDone)).length;

  /** 修改当前阶段数据里某一道视频题（重新读库，避免覆盖其它并发改动） */
  const patchVideo = async (rowId, questionId, update) => {
    const row = await models.readinessStageData.findOne({ where: { id: String(rowId) } });
    if (!row) {
      return;
    }
    const videoAnswers = (row.output?.videoAnswers || []).map(item => (item.questionId === questionId ? update(item) : item));
    await row.update({ output: Object.assign({}, row.output, { videoAnswers }) });
  };

  /**
   * 视频题后续处理：
   * 1. 录像按 AI 面试的真实地址转存到本仓文件系统（files: [{ sourceId, fileId }]）
   * 2. 创建 invite-video-asr 任务做转写（该任务只转写；结果在 onVideoAsrSuccess / onVideoAsrFailed 里写回 transcript）
   * 同一行已有进行中的转写任务则不重复创建
   */
  const startVideoTask = async (tenantId, row) => {
    const targetId = String(row.id);
    for (const video of row.output?.videoAnswers || []) {
      for (const sourceId of video.fileIds || []) {
        if ((video.files || []).some(file => file.sourceId === sourceId)) {
          continue;
        }
        try {
          const fileId = String(await services.aiInterview.transferFile({ tenantId: String(tenantId), id: sourceId }));
          await patchVideo(targetId, video.questionId, item => Object.assign({}, item, { files: [...(item.files || []).filter(file => file.sourceId !== sourceId), { sourceId, fileId }], error: undefined }));
        } catch (e) {
          await patchVideo(targetId, video.questionId, item => Object.assign({}, item, { error: `录像转存失败：${e.message}` }));
        }
      }
    }
    await row.reload();
    const jobs = (row.output?.videoAnswers || []).filter(video => video.fileIds?.length && !video.asrDone).map(video => ({ questionId: video.questionId, fileIds: video.fileIds, probeIndex: null }));
    if (!jobs.length) {
      return null;
    }
    const running = await fastify.task.models.task.findOne({ where: { type: VIDEO_TASK_TYPE, targetType: VIDEO_TARGET_TYPE, targetId, status: { [Op.in]: ['pending', 'running'] } } });
    if (running) {
      return running;
    }
    const run = await models.readinessRun.findByPk(row.runId);
    const person = row.personId ? await models.readinessRunPerson.findByPk(row.personId) : null;
    const task = await fastify.task.services.create({
      type: VIDEO_TASK_TYPE,
      targetId,
      targetType: VIDEO_TARGET_TYPE,
      runnerType: 'system',
      input: { name: `视频题转写：${run?.roleName || ''}${person ? ` / ${person.name}` : ''}（${jobs.length} 题）`, tenantId: String(tenantId), stageDataId: targetId, jobs }
    });
    fastify.task.services
      .claimTask(task)
      .then(claimed => (claimed ? fastify.task.services.processSystemTask(claimed, { claimed: true }) : null))
      .catch(e => fastify.log.error(`readiness video task ${task.id} run failed: ${e.message}`));
    return task;
  };

  /** invite-video-asr 转写成功（targetType=readiness-stage）：把转写文本写回对应视频题 */
  const onVideoAsrSuccess = async ({ task, result }) => {
    const { stageDataId } = task.input || {};
    const transcripts = result?.videoTranscripts || {};
    for (const questionId of Object.keys(transcripts)) {
      const entry = transcripts[questionId];
      const text = [entry?.text, ...(entry?.probes || []).map(probe => probe?.text)].filter(Boolean).join('\n');
      await patchVideo(stageDataId, questionId, item => Object.assign({}, item, { transcript: item.transcript || text, asrDone: true, error: result?.errors?.some(err => err.questionId === questionId) ? '部分录像转写失败' : undefined }));
    }
    return result;
  };

  /** invite-video-asr 转写失败（targetType=readiness-stage）：记在对应视频题上，下次「获取结果」会重新创建任务 */
  const onVideoAsrFailed = async ({ task, error }) => {
    const { stageDataId, jobs } = task.input || {};
    for (const job of jobs || []) {
      await patchVideo(stageDataId, job.questionId, item => Object.assign({}, item, { error: `视频转写失败：${error?.message || error}` }));
    }
  };

  /**
   * 已回收过的邀请：把视频题作答合并到对应的当前阶段数据上（须与已保存的问卷答卷是同一份提交）
   * 返回 { changed: 新增/变化的视频题数, pending: 还在转存/转写的视频题数 }
   */
  const attachVideoAnswers = async ({ tenantId, invite, item }) => {
    const none = { changed: 0, pending: 0 };
    if (!item.videoAnswers?.length) {
      return none;
    }
    const row = await findAnswersRow(invite);
    if (!row || !sameAnswers(row.output?.answers, item.answers)) {
      return none;
    }
    const existing = row.output?.videoAnswers || [];
    const merged = item.videoAnswers.map(video => {
      const old = existing.find(entry => entry.questionId === video.questionId);
      return old ? Object.assign({}, video, { transcript: old.transcript || video.transcript, files: old.files, asrDone: old.asrDone, error: old.error }) : video;
    });
    const changed = videoSignature(merged) === videoSignature(existing) ? 0 : merged.length;
    if (changed) {
      await row.update({ output: Object.assign({}, row.output, { videoAnswers: merged }) });
      await row.reload();
    }
    const pending = pendingVideoCount(row);
    if (pending) {
      await startVideoTask(tenantId, row);
    }
    return { changed, pending };
  };

  /**
   * 从 AI 面试回收答卷（问卷 + 视频题）：
   * - 新回收的（sent / failed）：邮件失败但链接已作答的也要收；标记为 answered，保存到当前阶段（不推进）
   * - 已回收的（answered）：若之前没有带上视频题作答，补充进去
   */
  const syncAnswers = async ({ tenantId }, { runId } = {}) => {
    const where = { tenantId, isCurrent: true, status: { [Op.in]: ['sent', 'failed', 'answered'] }, projectId: { [Op.ne]: null } };
    if (runId) {
      where.runId = String(runId);
    }
    const invites = await models.readinessInvite.findAll({ where });
    if (!invites.length) {
      return { checked: 0, collected: 0, saved: 0, video: 0, transcribing: 0, failed: [] };
    }
    const adapter = createAdapter({ services });
    const byProject = new Map();
    invites.forEach(invite => byProject.set(invite.projectId, [...(byProject.get(invite.projectId) || []), invite]));
    const summary = { checked: invites.length, collected: 0, saved: 0, video: 0, transcribing: 0, failed: [] };
    for (const [projectId, list] of byProject.entries()) {
      const answered = await adapter.collectAnswers({
        tenantId,
        projectId,
        invites: list.map(item => ({ inviteId: item.inviteId, shorten: item.shorten, email: item.email }))
      });
      for (const item of answered || []) {
        const invite =
          list.find(row => row.shorten && item.shorten && String(row.shorten) === String(item.shorten)) ||
          list.find(row => row.email && item.email && String(row.email).toLowerCase() === String(item.email).toLowerCase()) ||
          list.find(row => row.inviteId && item.inviteId && String(row.inviteId) === String(item.inviteId));
        if (!invite) {
          continue;
        }
        if (invite.status === 'answered') {
          const attached = await attachVideoAnswers({ tenantId, invite, item });
          summary.video += attached.changed;
          summary.transcribing += attached.pending;
          await attachProfileData(invite);
          continue;
        }
        await invite.update({ status: 'answered', answers: item.answers, answeredAt: new Date() });
        summary.collected += 1;
        try {
          const profileData = await loadCollectProfile(invite);
          await services.readiness.saveAnswers({ tenantId, userId: null }, { runId: invite.runId, kind: invite.kind, personId: invite.personId, answers: item.answers, videoAnswers: item.videoAnswers, profileData });
          summary.saved += 1;
          summary.video += (item.videoAnswers || []).length;
          if (item.videoAnswers?.length) {
            const row = await findAnswersRow(invite);
            const pending = pendingVideoCount(row);
            if (pending) {
              summary.transcribing += pending;
              await startVideoTask(tenantId, row);
            }
          }
        } catch (e) {
          // 经理问卷多个收件人时，只保留先回收到的一份，其余记为失败项
          summary.failed.push({ inviteId: String(invite.id), reason: e.message });
        }
      }
    }
    return summary;
  };

  /** 定时任务：对所有有“已发送/邮件失败未回收”邀请的租户同步答卷；AI 面试尚未对接时静默 */
  const syncAllAnswers = async () => {
    const rows = await models.readinessInvite.findAll({
      where: { isCurrent: true, status: { [Op.in]: ['sent', 'failed'] }, projectId: { [Op.ne]: null } },
      attributes: ['tenantId'],
      group: ['tenantId']
    });
    for (const row of rows) {
      try {
        await syncAnswers({ tenantId: row.tenantId });
      } catch (e) {
        if (e.message !== NOT_READY_MESSAGE) {
          fastify.log.warn(`readiness answers sync failed tenant=${row.tenantId}: ${e.message}`);
        }
      }
    }
  };

  /** 预览已发布的 AI 面试项目：返回 open-api project/detail、AI 面试远程组件地址与 API 根，由前端用 ProjectPreview 只读展示 */
  const projectPreview = async ({ tenantId }, { runId, kind, personId }) => {
    const info = QUESTIONNAIRE_KINDS[kind];
    if (!info) {
      throw new Error('问卷类型不正确');
    }
    const run = await services.readiness.findRun({ tenantId, id: runId });
    const publish = await currentPublish({ run, kind, personId });
    if (!publish) {
      throw new Error('问卷尚未发布到 AI 面试，没有可预览的项目');
    }
    const credentials = await services.talentReviewSetting.getCredentials(tenantId);
    const project = await services.aiInterview.getProjectDetail({ tenantId, id: publish.projectId });
    const remote = await services.talentReviewSetting.getRemote({ origin: credentials.origin });
    return { project, remote, apiHost: getApiBase(credentials.apiUrl) };
  };

  Object.assign(fastify[options.name].services, {
    readinessSend: {
      projectPreview,
      preview,
      sendDefaults,
      send,
      resend,
      deleteInvites,
      syncAnswers,
      syncAllAnswers,
      onVideoAsrSuccess,
      onVideoAsrFailed
    }
  });
});
