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
import {
  WorkforceMenuIcon,
  TalentsMenuIcon,
  HomeMenuIcon,
  MarketMenuIcon,
  AppCenterMenuIcon,
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
    const { formatMessage } = useIntl();
    const [Authenticate, Permissions, usePermissionsPass, Language, SetGlobal, usePreset] = remoteModules;
    const { capabilities, apis } = usePreset();
    const { data: talentReviewStatus } = useFetch(Object.assign({}, apis.talentSaas.tenant.talentReview.setting));
    const logout = () => getOidcClient().logout();
    return (
      <Authenticate>
        {({ global }) => {
          const { tenantUserInfo, tenant } = global;
          const themeColor = resolveTenantThemeColor({ tenant, tenantUserInfo });
          return (
            <TenantThemeProvider themeColor={themeColor} SetGlobal={SetGlobal}>
              <Permissions request={['tenant-admin']} type="error">
                <TenantAdminMenu
                  baseUrl={baseUrl}
                  appManagerEnabled={!!capabilities?.appManager}
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
              </Permissions>
            </TenantThemeProvider>
          );
        }}
      </Authenticate>
    );
  })
);

const TenantAdminMenu = ({ baseUrl, appManagerEnabled, talentReviewEnabled, tenant, tenantUserInfo, logout, formatMessage, usePermissionsPass, Language, children }) => {
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
