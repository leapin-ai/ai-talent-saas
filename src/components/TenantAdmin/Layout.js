import { createWithRemoteLoader } from '@kne/remote-loader';
import { UserSwitchOutlined, LogoutOutlined, PartitionOutlined, UserOutlined } from '@ant-design/icons';
import { FaRegBuilding, FaUserTie } from 'react-icons/fa';
import SystemLayout from '@kne/system-layout';
import { Outlet } from 'react-router-dom';
import { MdGroups, MdWork } from 'react-icons/md';
import '@kne/system-layout/dist/index.css';
import withLocale from './withLocale';
import { useIntl } from '@kne/react-intl';

const Layout = createWithRemoteLoader({
  modules: ['components-admin:Tenant@Authenticate', 'components-admin:Account@useLogout', 'components-core:Permissions', 'components-admin:Account@Language']
})(
  withLocale(({ remoteModules, baseUrl, children }) => {
    const { formatMessage } = useIntl();
    const [Authenticate, useLogout, Permissions, Language] = remoteModules;
    const logout = useLogout();
    return (
      <Authenticate>
        {({ global }) => {
          const { tenantUserInfo, tenant } = global;
          return (
            <Permissions request={['tenant-admin']} type="error">
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
                  items: [
                    {
                      path: '/',
                      label: formatMessage({ id: 'tenantAdmin.internalTalentMarket' }),
                      toolbar: true,
                      icon: (
                        <span className="anticon">
                          <MdGroups />
                        </span>
                      )
                    },
                    {
                      label: formatMessage({ id: 'tenantAdmin.positionManagement' }),
                      path: '/position',
                      icon: (
                        <span className="anticon">
                          <MdWork />
                        </span>
                      )
                    },
                    {
                      label: formatMessage({ id: 'tenantAdmin.employeeProfile' }),
                      path: '/employee',
                      icon: (
                        <span className="anticon">
                          <FaUserTie />
                        </span>
                      )
                    },
                    {
                      group: 'hiring',
                      groupLabel: 'Hiring Intelligence',
                      label: 'Role Strategy',
                      path: '/hiring',
                      icon: (
                        <span className="anticon">
                          <FaRegBuilding />
                        </span>
                      )
                    },
                    {
                      group: 'hiring',
                      label: 'Candidate Insights',
                      path: '/hiring/candidate',
                      icon: (
                        <span className="anticon">
                          <FaRegBuilding />
                        </span>
                      )
                    },
                    {
                      group: 'hiring',
                      label: 'Interview Intelligence',
                      path: '/hiring/ai-interview',
                      icon: (
                        <span className="anticon">
                          <FaRegBuilding />
                        </span>
                      )
                    },
                    {
                      group: 'hiring',
                      label: 'Talent Pools',
                      path: '/hiring/talent-pool',
                      icon: (
                        <span className="anticon">
                          <FaRegBuilding />
                        </span>
                      )
                    },
                    {
                      group: 'tenantSetting',
                      groupLabel: formatMessage({ id: 'tenantAdmin.settings' }),
                      label: formatMessage({ id: 'tenantAdmin.companyInfo' }),
                      path: '/setting/company',
                      toolbar: true,
                      icon: (
                        <span className="anticon">
                          <FaRegBuilding />
                        </span>
                      )
                    },
                    {
                      group: 'tenantSetting',
                      groupLabel: formatMessage({ id: 'tenantAdmin.settings' }),
                      label: formatMessage({ id: 'tenantAdmin.orgStructure' }),
                      path: '/setting/org',
                      toolbar: true,
                      icon: <PartitionOutlined />
                    },
                    {
                      group: 'tenantSetting',
                      groupLabel: formatMessage({ id: 'tenantAdmin.settings' }),
                      label: formatMessage({ id: 'tenantAdmin.userManagement' }),
                      path: '/setting/user',
                      toolbar: true,
                      icon: <UserOutlined />
                    },
                    {
                      group: 'account',
                      groupLabel: formatMessage({ id: 'tenantAdmin.account' }),
                      label: formatMessage({ id: 'tenantAdmin.switchTenant' }),
                      icon: <UserSwitchOutlined />,
                      onClick: () => {
                        window.location.href = '/login-tenant';
                      }
                    },
                    {
                      group: 'account',
                      groupLabel: formatMessage({ id: 'tenantAdmin.account' }),
                      label: formatMessage({ id: 'tenantAdmin.logout' }),
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
  })
);

export default Layout;
