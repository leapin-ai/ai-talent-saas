import { createWithRemoteLoader } from '@kne/remote-loader';
import { UserSwitchOutlined, LogoutOutlined } from '@ant-design/icons';
import SystemLayout from '@kne/system-layout';
import { Outlet } from 'react-router-dom';
import '@kne/system-layout/dist/index.css';

const Layout = createWithRemoteLoader({
  modules: ['components-admin:Tenant@Authenticate', 'components-admin:Account@useLogout', 'components-core:Permissions']
})(({ remoteModules, baseUrl, children }) => {
  const [Authenticate, useLogout, Permissions] = remoteModules;
  const logout = useLogout();
  return (
    <Authenticate>
      {({ global }) => {
        const { tenantUserInfo, tenant } = global;
        return (
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
                    groupLabel: 'Account',
                    label: 'Switch Tenant',
                    icon: <UserSwitchOutlined />,
                    onClick: () => {
                      window.location.href = '/login-tenant';
                    }
                  },
                  {
                    group: 'account',
                    groupLabel: 'Account',
                    label: 'Logout',
                    icon: <LogoutOutlined />,
                    onClick: logout
                  }
                ]
              }}
            >
              {children || <Outlet />}
            </SystemLayout>
          </Permissions>
        );
      }}
    </Authenticate>
  );
});

export default Layout;
