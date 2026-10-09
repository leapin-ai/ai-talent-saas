import { useEffect } from 'react';
import RemoteLoader, { createWithRemoteLoader } from '@kne/remote-loader';
import AppChildrenRouter from '@kne/app-children-router';
import { Navigate } from 'react-router-dom';
import TenantAdmin from '@components/TenantAdmin';
import CompleteProfile from '@components/TenantAdmin/CompleteProfile';
import RootHomeRedirect from '@components/TenantAdmin/RootHomeRedirect';
import TenantPortal from '@components/TenantPortal';
import Admin from '@components/Admin';
import UserSystemLayout from '@components/UserSystemLayout';
import PublicSystemLayout from '@components/PublicSystemLayout';
import { Page } from '@kne/system-layout';
import { getManualTaskAction } from '@components/AssessmentGenerateTask';
import withLocale from './withLocale';
import { useIntl } from '@kne/react-intl';
import { getOidcClient } from './commons/oidcClient';
import './index.scss';

/** JoinInvitation 默认套 components-core Page；在 SystemLayout 下改为只渲染内容 */
const renderWithoutCorePage = pageProps => pageProps?.children ?? null;

const Protected = ({ children }) => <RemoteLoader module="components-admin:Oidc@OidcAuthenticate">{children}</RemoteLoader>;

/** 远程组件内置的退出（useLogout）会跳到 /account/login，统一转为 OIDC 退出 */
const AccountLoginRedirect = () => {
  useEffect(() => {
    getOidcClient().logout();
  }, []);
  return null;
};

const AppContent = withLocale(({ baseUrl, AfterUserLoginLayout, AfterAdminUserLoginLayout }) => {
  const { formatMessage } = useIntl();
  return (
    <AppChildrenRouter
      errorPage
      notFoundPage
      baseUrl={baseUrl}
      list={[
        {
          index: true,
          element: (
            <Protected>
              <RootHomeRedirect baseUrl={baseUrl} />
            </Protected>
          )
        },
        {
          path: 'oidc-interaction',
          title: 'Login',
          element: <RemoteLoader module="components-admin:Oidc@Interaction" systemName="LeapIn Talent SaaS" registerUrl={`${baseUrl}/account/register`} forgetUrl={`${baseUrl}/account/forget`} />
        },
        {
          path: 'oidc-callback',
          title: 'Login',
          element: <RemoteLoader module="components-admin:Oidc@Callback" systemName="LeapIn Talent SaaS" />
        },
        {
          path: 'account/login',
          title: 'Login',
          element: <AccountLoginRedirect />
        },
        {
          path: 'account/*',
          title: 'Account',
          element: <RemoteLoader module="components-admin:Account" baseUrl={baseUrl + '/account'} systemName="LeapIn Talent SaaS" />
        },
        {
          path: 'admin/initAdmin',
          title: 'Init Admin',
          element: (
            <Protected>
              <AppChildrenRouter
                element={<AfterUserLoginLayout />}
                list={[
                  {
                    index: true,
                    element: <RemoteLoader module="components-admin:Admin@InitAdmin" />
                  }
                ]}
              />
            </Protected>
          )
        },
        {
          path: 'admin/*',
          title: 'Admin',
          element: (
            <Protected>
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
                        },
                        {
                          key: 'oidc',
                          title: formatMessage({ id: 'app.OidcManagement' }),
                          path: `${baseUrl}/admin/oidc`
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
                  },
                  {
                    path: 'oidc/*',
                    title: formatMessage({ id: 'app.OidcManagement' }),
                    element: <RemoteLoader module="components-admin:OidcAdmin" baseUrl={`${baseUrl}/admin/oidc`} />
                  }
                ]}
              >
                <Admin baseUrl={baseUrl + '/admin'}>
                  <RemoteLoader module="components-admin:Admin" baseUrl={baseUrl + '/admin'} />
                </Admin>
              </AppChildrenRouter>
            </Protected>
          )
        },
        {
          path: 'collect-profile',
          title: 'Collect Profile',
          element: (
            <PublicSystemLayout>
              <CompleteProfile mode="collect" />
            </PublicSystemLayout>
          )
        },
        {
          path: 'tenant/*',
          element: (
            <Protected>
              <TenantAdmin baseUrl={`${baseUrl}/tenant`} />
            </Protected>
          )
        },
        {
          path: '*',
          element: (
            <Protected>
              <AppChildrenRouter
                baseUrl={baseUrl}
                list={[
                  {
                    path: 'join-tenant',
                    title: 'Join Tenant',
                    element: (
                      <UserSystemLayout>
                        <RemoteLoader module="components-admin:Tenant@JoinInvitation">{renderWithoutCorePage}</RemoteLoader>
                      </UserSystemLayout>
                    )
                  },
                  {
                    path: 'login-tenant',
                    title: 'Login Tenant',
                    element: (
                      <UserSystemLayout>
                        <RemoteLoader module="components-admin:Tenant@LoginTenant" tenantPath={`${baseUrl}/tenant`} embedded>
                          {({ children }) => <Page>{children}</Page>}
                        </RemoteLoader>
                      </UserSystemLayout>
                    )
                  },
                  {
                    path: '*',
                    element: <TenantPortal baseUrl={baseUrl} />
                  }
                ]}
              />
            </Protected>
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
