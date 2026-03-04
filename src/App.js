import RemoteLoader, { createWithRemoteLoader } from '@kne/remote-loader';
import AppChildrenRouter from '@kne/app-children-router';
import { Navigate } from 'react-router-dom';
import TenantAdmin from '@components/TenantAdmin';
import TenantPortal from '@components/TenantPortal';
import Admin from '@components/Admin';
import './index.scss';

const App = createWithRemoteLoader({
  modules: ['components-core:Global', 'components-admin:Authenticate@AfterUserLoginLayout', 'components-admin:Authenticate@AfterAdminUserLoginLayout']
})(({ remoteModules, globalPreset }) => {
  const [Global, AfterUserLoginLayout, AfterAdminUserLoginLayout] = remoteModules;
  const baseUrl = '';
  return (
    <Global preset={globalPreset} themeToken={globalPreset.themeToken}>
      <AppChildrenRouter
        errorPage
        notFoundPage
        baseUrl={baseUrl}
        list={[
          {
            path: 'account/*',
            title: 'Account',
            element: <RemoteLoader module="components-admin:Account" baseUrl={baseUrl + '/account'} systemName="AI Coach" />
          },
          {
            path: 'admin/initAdmin',
            title: 'Init Admin',
            element: (
              <AppChildrenRouter
                element={<AfterUserLoginLayout />}
                list={[
                  {
                    index: true,
                    element: <RemoteLoader module="components-admin:Admin@InitAdmin" />
                  }
                ]}
              />
            )
          },
          {
            path: 'admin/*',
            title: 'Admin',
            element: (
              <AppChildrenRouter
                errorPage
                notFoundPage
                baseUrl={baseUrl + '/admin'}
                element={
                  <AfterAdminUserLoginLayout
                    navigation={{
                      base: `${baseUrl}/admin`,
                      showIndex: false,
                      defaultTitle: 'AI Coach',
                      list: [
                        {
                          key: 'task',
                          title: '任务管理',
                          path: `${baseUrl}/admin/task`
                        },
                        {
                          key: 'tenant',
                          title: '租户管理',
                          path: `${baseUrl}/admin/tenant`
                        },
                        {
                          key: 'user',
                          title: '用户管理',
                          path: '/admin/user'
                        },
                        {
                          key: 'file',
                          title: '文件管理',
                          path: `${baseUrl}/admin/file`
                        }
                      ]
                    }}
                  />
                }
                list={[
                  {
                    index: true,
                    element: <Navigate to={`${baseUrl}/admin/tenant`} replace />
                  },
                  {
                    path: 'tenant/*',
                    title: '租户管理',
                    element: <RemoteLoader module="components-admin:TenantAdmin" baseUrl={baseUrl + '/admin'} />
                  },
                  {
                    path: 'task/*',
                    element: <RemoteLoader module="components-admin:Task" baseUrl={baseUrl + '/admin'} />
                  },
                  {
                    path: 'file',
                    title: '文件管理',
                    element: <RemoteLoader module="components-file-manager:FileListPage" />
                  }
                ]}
              >
                <Admin baseUrl={baseUrl + '/admin'}>
                  <RemoteLoader module="components-admin:Admin" baseUrl={baseUrl + '/admin'} />
                </Admin>
              </AppChildrenRouter>
            )
          },
          {
            path: 'tenant/*',
            element: <TenantAdmin baseUrl={`${baseUrl}/tenant`} />
          },
          {
            path: '*',
            element: (
              <AppChildrenRouter
                baseUrl={baseUrl}
                list={[
                  {
                    path: 'join-tenant',
                    title: 'Join Tenant',
                    element: (
                      <AfterUserLoginLayout>
                        <RemoteLoader module="components-admin:Tenant@JoinInvitation" />
                      </AfterUserLoginLayout>
                    )
                  },
                  {
                    path: 'login-tenant',
                    title: 'Login Tenant',
                    element: (
                      <AfterUserLoginLayout>
                        <RemoteLoader module="components-admin:Tenant@LoginTenant" tenantPath={`${baseUrl}/tenant`} />
                      </AfterUserLoginLayout>
                    )
                  },
                  {
                    path: '*',
                    element: <TenantPortal baseUrl={baseUrl} />
                  }
                ]}
              />
            )
          }
        ]}
      />
    </Global>
  );
});

export default App;
