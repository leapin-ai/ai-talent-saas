const fp = require('fastify-plugin');
const dayjs = require('dayjs');
const utc = require('dayjs/plugin/utc');
const timezone = require('dayjs/plugin/timezone');
const ensureSlash = require('@kne/ensure-slash');

dayjs.extend(utc);
dayjs.extend(timezone);

const APP_NAME = 'questionnaire';
const MESSAGE_CODE = 'EMPLOYEEQUESTIONNAIRE';
const SHORTEN_TYPE = 'employeeQuestionnaire';
// 未设截止日期时回调校验码的有效期
const WEBHOOK_CODE_TTL_DAYS = 180;
const APP_REQUEST_TIMEOUT = 15000;

const normalizeMessageLanguage = language => (language === 'zh-CN' ? 'zh-CN' : 'en-US');

const pickContact = value => {
  if (value == null || value === '') {
    return '';
  }
  if (typeof value === 'object') {
    const number = value.number ?? value.phone ?? value.value;
    return number != null ? String(number).trim() : '';
  }
  return String(value).trim();
};

/** 截止日期按 Asia/Shanghai 日历日规范为「次日 0 点」，与评估邀请一致 */
const normalizeDeadline = value => {
  if (value == null || value === '') {
    return null;
  }
  const deadline = dayjs(value).tz('Asia/Shanghai').startOf('day').add(1, 'day');
  if (!deadline.isAfter(dayjs())) {
    throw new Error('截止日期已过期，请选择今天或之后的日期');
  }
  return deadline.toDate();
};

