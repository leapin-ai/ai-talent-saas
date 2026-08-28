const employeeArchiveCard = code => [`tenant-admin:employee-archive:${code}`, `tenant-admin:employee-archive:${code}:view`];

export const TENANT_ADMIN_PERMISSIONS = {
  home: ['tenant-admin:home', 'tenant-admin:home:view'],
  homeCompleteProfile: ['tenant-admin:home:complete-profile'],
  talentMarketplace: ['tenant-admin:talent-marketplace', 'tenant-admin:talent-marketplace:view'],
  positionManagement: ['tenant-admin:position-management', 'tenant-admin:position-management:view'],
  positionCreate: ['tenant-admin:position-management:create'],
  positionEdit: ['tenant-admin:position-management:edit'],
  positionPublish: ['tenant-admin:position-management:publish'],
  positionRemove: ['tenant-admin:position-management:remove'],
  positionAnalysis: ['tenant-admin:position-management:analyze'],
  employeeProfile: ['tenant-admin:employee-profile', 'tenant-admin:employee-profile:view'],
  employeeCreate: ['tenant-admin:employee-profile:create'],
  employeeEdit: ['tenant-admin:employee-profile:edit'],
  employeeRemove: ['tenant-admin:employee-profile:remove'],
  employeeLinkUser: ['tenant-admin:employee-profile:link-user'],
  companySetting: ['setting:company-setting', 'setting:company-setting:view'],
  orgSetting: ['setting:org', 'setting:org:view'],
  userManagement: ['setting:user-manager', 'setting:user-manager:view'],
  homeSetting: ['setting:home-setting', 'setting:home-setting:view']
};

/** 员工档案各 Card 显示权限；传给 TalentProfile 的 permissions，未传的 Card 默认展示 */
export const TALENT_PROFILE_CARD_PERMISSIONS = {
  header: employeeArchiveCard('header'),
  advantages: employeeArchiveCard('advantages'),
  duration: employeeArchiveCard('duration'),
  certificates: employeeArchiveCard('certificates'),
  promotionHistory: employeeArchiveCard('promotion-history'),
  skillMetrics: employeeArchiveCard('skill-metrics'),
  targetPosition: employeeArchiveCard('target-position'),
  mobilityPreference: employeeArchiveCard('mobility-preference'),
  hobbies: employeeArchiveCard('hobbies'),
  performanceReview: employeeArchiveCard('performance-review'),
  careerPlan: employeeArchiveCard('career-plan'),
  aiRecommend: employeeArchiveCard('ai-recommend')
};

export const DEFAULT_HOME_PATH = '/home';

export const normalizeHomePath = value => {
  let path = value == null || value === '' ? DEFAULT_HOME_PATH : String(value).trim();
  if (!path.startsWith('/')) {
    path = `/${path}`;
  }
  if (path.length > 1 && path.endsWith('/')) {
    path = path.replace(/\/+$/, '');
  }
  // 兼容旧配置：首页曾挂在 /tenant/，统一迁到 /tenant/home
  if (!path || path === '/') {
    return DEFAULT_HOME_PATH;
  }
  return path;
};

/** baseUrl 一般为 '' 或带前缀；homePath 如 /home 或 /market → /tenant/home 或 /tenant/market */
export const resolveTenantHomeUrl = (baseUrl = '', homePath = DEFAULT_HOME_PATH) => {
  const path = normalizeHomePath(homePath);
  const tenantBase = `${baseUrl || ''}/tenant`.replace(/\/{2,}/g, '/').replace(/\/$/, '') || '/tenant';
  return `${tenantBase}${path}`;
};
