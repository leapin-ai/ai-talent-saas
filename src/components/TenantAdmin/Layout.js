import { createWithRemoteLoader } from '@kne/remote-loader';
import SystemLayout from '@kne/system-layout';
import { Outlet } from 'react-router-dom';
import '@kne/system-layout/dist/index.css';
import withLocale from './withLocale';
import { useIntl } from '@kne/react-intl';
import { TENANT_ADMIN_PERMISSIONS } from './constants';
import TenantThemeProvider from '../../commons/TenantThemeProvider';
import { resolveTenantThemeColor } from '../../commons/themeColor';
import { withPublicUrl } from '../../commons/publicUrl';
import { getOidcClient } from '../../commons/oidcClient';
import { useFetch } from '@kne/react-fetch';
import { SubAppMenusProvider, flattenMenus } from './SubAppMenus';
import {
  WorkforceMenuIcon,
  TalentsMenuIcon,
  HomeMenuIcon,
  MarketMenuIcon,
  AppCenterMenuIcon,
  resolveSubAppMenuIcon,
  CompanyMenuIcon,
  OrgMenuIcon,
  UserMenuIcon,
  SwitchTenantMenuIcon,
  LogoutMenuIcon,
  TalentReviewProjectsMenuIcon,
  TalentReviewParticipantsMenuIcon,
  TalentReviewModelsMenuIcon
} from './MenuIcons';

const Layout = createWithRemoteLoader({
  modules: [
    'components-admin:Tenant@Authenticate',
    'components-core:Permissions',
    'components-core:Permissions@usePermissionsPass',
    'components-admin:Account@Language',
    'components-core:Global@SetGlobal',
    'components-core:Global@usePreset'
  ]
})(
  withLocale(({ remoteModules, baseUrl, children }) => {
    const { formatMessage, locale } = useIntl();
    const [Authenticate, Permissions, usePermissionsPass, Language, SetGlobal, usePreset] = remoteModules;
    const { capabilities, apis } = usePreset();
    const { data: talentReviewStatus } = useFetch(Object.assign({}, apis.talentSaas.tenant.talentReview.setting));
    // 应用中心版本不含 centerMenus（旧版 components-app-manager）或未启用应用中心时，不请求也不展示子应用菜单
    const subAppMenusApi = capabilities?.appManager ? apis.appManager?.centerMenus : null;
    const logout = () => getOidcClient().logout();
    return (
      <Authenticate>
        {({ global }) => {
          const { tenantUserInfo, tenant } = global;
          const themeColor = resolveTenantThemeColor({ tenant, tenantUserInfo });
          return (
            <TenantThemeProvider themeColor={themeColor} SetGlobal={SetGlobal}>
              <Permissions request={['tenant-admin']} type="error">
                <SubAppMenusProvider api={subAppMenusApi} tenantId={tenant?.id}>
                  {subApps => (
                    <TenantAdminMenu
                      baseUrl={baseUrl}
                      appManagerEnabled={!!capabilities?.appManager}
                      subApps={subApps}
                      locale={locale}
                      talentReviewEnabled={!!talentReviewStatus?.configured}
                      tenant={tenant}
                      tenantUserInfo={tenantUserInfo}
                      logout={logout}
                      formatMessage={formatMessage}
                      usePermissionsPass={usePermissionsPass}
                      Language={Language}
                    >
                      {children || <Outlet />}
                    </TenantAdminMenu>
                  )}
                </SubAppMenusProvider>
              </Permissions>
            </TenantThemeProvider>
          );
        }}
      </Authenticate>
    );
  })
);

