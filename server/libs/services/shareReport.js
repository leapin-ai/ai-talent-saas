const fp = require('fastify-plugin');
const dayjs = require('dayjs');
const utc = require('dayjs/plugin/utc');
const timezone = require('dayjs/plugin/timezone');
const get = require('lodash/get');
const ensureSlash = require('@kne/ensure-slash');

dayjs.extend(utc);
dayjs.extend(timezone);

const SHARE_SHORTEN_TYPE = 'shareReport';
const DEFAULT_TTL_DAYS = 7;
const DISPLAY_TZ = 'Asia/Shanghai';
const MAX_TARGETS = 50;
const MAX_EMAILS = 50;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** 系统语言：仅 zh-CN 用中文模版，其余（含 en-US、未知）默认英文 */
const normalizeMessageLanguage = language => (language === 'zh-CN' ? 'zh-CN' : 'en-US');

const normalizeIds = ids => [...new Set((Array.isArray(ids) ? ids : []).map(id => (id == null ? '' : String(id).trim())).filter(Boolean))];

const normalizeEmails = emails => {
  const list = [
    ...new Set(
      (Array.isArray(emails) ? emails : [])
        .flatMap(item => String(item || '').split(/[,;，；\s]+/))
        .map(item => item.trim())
        .filter(Boolean)
    )
  ];
  const invalid = list.filter(item => !EMAIL_PATTERN.test(item));
  if (invalid.length) {
    throw new Error(`邮箱格式不正确：${invalid.join(', ')}`);
  }
  return list;
};

/** 所选日期全天有效（按 UTC+8 规范为次日 0 点）；未选则默认 7 天 */
const resolveExpires = deadline => {
  if (deadline == null || deadline === '') {
    return dayjs().add(DEFAULT_TTL_DAYS, 'day').valueOf();
  }
  const expires = dayjs(deadline).tz(DISPLAY_TZ).startOf('day').add(1, 'day');
  if (!expires.isAfter(dayjs())) {
    throw new Error('有效期已过，请选择今天或之后的日期');
  }
  return expires.valueOf();
};

const formatExpiresText = (expires, language) => {
  const text = dayjs(expires).tz(DISPLAY_TZ).subtract(1, 'millisecond').format('YYYY-MM-DD HH:mm');
  return language === 'zh-CN' ? `${text}（UTC+8）` : `${text} (UTC+8)`;
};

const resolvePositionId = value => {
  if (value == null || value === '') {
    return null;
  }
  const id = typeof value === 'object' ? (value.id ?? value.value) : value;
  return id == null || id === '' ? null : String(id);
};

const DEFAULT_THEME_COLOR = '#4183F0';