module.exports = fp(async (fastify, options) => {
  const { models, services } = fastify[options.name];
  const { Op } = fastify.sequelize.Sequelize;

  const requireAppManager = () => {
    if (!fastify.appManager?.services?.openApi) {
      throw new Error('未启用应用中心，无法使用问卷');
    }
    return fastify.appManager;
  };

  const getRunningApp = async () => {
    const appManager = requireAppManager();
    let app;
    try {
      app = await appManager.services.app.detail({ name: APP_NAME });
    } catch (e) {
      throw new Error('应用中心未安装问卷应用');
    }
    if (app.status !== 'running') {
      throw new Error('问卷应用未运行');
    }
    return app;
  };

  /** 问卷应用对外地址：绑定域名优先，否则走应用中心路径 */
  const getAppBaseUrl = app => {
    const origin = new URL(fastify.config.ORIGIN).origin;
    if (app.domain) {
      return `${new URL(origin).protocol}//${app.domain}`;
    }
    return `${origin}${fastify.appManager.options.pathPrefix || '/app'}/${app.name}`;
  };

  /** 以当前登录用户身份调用问卷应用接口，返回 data */
  const callApp = async ({ userInfo, tenantId }, { method = 'GET', path, query, body }) => {
    const app = await getRunningApp();
    const { token } = await fastify.appManager.services.openApi.issueUserToken({ name: APP_NAME, userId: userInfo?.id, tenantId });
    const url = new URL(`http://${fastify.appManager.options.upstreamHost}:${app.port}/api/v1${path}`);
    if (query) {
      url.search = require('qs').stringify(query);
    }
    const response = await fetch(url, {
      method,
      headers: Object.assign({ authorization: `Bearer ${token}` }, body ? { 'content-type': 'application/json' } : {}),
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(APP_REQUEST_TIMEOUT)
    });
    const data = await response.json().catch(() => null);
    if (!response.ok || !data || data.code !== 0) {
      throw new Error(data?.msg || `问卷应用请求失败：HTTP ${response.status}`);
    }
    return { app, data: data.data };
  };

  const listProjects = async (context, { keyword, currentPage = 1, perPage = 20 } = {}) => {
    const { data } = await callApp(context, {
      path: '/questionnaire/project/list',
      query: { currentPage, perPage, filter: { status: 'open', keyword: keyword || undefined } }
    });
    return {
      pageData: (data?.pageData || []).map(item => ({ id: item.id, name: item.name, description: item.description, responseCount: item.responseCount })),
      totalCount: data?.totalCount || 0
    };
  };

  const buildWebhookUrl = row => `${ensureSlash(fastify.config.ORIGIN || '')}${options.prefix}/public/employee-questionnaire/webhook?code=${encodeURIComponent(row.code)}`;

  const sendNotify = async ({ row, tenant, language: languageInput }) => {
    const language = normalizeMessageLanguage(languageInput);
    const companyName = tenant?.company?.name || tenant?.name || '';
    const tenantName = tenant?.name || '';
    const contactEmail = pickContact(tenant?.company?.email) || pickContact(tenant?.email) || '';
    const subject = language === 'en-US' ? `${companyName || tenantName} | Questionnaire: ${row.projectName}` : `${companyName || tenantName} | 问卷邀请：${row.projectName}`;
    const props = {
      name: row.name,
      companyName,
      tenantName,
      teamName: companyName || tenantName || (language === 'en-US' ? 'Project Team' : '项目组'),
      projectName: row.projectName,
      inviteUrl: row.fillUrl,
      deadlineText: row.deadline ? `${dayjs(row.deadline).tz('Asia/Shanghai').subtract(1, 'millisecond').format('YYYY-MM-DD HH:mm')}${language === 'zh-CN' ? '（UTC+8）' : ' (UTC+8)'}` : '',
      contactEmail,
      themeColor: tenant?.themeColor || '#4183F0',
      subject,
      language
    };
    const messageCode = `${MESSAGE_CODE}[${language}]`;
    if (row.email) {
      await fastify.message.services.sendMessage({ name: row.email, type: 0, code: messageCode, props, options: { title: subject } });
    }
    if (row.phone) {
      await fastify.message.services.sendMessage({ name: row.phone, type: 1, code: messageCode, props, options: { title: subject } });
    }
  };

  const send = async (context, { employeeId, positionId, project, deadline: deadlineInput, language } = {}) => {
    const { tenantId } = context;
    const projectId = project && typeof project === 'object' ? project.id || project.value : project;
    if (!projectId) {
      throw new Error('请选择问卷');
    }
    const employee = await models.employee.findOne({ where: { id: String(employeeId), tenantId } });
    if (!employee) {
      throw new Error('员工不存在');
    }
    const email = pickContact(employee.email);
    const phone = pickContact(employee.phone).replace(/\s+/g, '');
    if (!email && !phone) {
      throw new Error('该员工没有邮箱或手机号，无法发送问卷');
    }
    const deadline = normalizeDeadline(deadlineInput);
    const row = await models.employeeQuestionnaire.create({
      tenantId,
      employeeId: employee.id,
      positionId: positionId ? String(positionId) : null,
      appName: APP_NAME,
      projectId: String(projectId),
      projectName: String((typeof project === 'object' && (project.name || project.label)) || '').trim(),
      name: employee.name || '',
      email,
      phone,
      deadline,
      status: 'invited'
    });
    try {
      const codeExpires = deadline ? dayjs(deadline).add(1, 'day').valueOf() : dayjs().add(WEBHOOK_CODE_TTL_DAYS, 'day').valueOf();
      row.code = await fastify.shorten.services.sign(JSON.stringify({ type: SHORTEN_TYPE, id: String(row.id) }), codeExpires);
      const { app, data: invite } = await callApp(context, {
        method: 'POST',
        path: '/questionnaire/project/invite',
        body: {
          projectId: row.projectId,
          name: row.name,
          email,
          phone,
          externalId: String(row.id),
          webhook: buildWebhookUrl(row),
          expiresAt: deadline ? deadline.toISOString() : undefined
        }
      });
      row.appInviteId = invite.id;
      row.fillUrl = `${getAppBaseUrl(app)}${invite.path}`;
      await row.save();
    } catch (e) {
      await row.destroy({ force: true });
      throw e;
    }
    let tenant = null;
    try {
      tenant = await fastify.tenant.services.tenant.detail({ id: tenantId });
    } catch (e) {
      tenant = null;
    }
    await sendNotify({ row, tenant, language });
    return { id: row.id, fillUrl: row.fillUrl };
  };

  const findAssessmentForEmployee = async employee => {
    if (employee.tenantUserId) {
      const assessment = await models.assessment.findOne({ where: { tenantId: employee.tenantId, tenantUserId: employee.tenantUserId } });
      if (assessment) {
        return assessment;
      }
    }
    const invites = await models.talentCollectInvite.findAll({
      where: { tenantId: employee.tenantId, employeeId: employee.id },
      attributes: ['id'],
      order: [['createdAt', 'DESC']]
    });
    for (const invite of invites) {
      const assessment = await models.assessment.findOne({
        where: { tenantId: employee.tenantId, interviewData: { [Op.contains]: { collectInviteId: String(invite.id) } } },
        order: [['updatedAt', 'DESC']]
      });
      if (assessment) {
        return assessment;
      }
    }
    return models.assessment.findOne({
      where: { tenantId: employee.tenantId, interviewData: { [Op.contains]: { employeeId: String(employee.id) } } },
      order: [['updatedAt', 'DESC']]
    });
  };

  /** 员工未关联 tenantUser 时，靠 interviewData.employeeId 让生成任务找回员工 */
  const ensureAssessmentForEmployee = async employee => {
    const assessment = await findAssessmentForEmployee(employee);
    if (assessment) {
      return assessment;
    }
    return models.assessment.create({
      tenantId: employee.tenantId,
      tenantUserId: employee.tenantUserId || null,
      status: 'pending',
      profileData: { name: employee.name || '', email: employee.email || '', phone: employee.phone || '' },
      interviewData: { source: 'employeeQuestionnaire', employeeId: String(employee.id) }
    });
  };

  const handleWebhook = async ({ code }, body = {}) => {
    let payload;
    try {
      payload = JSON.parse(await fastify.shorten.services.decode(String(code || '')));
    } catch (e) {
      throw new Error('回调校验失败');
    }
    if (payload?.type !== SHORTEN_TYPE || !payload.id) {
      throw new Error('回调校验失败');
    }
    const row = await models.employeeQuestionnaire.findByPk(payload.id);
    if (!row || String(body.invite?.id) !== String(row.appInviteId) || String(body.invite?.externalId) !== String(row.id)) {
      throw new Error('回调校验失败');
    }
    if (row.status === 'submitted') {
      return {};
    }
    row.status = 'submitted';
    row.schema = body.project?.schema || {};
    row.answers = body.response?.answers || {};
    row.submittedAt = body.response?.submittedAt ? new Date(body.response.submittedAt) : new Date();
    if (body.project?.name) {
      row.projectName = body.project.name;
    }
    await row.save();

    const employee = await models.employee.findByPk(row.employeeId);
    const assessment = employee ? await ensureAssessmentForEmployee(employee) : null;
    if (assessment) {
      await services.assessment.enterGenerating(assessment, { forceNew: true });
      await assessment.reload();
      row.generateTaskId = assessment.generateTaskId || null;
      await row.save();
    }
    return {};
  };

  /** 员工全部已提交问卷，供生成任务上下文与导出 */
  const listSubmitted = async ({ tenantId, employeeId }) => {
    if (!employeeId) {
      return [];
    }
    const rows = await models.employeeQuestionnaire.findAll({
      where: { tenantId, employeeId: String(employeeId), status: 'submitted' },
      order: [['submittedAt', 'ASC']]
    });
    return rows.map(row => ({
      id: row.id,
      projectId: row.projectId,
      projectName: row.projectName,
      status: row.status,
      deadline: row.deadline,
      createdAt: row.createdAt,
      submittedAt: row.submittedAt,
      schema: row.schema || {},
      answers: row.answers || {}
    }));
  };

  const listByEmployee = async ({ tenantId }, { employeeId }) => {
    if (!tenantId) {
      throw new Error('未登录租户用户');
    }
    const rows = await models.employeeQuestionnaire.findAll({
      where: { tenantId, employeeId: String(employeeId) },
      order: [['createdAt', 'DESC']]
    });
    return rows.map(row => ({
      id: row.id,
      projectId: row.projectId,
      projectName: row.projectName,
      status: row.status,
      deadline: row.deadline,
      createdAt: row.createdAt,
      submittedAt: row.submittedAt,
      schema: row.schema || {},
      answers: row.answers || {}
    }));
  };

  Object.assign(fastify[options.name].services, {
    employeeQuestionnaire: { listProjects, send, handleWebhook, listSubmitted, listByEmployee }
  });
});
