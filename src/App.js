import RemoteLoader, { createWithRemoteLoader } from '@kne/remote-loader';
import AppChildrenRouter from '@kne/app-children-router';
import { Navigate } from 'react-router-dom';
import TenantAdmin from '@components/TenantAdmin';
import TenantPortal from '@components/TenantPortal';
import Admin from '@components/Admin';
import { getManualTaskAction } from '@components/AssessmentGenerateTask';
import withLocale from './withLocale';
import { useIntl } from '@kne/react-intl';
import './index.scss';

const AppContent = withLocale(({ baseUrl, AfterUserLoginLayout, AfterAdminUserLoginLayout }) => {
  const { formatMessage } = useIntl();
  return (
    <AppChildrenRouter
      errorPage
      notFoundPage
      baseUrl={baseUrl}
      list={[
        {
          path: 'account/*',
          title: 'Account',
          element: <RemoteLoader module="components-admin:Account" baseUrl={baseUrl + '/account'} systemName="LeapIn Talent SaaS" />
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
                    defaultTitle: 'AI Talent SaaS',
                    list: [
                      {
                        key: 'task',
                        title: formatMessage({ id: 'app.TaskManagement' }),
                        path: `${baseUrl}/admin/task`
                      },
                      {
                        key: 'tenant',
                        title: formatMessage({ id: 'app.TenantManagement' }),
                        path: `${baseUrl}/admin/tenant`
                      },
                      {
                        key: 'user',
                        title: formatMessage({ id: 'app.UserManagement' }),
                        path: '/admin/user'
                      },
                      {
                        key: 'file',
                        title: formatMessage({ id: 'app.FileManagement' }),
                        path: `${baseUrl}/admin/file`
                      },
                      {
                        key: 'signature',
                        title: formatMessage({ id: 'app.SignatureManagement' }),
                        path: '/admin/signature'
                      },
                      {
                        key: 'message',
                        title: formatMessage({ id: 'app.MessageManagement' }),
                        path: '/admin/message'
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
                  title: formatMessage({ id: 'app.TenantManagement' }),
                  element: <RemoteLoader module="components-admin:TenantAdmin" baseUrl={baseUrl + '/admin'} />
                },
                {
                  path: 'task/*',
                  element: <RemoteLoader module="components-admin:Task" baseUrl={baseUrl + '/admin'} getManualTaskAction={getManualTaskAction} />
                },
                {
                  path: 'file/*',
                  title: formatMessage({ id: 'app.FileManagement' }),
                  element: <RemoteLoader module="components-file-manager:FileListPage" baseUrl={`${baseUrl}/admin/file`} />
                },
                {
                  path: 'signature',
                  title: formatMessage({ id: 'app.SignatureManagement' }),
                  element: <RemoteLoader module="components-admin:Signature" />
                },
                {
                  path: 'message/*',
                  title: formatMessage({ id: 'app.MessageManagement' }),
                  element: <RemoteLoader module="components-admin:MessageManger" baseUrl={`${baseUrl}/admin/message`} />
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
  );
});

const App = createWithRemoteLoader({
  modules: ['components-core:Global', 'components-admin:Authenticate@AfterUserLoginLayout', 'components-admin:Authenticate@AfterAdminUserLoginLayout']
})(({ remoteModules, globalPreset }) => {
  const [Global, AfterUserLoginLayout, AfterAdminUserLoginLayout] = remoteModules;
  const baseUrl = '';
  return (
    <Global preset={globalPreset} themeToken={globalPreset.themeToken}>
      <AppContent baseUrl={baseUrl} AfterUserLoginLayout={AfterUserLoginLayout} AfterAdminUserLoginLayout={AfterAdminUserLoginLayout} />
    </Global>
  );
});

export default App;
