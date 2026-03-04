import { createWithRemoteLoader } from '@kne/remote-loader';
import { UserSwitchOutlined, LogoutOutlined, PartitionOutlined, UserOutlined } from '@ant-design/icons';
import { FaRegBuilding, FaUserTie } from 'react-icons/fa';
import SystemLayout from '@kne/system-layout';
import { Outlet } from 'react-router-dom';
import { MdGroups, MdWork } from 'react-icons/md';
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
          <Permissions request={['tenant-admin']} type="error">
            <SystemLayout
              background={'linear-gradient(180deg, #E8DCDF, #E1D1E3, #DED7EF, #D5E0F1)'}
              logo={{ id: tenant?.logo }}
              userInfo={tenantUserInfo}
              menu={{
                base: baseUrl,
                items: [
                  {
                    path: '/',
                    label: '内部人才市场',
                    toolbar: true,
                    icon: (
                      <span className="anticon">
                        <MdGroups />
                      </span>
                    )
                  },
                  {
                    label: '岗位管理',
                    path: '/position',
                    icon: (
                      <span className="anticon">
                        <MdWork />
                      </span>
                    )
                  },
                  {
                    label: '员工档案',
                    path: '/employee',
                    icon: (
                      <span className="anticon">
                        <FaUserTie />
                      </span>
                    )
                  },
                  {
                    group: 'tenantSetting',
                    groupLabel: '设置',
                    label: '公司信息',
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
                    groupLabel: '设置',
                    label: '组织架构',
                    path: '/setting/org',
                    toolbar: true,
                    icon: <PartitionOutlined />
                  },
                  {
                    group: 'tenantSetting',
                    groupLabel: '设置',
                    label: '用户管理',
                    path: '/setting/user',
                    toolbar: true,
                    icon: <UserOutlined />
                  },
                  {
                    group: 'account',
                    groupLabel: '账号',
                    label: '切换租户',
                    icon: <UserSwitchOutlined />,
                    onClick: () => {
                      window.location.href = '/login-tenant';
                    }
                  },
                  {
                    group: 'account',
                    groupLabel: '账号',
                    label: '退出登录',
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
