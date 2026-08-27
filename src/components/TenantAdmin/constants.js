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

export const DEFAULT_HOME_PATH = '/';

export const normalizeHomePath = value => {
  let path = value == null || value === '' ? DEFAULT_HOME_PATH : String(value).trim();
  if (!path.startsWith('/')) {
    path = `/${path}`;
  }
  if (path.length > 1 && path.endsWith('/')) {
    path = path.replace(/\/+$/, '');
  }
  return path || DEFAULT_HOME_PATH;
};

/** baseUrl 一般为 '' 或带前缀；homePath 如 / 或 /market → /tenant/ 或 /tenant/market */
export const resolveTenantHomeUrl = (baseUrl = '', homePath = DEFAULT_HOME_PATH) => {
  const path = normalizeHomePath(homePath);
  const tenantBase = `${baseUrl || ''}/tenant`.replace(/\/{2,}/g, '/').replace(/\/$/, '') || '/tenant';
  return path === '/' ? `${tenantBase}/` : `${tenantBase}${path}`;
};
