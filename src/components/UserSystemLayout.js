import { createWithRemoteLoader } from '@kne/remote-loader';
import { LogoutOutlined } from '@ant-design/icons';
import SystemLayout from '@kne/system-layout';
import '@kne/system-layout/dist/index.css';
import { useIntl } from '@kne/react-intl';
import { getOidcClient } from '../commons/oidcClient';
import withLocale from '../withLocale';

const BACKGROUND = 'linear-gradient(180deg, #E8DCDF, #E1D1E3, #DED7EF, #D5E0F1)';
// SystemLayout 不传 logo 会回退到内置默认图标；系统暂无 logo，用透明图占位
const EMPTY_LOGO = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="1" height="1"/%3E';

/**
 * 账号已登录、尚未进入租户时的壳：SystemLayout + UserInfo。
 * 用于 join-tenant / login-tenant，避免再套 components-core Layout。
 */
const UserSystemLayout = createWithRemoteLoader({
  modules: ['components-admin:Authenticate@AfterUserLogin', 'components-core:Global@GlobalValue', 'components-admin:Account@Language']
})(
  withLocale(({ remoteModules, children, menuItems }) => {
    const [AfterUserLogin, GlobalValue, Language] = remoteModules;
    const { formatMessage } = useIntl();
    const logout = () => getOidcClient().logout();

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
                    groupLabel: formatMessage({ id: 'app.menuAccount' }),
                    label: formatMessage({ id: 'app.menuLogout' }),
                    icon: <LogoutOutlined />,
                    onClick: logout
                  }
                ];
            return (
              <SystemLayout
                background={BACKGROUND}
                logo={{ src: EMPTY_LOGO }}
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
  })
);

export default UserSystemLayout;
