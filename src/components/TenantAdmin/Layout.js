import { createWithRemoteLoader } from '@kne/remote-loader';
import SystemLayout from '@kne/system-layout';
import { Outlet } from 'react-router-dom';
import '@kne/system-layout/dist/index.css';
import withLocale from './withLocale';
import { useIntl } from '@kne/react-intl';
import { TENANT_ADMIN_PERMISSIONS } from './constants';
import TenantThemeProvider from '../../commons/TenantThemeProvider';
import { resolveTenantThemeColor } from '../../commons/themeColor';
import { WorkforceMenuIcon, TalentsMenuIcon, HomeMenuIcon, CompanyMenuIcon, OrgMenuIcon, UserMenuIcon, SwitchTenantMenuIcon, LogoutMenuIcon } from './MenuIcons';

const Layout = createWithRemoteLoader({
  modules: [
    'components-admin:Tenant@Authenticate',
    'components-admin:Account@useLogout',
    'components-core:Permissions',
    'components-core:Permissions@usePermissionsPass',
    'components-admin:Account@Language',
    'components-core:Global@SetGlobal'
  ]
})(
  withLocale(({ remoteModules, baseUrl, children }) => {
    const { formatMessage } = useIntl();
    const [Authenticate, useLogout, Permissions, usePermissionsPass, Language, SetGlobal] = remoteModules;
    const logout = useLogout();
    return (
      <Authenticate>
        {({ global }) => {
          const { tenantUserInfo, tenant } = global;
          const themeColor = resolveTenantThemeColor({ tenant, tenantUserInfo });
          return (
            <TenantThemeProvider themeColor={themeColor} SetGlobal={SetGlobal}>
              <Permissions request={['tenant-admin']} type="error">
                <TenantAdminMenu baseUrl={baseUrl} tenant={tenant} tenantUserInfo={tenantUserInfo} logout={logout} formatMessage={formatMessage} usePermissionsPass={usePermissionsPass} Language={Language}>
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

const TenantAdminMenu = ({ baseUrl, tenant, tenantUserInfo, logout, formatMessage, usePermissionsPass, Language, children }) => {
  const allowHome = usePermissionsPass({ request: TENANT_ADMIN_PERMISSIONS.home });
  const allowPositionManagement = usePermissionsPass({ request: TENANT_ADMIN_PERMISSIONS.positionManagement });
  const allowEmployeeProfile = usePermissionsPass({ request: TENANT_ADMIN_PERMISSIONS.employeeProfile });
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
    allowCompanySetting
      ? {
          group: 'tenantSetting',
          groupLabel: formatMessage({ id: 'tenantAdmin.settings' }),
          label: formatMessage({ id: 'tenantAdmin.companyInfo' }),
          path: '/setting/company',
          toolbar: true,
          icon: <CompanyMenuIcon />
        }
      : null,
    allowOrgSetting
      ? {
          group: 'tenantSetting',
          groupLabel: formatMessage({ id: 'tenantAdmin.settings' }),
          label: formatMessage({ id: 'tenantAdmin.orgStructure' }),
          path: '/setting/org',
          toolbar: true,
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
        window.location.href = '/login-tenant';
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
