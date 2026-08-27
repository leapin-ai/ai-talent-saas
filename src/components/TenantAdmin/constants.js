export const TENANT_ADMIN_PERMISSIONS = {
  home: ['tenant-admin:home', 'tenant-admin:home:view'],
  homeCompleteProfile: ['tenant-admin:home:complete-profile'],
  talentMarketplace: ['tenant-admin:talent-marketplace', 'tenant-admin:talent-marketplace:view'],
  positionManagement: ['tenant-admin:position-management', 'tenant-admin:position-management:view'],
  positionAnalysis: ['tenant-admin:position-management', 'tenant-admin:position-management:analyze'],
  employeeProfile: ['tenant-admin:employee-profile', 'tenant-admin:employee-profile:view'],
  companySetting: ['setting:company-setting', 'setting:company-setting:view'],
  orgSetting: ['setting:org', 'setting:org:view'],
  userManagement: ['setting:user-manager', 'setting:user-manager:view'],
  homeSetting: ['setting:home-setting', 'setting:home-setting:view']
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