const TenantAdminMenu = ({ baseUrl, appManagerEnabled, subApps, locale, talentReviewEnabled, tenant, tenantUserInfo, logout, formatMessage, usePermissionsPass, Language, children }) => {
  const allowHome = usePermissionsPass({ request: TENANT_ADMIN_PERMISSIONS.home });
  const allowTalentMarketplace = usePermissionsPass({ request: TENANT_ADMIN_PERMISSIONS.talentMarketplace });
  const allowPositionManagement = usePermissionsPass({ request: TENANT_ADMIN_PERMISSIONS.positionManagement });
  const allowEmployeeProfile = usePermissionsPass({ request: TENANT_ADMIN_PERMISSIONS.employeeProfile });
  const allowAppCenter = usePermissionsPass({ request: TENANT_ADMIN_PERMISSIONS.appCenter });
  const allowTalentReview = usePermissionsPass({ request: TENANT_ADMIN_PERMISSIONS.talentReview });
  const showTalentReview = talentReviewEnabled && allowTalentReview;
  const talentReviewGroup = {
    group: 'talentIntelligence',
    groupLabel: formatMessage({ id: 'tenantAdmin.talentIntelligence' })
  };
  const allowCompanySetting = usePermissionsPass({ request: TENANT_ADMIN_PERMISSIONS.companySetting });
  const allowOrgSetting = usePermissionsPass({ request: TENANT_ADMIN_PERMISSIONS.orgSetting });
  const allowUserManagement = usePermissionsPass({ request: TENANT_ADMIN_PERMISSIONS.userManagement });

  const menuItems = [
    allowHome
      ? {
          path: '/home',
          label: formatMessage({ id: 'tenantAdmin.myProfile' }),
          toolbar: true,
          icon: <HomeMenuIcon />
        }
      : null,
    allowTalentMarketplace
      ? {
          path: '/market',
          label: formatMessage({ id: 'tenantAdmin.internalTalentMarket' }),
          toolbar: true,
          icon: <MarketMenuIcon />
        }
      : null,
    allowPositionManagement
      ? {
          label: formatMessage({ id: 'tenantAdmin.workforceReadiness' }),
          path: '/position',
          icon: <WorkforceMenuIcon />
        }
      : null,
    allowEmployeeProfile
      ? {
          label: formatMessage({ id: 'tenantAdmin.talents' }),
          path: '/employee',
          icon: <TalentsMenuIcon />
        }
      : null,
    appManagerEnabled && allowAppCenter
      ? {
          label: formatMessage({ id: 'tenantAdmin.appCenter' }),
          path: '/apps',
          icon: <AppCenterMenuIcon />
        }
      : null,
    showTalentReview
      ? Object.assign({}, talentReviewGroup, {
          label: formatMessage({ id: 'tenantAdmin.talentReviewProjects' }),
          path: '/talent-review/projects',
          icon: <TalentReviewProjectsMenuIcon />
        })
      : null,
    showTalentReview
      ? Object.assign({}, talentReviewGroup, {
          label: formatMessage({ id: 'tenantAdmin.talentReviewParticipants' }),
          path: '/talent-review/participants',
          icon: <TalentReviewParticipantsMenuIcon />
        })
      : null,
    showTalentReview
      ? Object.assign({}, talentReviewGroup, {
          label: formatMessage({ id: 'tenantAdmin.talentReviewModels' }),
          path: '/talent-review/models',
          icon: <TalentReviewModelsMenuIcon />
        })
      : null,
    // 展示方式为「左菜单」的应用：每个应用一组，菜单项指向 /ext/{应用}/{菜单}，由 AppEmbed 渲染
    ...(allowAppCenter
      ? subApps.flatMap(app =>
          flattenMenus(app.menus, locale).map(({ menu, parent, label }) => ({
            group: `ext:${app.name}`,
            // 应用名称按当前语言取（租户、应用中心、子应用声明合并后的 labelI18n），没有则用默认名称
            groupLabel: app.labelI18n?.[locale] || app.label || app.name,
            label,
            path: `/ext/${app.name}/${menu.fullKey}`,
            icon: resolveSubAppMenuIcon(menu.icon || parent?.icon, app.remote?.url || app.baseUrl)
          }))
        )
      : []),
    allowCompanySetting
      ? {
          group: 'tenantSetting',
          groupLabel: formatMessage({ id: 'tenantAdmin.settings' }),
          label: formatMessage({ id: 'tenantAdmin.companyInfo' }),
          path: '/setting/company',
          icon: <CompanyMenuIcon />
        }
      : null,
    allowOrgSetting
      ? {
          group: 'tenantSetting',
          groupLabel: formatMessage({ id: 'tenantAdmin.settings' }),
          label: formatMessage({ id: 'tenantAdmin.orgStructure' }),
          path: '/setting/org',
          icon: <OrgMenuIcon />
        }
      : null,
    allowUserManagement
      ? {
          group: 'tenantSetting',
          groupLabel: formatMessage({ id: 'tenantAdmin.settings' }),
          label: formatMessage({ id: 'tenantAdmin.userManagement' }),
          path: '/setting/user',
          toolbar: true,
          icon: <UserMenuIcon />
        }
      : null,
    {
      group: 'account',
      groupLabel: formatMessage({ id: 'tenantAdmin.account' }),
      label: formatMessage({ id: 'tenantAdmin.switchTenant' }),
      icon: <SwitchTenantMenuIcon />,
      onClick: () => {
        window.location.href = withPublicUrl('/login-tenant');
      }
    },
    {
      group: 'account',
      groupLabel: formatMessage({ id: 'tenantAdmin.account' }),
      label: formatMessage({ id: 'tenantAdmin.logout' }),
      icon: <LogoutMenuIcon />,
      onClick: logout
    }
  ].filter(Boolean);

  return (
    <SystemLayout
      background={'linear-gradient(180deg, #E8DCDF, #E1D1E3, #DED7EF, #D5E0F1)'}
      logo={{ id: tenant?.logo }}
      userInfo={{
        ...tenantUserInfo,
        extra: (
          <div style={{ paddingTop: '8px' }}>
            <Language colorful={false} />
          </div>
        )
      }}
      menu={{
        base: baseUrl,
        items: menuItems
      }}
    >
      {children}
    </SystemLayout>
  );
};

export default Layout;
