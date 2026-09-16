import { createWithRemoteLoader } from '@kne/remote-loader';
import { LogoutOutlined } from '@ant-design/icons';
import SystemLayout from '@kne/system-layout';
import '@kne/system-layout/dist/index.css';

const BACKGROUND = 'linear-gradient(180deg, #E8DCDF, #E1D1E3, #DED7EF, #D5E0F1)';

/**
 * 账号已登录、尚未进入租户时的壳：SystemLayout + UserInfo。
 * 用于 join-tenant / login-tenant，避免再套 components-core Layout。
 */
const UserSystemLayout = createWithRemoteLoader({
  modules: ['components-admin:Authenticate@AfterUserLogin', 'components-core:Global@GlobalValue', 'components-admin:Account@useLogout', 'components-admin:Account@Language']
})(({ remoteModules, children, menuItems }) => {
  const [AfterUserLogin, GlobalValue, useLogout, Language] = remoteModules;
  const logout = useLogout();

  return (
    <AfterUserLogin>
      <GlobalValue globalKey="userInfo">
        {({ value }) => {
          const user = Object.assign({}, value?.value);
          const items = Array.isArray(menuItems)
            ? menuItems
            : [
                {
                  group: 'account',
                  groupLabel: 'Account',
                  label: 'Logout',
                  icon: <LogoutOutlined />,
                  onClick: logout
                }
              ];
          return (
            <SystemLayout
              background={BACKGROUND}
              userInfo={{
                name: user.nickname || user.name,
                email: user.email,
                avatar: user.avatar,
                phone: user.phone,
                extra: (
                  <div style={{ paddingTop: 8 }}>
                    <Language colorful={false} />
                  </div>
                )
              }}
              menu={{
                base: '',
                items
              }}
            >
              {children}
            </SystemLayout>
          );
        }}
      </GlobalValue>
    </AfterUserLogin>
  );
});

export default UserSystemLayout;
