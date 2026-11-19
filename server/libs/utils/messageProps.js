// @kne/fastify-message 2.x 的模板是 Liquid 白名单子集（只有变量、| raw、扁平 if/else），不支持 JS 表达式和循环。
// 这里把原 EJS 模板里的 `a || b`、三元、`items.forEach` 等逻辑在发送前算成派生变量，模板里只引用结果。
const CODE_PATTERN = /^([A-Z]+)\[(zh-CN|en-US)\]$/;

const escapeHtml = value =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const firstChar = (value, fallback, upper) => {
  const char = String(value || fallback).slice(0, 1);
  return upper ? char.toUpperCase() : char;
};

const SHARE_ITEM_VARIANTS = {
  SHARETALENTREPORT: { avatarRadius: 22, tagFields: ['positionName', 'department'], tagMargin: 'margin:0 6px 4px 0;' },
  SHAREPOSITIONREPORT: { avatarRadius: 12, tagFields: ['department'], tagMargin: '' }
};

const buildShareItemsHtml = ({ family, items, props, isEn }) => {
  const { avatarRadius, tagFields, tagMargin } = SHARE_ITEM_VARIANTS[family];
  const themeColor = escapeHtml(props.themeColor);
  const themeTint = escapeHtml(props.themeTint);
  const themeBorder = escapeHtml(props.themeBorder);
  const viewLabel = isEn ? 'View report' : '查看报告';

  return items
    .map((item, index) => {
      const tags = tagFields.map(field => item[field]).filter(Boolean);
      const tagsHtml = tags.length
        ? `<div style="margin-top:4px;">${tags
            .map(
              tag =>
                `<span style="display:inline-block;${tagMargin}padding:1px 10px;border-radius:6px;background-color:#FFFFFF;word-break:break-word;border:1px solid ${themeBorder};color:${themeColor};font-size:12px;line-height:20px;">${escapeHtml(tag)}</span>`
            )
            .join('')}</div>`
        : '';
      return `${index > 0 ? '<tr><td height="12" style="height:12px;font-size:0;line-height:0;">&nbsp;</td></tr>' : ''}<tr><td bgcolor="${themeTint}" style="background-color:${themeTint};border:1px solid ${themeBorder};border-radius:12px;padding:16px;"><table width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td width="44" valign="middle"><div style="width:44px;height:44px;line-height:44px;border-radius:${avatarRadius}px;background-color:${themeColor};color:#FFFFFF;text-align:center;font-size:18px;font-weight:600;">${escapeHtml(firstChar(item.name, '-', isEn))}</div></td><td valign="middle" style="padding:0 0 0 12px;"><div style="font-size:16px;font-weight:600;line-height:24px;color:#1F1F1F;">${escapeHtml(item.name)}</div>${tagsHtml}</td></tr><tr><td colspan="2" style="padding:12px 0 0 56px;"><table cellpadding="0" cellspacing="0" border="0"><tr><td bgcolor="${themeColor}" style="background-color:${themeColor};border-radius:999px;"><a href="${escapeHtml(item.url)}" target="_blank" style="display:inline-block;padding:8px 18px;color:#FFFFFF;font-size:13px;font-weight:600;line-height:20px;text-decoration:none;white-space:nowrap;">${viewLabel}</a></td></tr></table></td></tr></table></td></tr>`;
    })
    .join('');
};

const buildShareItemsText = ({ family, items, isEn }) => {
  const { tagFields } = SHARE_ITEM_VARIANTS[family];
  return items
    .map(item => {
      const tags = tagFields.map(field => item[field]).filter(Boolean);
      const tagText = tags.length ? (isEn ? ` (${tags.join(' · ')})` : `（${tags.join(' · ')}）`) : '';
      return `\n${item.name}${tagText}\n${isEn ? 'View report: ' : '查看报告：'}${item.url}\n`;
    })
    .join('');
};

const SHARE_SUBJECTS = {
  SHARETALENTREPORT: {
    'zh-CN': isSelf => (isSelf ? '您的岗位就绪度报告' : '人才就绪度报告分享'),
    'en-US': isSelf => (isSelf ? 'Your Role Readiness Report' : 'Talent Readiness Report')
  },
  SHAREPOSITIONREPORT: {
    'zh-CN': () => '岗位洞察报告分享',
    'en-US': () => 'Role Insights Report'
  }
};

const derivers = {
  CANDIDATECODE: ({ props }) => ({ themeColor: props.themeColor || '#2A5CAA' }),
  INVITETENANT: ({ props }) => ({
    orgName: props.companyName || props.tenantName || ''
  }),
  EMPLOYEEQUESTIONNAIRE: ({ props, isEn }) => {
    const orgName = props.companyName || props.tenantName || '';
    return {
      orgName,
      teamDisplay: props.teamName || orgName,
      subjectText: props.subject || (isEn ? `${orgName} | Questionnaire: ${props.projectName}` : `${orgName} | 问卷邀请：${props.projectName}`)
    };
  },
  INVITETALENTCOLLECT: ({ props, isEn }) => {
    const orgName = props.companyName || props.tenantName || '';
    const role = isEn ? (props.isManager ? 'Manager Role Interview' : 'Employee Role Interview') : props.isManager ? '经理岗位访谈' : '员工岗位访谈';
    return {
      orgName,
      teamDisplay: props.teamName || orgName,
      subjectText: props.subject || (isEn ? `${orgName} Workforce Readiness | ${role}` : `${orgName} 人才队伍就绪度 | ${role}`)
    };
  },
  SHARETALENTREPORT: context => deriveShareReport(context),
  SHAREPOSITIONREPORT: context => deriveShareReport(context)
};

function deriveShareReport({ family, language, props, isEn }) {
  const items = Array.isArray(props.items) ? props.items : [];
  const companyName = props.companyName || '';
  const companyPrefix = companyName ? `${companyName} ` : '';
  return {
    companyOrWe: companyName || (isEn ? 'we' : '我们'),
    companyOrBrand: companyName || 'LeapIn',
    companyInitial: firstChar(companyName, '·', isEn),
    itemsCount: items.length,
    itemsPlural: items.length > 1 ? 's' : '',
    peopleWord: items.length > 1 ? 'people' : 'person',
    subjectText: props.subject || `${companyPrefix}${SHARE_SUBJECTS[family][language](props.isSelf)}`,
    itemsHtml: buildShareItemsHtml({ family, items, props, isEn }),
    itemsText: buildShareItemsText({ family, items, isEn })
  };
}

const prepareMessageProps = ({ code, props }) => {
  const match = CODE_PATTERN.exec(code || '');
  if (!match || !derivers[match[1]]) {
    return props;
  }
  const [, family, language] = match;
  const base = props || {};
  return Object.assign({}, base, derivers[family]({ family, language, props: base, isEn: language === 'en-US' }));
};

module.exports = { prepareMessageProps, escapeHtml };