const normalizeHex = value => {
  const hex = String(value || '')
    .trim()
    .replace(/^#/, '');
  if (/^[0-9a-f]{3}$/i.test(hex)) {
    return `#${hex
      .split('')
      .map(c => c + c)
      .join('')}`.toUpperCase();
  }
  return /^[0-9a-f]{6}$/i.test(hex) ? `#${hex}`.toUpperCase() : null;
};

const mixHex = (color, target, weight) => {
  const parse = hex => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
  const [a, b] = [parse(color), parse(target)];
  return `#${a
    .map((v, i) =>
      Math.round(v * (1 - weight) + b[i] * weight)
        .toString(16)
        .padStart(2, '0')
    )
    .join('')}`.toUpperCase();
};

module.exports = fp(async (fastify, options) => {
  const { models, services } = fastify[options.name];

  const requireShortenServices = () => {
    const shortenServices = fastify.shorten?.services;
    if (!shortenServices?.sign || !shortenServices?.decode) {
      throw new Error('短链服务未就绪');
    }
    return shortenServices;
  };

  const buildShareUrl = code => `${ensureSlash(fastify.config.ORIGIN || '')}/share-report?code=${encodeURIComponent(code)}`;

  const signShareCode = async (payload, expires) => {
    const shortenServices = requireShortenServices();
    return shortenServices.sign(JSON.stringify(Object.assign({ type: SHARE_SHORTEN_TYPE }, payload)), expires);
  };

  const decodeShareCode = async code => {
    if (!code) {
      throw new Error('分享链接无效');
    }
    let payload;
    try {
      payload = JSON.parse(await requireShortenServices().decode(String(code)));
    } catch (e) {
      throw new Error('分享链接无效或已过期');
    }
    if (payload?.type !== SHARE_SHORTEN_TYPE || !payload.tenantId || !['position', 'employee'].includes(payload.kind)) {
      throw new Error('分享链接无效或已过期');
    }
    return payload;
  };

  const getTenant = async tenantId => {
    try {
      return await fastify.tenant.services.tenant.detail({ id: tenantId });
    } catch (e) {
      return { id: tenantId, name: '' };
    }
  };

  const buildLogoUrl = logo => {
    const value = String(logo || '').trim();
    if (!value) {
      return '';
    }
    if (/^https?:\/\//i.test(value)) {
      return value;
    }
    return `${ensureSlash(fastify.config.ORIGIN || '')}${options.prefix}/static/file-id/${encodeURIComponent(value)}`;
  };

  const buildMailContext = (tenant, language, expires) => {
    const companyName = tenant?.company?.name || tenant?.name || '';
    const themeColor = normalizeHex(tenant?.themeColor) || DEFAULT_THEME_COLOR;
    return {
      companyName,
      logoUrl: buildLogoUrl(tenant?.logo || tenant?.company?.logo),
      // 邮件客户端普遍不支持 color-mix / CSS 变量，浅色阶在服务端算成实色
      themeColor,
      themeDark: mixHex(themeColor, '#000000', 0.18),
      themeLight: mixHex(themeColor, '#ffffff', 0.85),
      themeTint: mixHex(themeColor, '#ffffff', 0.94),
      themeBorder: mixHex(themeColor, '#ffffff', 0.75),
      expiresText: formatExpiresText(expires, language),
      language
    };
  };

  const sendMail = async ({ email, code, props, subject }) => {
    await fastify.message.services.sendMessage({
      name: email,
      type: 0,
      code,
      props: Object.assign({}, props, { subject }),
      options: { title: subject }
    });
  };

  const getOrgNames = async (tenantId, ids) => {
    const orgIds = [...new Set((ids || []).filter(id => id != null && id !== '').map(String))];
    if (!orgIds.length) {
      return [];
    }
    try {
      const orgEnums = await fastify.tenant.services.org.enums({ tenantId }, { ids: orgIds });
      return (orgEnums || [])
        .filter(item => orgIds.includes(String(item.value)))
        .map(item => item.description || item.label || '')
        .filter(Boolean);
    } catch (e) {
      return [];
    }
  };

  const buildPositionItem = async ({ tenantId, id, expires, language }) => {
    const position = await models.position.findOne({ where: { id, tenantId } });
    if (!position) {
      throw new Error('未找到岗位');
    }
    const [department = ''] = await getOrgNames(tenantId, [position.tenantOrgId]);
    const code = await signShareCode({ kind: 'position', tenantId: String(tenantId), positionId: String(position.id), language }, expires);
    return {
      id: String(position.id),
      name: position.name || '',
      department,
      url: buildShareUrl(code)
    };
  };

  const buildEmployeeItem = async ({ tenantId, id, expires, language }) => {
    const employee = await models.employee.findOne({ where: { id, tenantId } });
    if (!employee) {
      throw new Error('未找到员工');
    }
    const positionId = resolvePositionId(get(employee, 'options.position'));
    let positionName = '';
    if (positionId) {
      const position = await models.position.findOne({ where: { id: positionId, tenantId } });
      positionName = position?.name || '';
    }
    const departments = await getOrgNames(tenantId, employee.tenantOrgIds);
    const code = await signShareCode({ kind: 'employee', tenantId: String(tenantId), employeeId: String(employee.id), positionId, language }, expires);
    return {
      id: String(employee.id),
      name: employee.name || employee.nameEn || '',
      email: String(employee.email || '').trim(),
      positionName,
      department: departments.join(' / '),
      url: buildShareUrl(code)
    };
  };

  const collectItems = async (ids, build) => {
    const items = [];
    const failed = [];
    for (const id of ids) {
      try {
        items.push(await build(id));
      } catch (e) {
        failed.push({ id, reason: e.message || '生成失败' });
      }
    }
    return { items, failed };
  };

  const sendToEmails = async ({ emails, messageCode, subject, props }) => {
    const success = [];
    const failed = [];
    for (const email of emails) {
      try {
        await sendMail({ email, code: messageCode, props, subject });
        success.push(email);
      } catch (e) {
        failed.push({ email, reason: e.message || '发送失败' });
      }
    }
    return { success, failed };
  };

  const assertTargets = ids => {
    if (!ids.length) {
      throw new Error('请至少选择一项');
    }
    if (ids.length > MAX_TARGETS) {
      throw new Error(`一次最多分享 ${MAX_TARGETS} 项`);
    }
  };

  const assertEmails = emails => {
    if (!emails.length) {
      throw new Error('请填写收件邮箱');
    }
    if (emails.length > MAX_EMAILS) {
      throw new Error(`一次最多填写 ${MAX_EMAILS} 个邮箱`);
    }
  };

  const sendPositions = async (authenticatePayload, body = {}) => {
    const { tenantId } = authenticatePayload;
    const language = normalizeMessageLanguage(body.language);
    const ids = normalizeIds(body.ids);
    const emails = normalizeEmails(body.emails);
    assertTargets(ids);
    assertEmails(emails);
    const expires = resolveExpires(body.deadline);

    const { items, failed: itemFailed } = await collectItems(ids, id => buildPositionItem({ tenantId, id, expires, language }));
    if (!items.length) {
      throw new Error(itemFailed[0]?.reason || '未找到可分享的岗位');
    }
    const tenant = await getTenant(tenantId);
    const context = buildMailContext(tenant, language, expires);
    const orgLabel = context.companyName;
    const subject = language === 'zh-CN' ? `${orgLabel ? `${orgLabel} ` : ''}岗位洞察报告分享（${items.length} 个岗位）` : `${orgLabel ? `${orgLabel} ` : ''}Role Insights Report (${items.length} role${items.length > 1 ? 's' : ''})`;
    const result = await sendToEmails({
      emails,
      messageCode: `SHAREPOSITIONREPORT[${language}]`,
      subject,
      props: Object.assign({}, context, { items })
    });
    return Object.assign(result, {
      itemFailed,
      links: items.map(item => ({ id: item.id, name: item.name, url: item.url }))
    });
  };

  const sendEmployees = async (authenticatePayload, body = {}) => {
    const { tenantId } = authenticatePayload;
    const language = normalizeMessageLanguage(body.language);
    const mode = body.mode === 'self' ? 'self' : 'specified';
    const ids = normalizeIds(body.ids);
    assertTargets(ids);
    const emails = mode === 'specified' ? normalizeEmails(body.emails) : [];
    if (mode === 'specified') {
      assertEmails(emails);
    }
    const expires = resolveExpires(body.deadline);

    const { items, failed: itemFailed } = await collectItems(ids, id => buildEmployeeItem({ tenantId, id, expires, language }));
    if (!items.length) {
      throw new Error(itemFailed[0]?.reason || '未找到可分享的人才');
    }
    const tenant = await getTenant(tenantId);
    const context = buildMailContext(tenant, language, expires);
    const orgLabel = context.companyName;
    const messageCode = `SHARETALENTREPORT[${language}]`;
    const links = items.map(item => ({ id: item.id, name: item.name, url: item.url }));

    if (mode === 'self') {
      const success = [];
      const failed = [];
      for (const item of items) {
        if (!EMAIL_PATTERN.test(item.email)) {
          failed.push({ id: item.id, name: item.name, reason: language === 'zh-CN' ? '员工未填写有效邮箱' : 'No valid email' });
          continue;
        }
        const subject = language === 'zh-CN' ? `${orgLabel ? `${orgLabel} ` : ''}您的岗位就绪度报告` : `${orgLabel ? `${orgLabel} ` : ''}Your Role Readiness Report`;
        try {
          await sendMail({ email: item.email, code: messageCode, subject, props: Object.assign({}, context, { items: [item], isSelf: true, recipientName: item.name }) });
          success.push(item.email);
        } catch (e) {
          failed.push({ id: item.id, name: item.name, email: item.email, reason: e.message || '发送失败' });
        }
      }
      return { success, failed, itemFailed, links };
    }

    const subject = language === 'zh-CN' ? `${orgLabel ? `${orgLabel} ` : ''}人才就绪度报告分享（${items.length} 人）` : `${orgLabel ? `${orgLabel} ` : ''}Talent Readiness Report (${items.length} ${items.length > 1 ? 'people' : 'person'})`;
    const result = await sendToEmails({
      emails,
      messageCode,
      subject,
      props: Object.assign({}, context, { items, isSelf: false, recipientName: '' })
    });
    return Object.assign(result, { itemFailed, links });
  };

  const requireKind = (payload, kind) => {
    if (payload.kind !== kind) {
      throw new Error('分享链接无效或已过期');
    }
  };

  const publicDetail = async ({ code }) => {
    const payload = await decodeShareCode(code);
    const tenantPayload = { tenantId: payload.tenantId };
    const tenant = await getTenant(payload.tenantId);
    const result = {
      kind: payload.kind,
      language: payload.language || null,
      tenant: {
        id: tenant?.id,
        name: tenant?.name || '',
        companyName: tenant?.company?.name || '',
        logo: tenant?.logo || tenant?.company?.logo || null,
        themeColor: tenant?.themeColor || null
      }
    };
    if (payload.kind === 'position') {
      const position = await services.position.detail(tenantPayload, { id: payload.positionId });
      result.position = position.toJSON ? position.toJSON() : position;
      return result;
    }
    const employee = await models.employee.findOne({ where: { id: payload.employeeId, tenantId: payload.tenantId } });
    if (!employee) {
      throw new Error('分享链接无效或已过期');
    }
    const position = payload.positionId ? await models.position.findOne({ where: { id: payload.positionId, tenantId: payload.tenantId } }) : null;
    result.employee = {
      id: String(employee.id),
      name: employee.name || employee.nameEn || '',
      nameEn: employee.nameEn || '',
      avatar: employee.avatar || null,
      positionId: payload.positionId || null,
      positionName: position?.name || ''
    };
    return result;
  };

  const publicTasks = async ({ code }) => {
    const payload = await decodeShareCode(code);
    if (!payload.positionId) {
      return { pageData: [] };
    }
    return services.workforce.listTasks({ tenantId: payload.tenantId }, { positionId: payload.positionId });
  };

  const publicTalentMetrics = async ({ code }) => {
    const payload = await decodeShareCode(code);
    requireKind(payload, 'position');
    const listRes = await services.employee.list(
      { tenantId: payload.tenantId },
      {
        positionId: payload.positionId,
        perPage: 1,
        currentPage: 1,
        filter: { withTalentAnalysis: true }
      }
    );
    return { talentMetrics: listRes?.talentMetrics || null };
  };

  const publicTaskReadiness = async ({ code }) => {
    const payload = await decodeShareCode(code);
    requireKind(payload, 'employee');
    if (!payload.positionId) {
      return { pageData: [] };
    }
    return services.workforce.getTaskReadiness({ tenantId: payload.tenantId }, { positionId: payload.positionId, employeeId: payload.employeeId });
  };

  const publicSkillAnalysisDetail = async ({ code }) => {
    const payload = await decodeShareCode(code);
    requireKind(payload, 'employee');
    if (!payload.positionId) {
      return { analysis: null };
    }
    return services.position.skillAnalysisDetail({ tenantId: payload.tenantId }, { positionId: payload.positionId, employeeId: payload.employeeId });
  };

  const publicEvidence = async ({ code, taskId }) => {
    const payload = await decodeShareCode(code);
    requireKind(payload, 'employee');
    return services.workforce.listEvidence({ tenantId: payload.tenantId }, { employeeId: payload.employeeId, taskId });
  };

  Object.assign(fastify[options.name].services, {
    shareReport: {
      sendPositions,
      sendEmployees,
      publicDetail,
      publicTasks,
      publicTalentMetrics,
      publicTaskReadiness,
      publicSkillAnalysisDetail,
      publicEvidence
    }
  });
});
