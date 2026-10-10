import { createWithRemoteLoader } from '@kne/remote-loader';
import { UserSwitchOutlined, LogoutOutlined } from '@ant-design/icons';
import SystemLayout from '@kne/system-layout';
import { Outlet } from 'react-router-dom';
import '@kne/system-layout/dist/index.css';
import TenantThemeProvider from '../../commons/TenantThemeProvider';
import { resolveTenantThemeColor } from '../../commons/themeColor';
import { withPublicUrl } from '../../commons/publicUrl';
import { getOidcClient } from '../../commons/oidcClient';
import { useIntl } from '@kne/react-intl';
import withLocale from '../../withLocale';

const Layout = createWithRemoteLoader({
  modules: ['components-admin:Tenant@Authenticate', 'components-core:Permissions', 'components-core:Global@SetGlobal']
})(
  withLocale(({ remoteModules, baseUrl, children }) => {
    const [Authenticate, Permissions, SetGlobal] = remoteModules;
    const { formatMessage } = useIntl();
    const logout = () => getOidcClient().logout();
    return (
      <Authenticate>
        {({ global }) => {
          const { tenantUserInfo, tenant } = global;
          const themeColor = resolveTenantThemeColor({ tenant, tenantUserInfo });
          return (
            <TenantThemeProvider themeColor={themeColor} SetGlobal={SetGlobal}>
              <Permissions request={['tenant-portal']} type="error">
                <SystemLayout
                  background={'linear-gradient(180deg, #E8DCDF, #E1D1E3, #DED7EF, #D5E0F1)'}
                  logo={{ id: tenant?.logo }}
                  userInfo={tenantUserInfo}
                  menu={{
                    base: baseUrl,
                    items: [
                      /*{
                      path: '/',
                      label: 'Dashboard',
                      toolbar: true,
                      icon: 'home'
                    }*/
                      {
                        group: 'account',
                        groupLabel: formatMessage({ id: 'app.menuAccount' }),
                        label: formatMessage({ id: 'app.menuSwitchTenant' }),
                        icon: <UserSwitchOutlined />,
                        onClick: () => {
                          window.location.href = withPublicUrl('/login-tenant');
                        }
                      },
                      {
                        group: 'account',
                        groupLabel: formatMessage({ id: 'app.menuAccount' }),
                        label: formatMessage({ id: 'app.menuLogout' }),
                        icon: <LogoutOutlined />,
                        onClick: logout
                      }
                    ]
                  }}
                >
                  {children || <Outlet />}
                </SystemLayout>
              </Permissions>
            </TenantThemeProvider>
          );
        }}
      </Authenticate>
    );
  })
);

export default Layout;
