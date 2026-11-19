import { Alert, Spin } from 'antd';
import { useParams } from 'react-router-dom';
import RemoteLoader, { createWithRemoteLoader } from '@kne/remote-loader';
import { Page } from '@kne/system-layout';
import withLocale from './withLocale';
import { useIntl } from '@kne/react-intl';
import { matchMenu, useSubAppMenus } from './SubAppMenus';

/**
 * 左菜单里子应用菜单对应的页面：路由 ext/:appName/*。
 * 页面由应用中心远程组件 AppEmbed 渲染（令牌、版本变化、集成方式降级都在其中处理）；
 * 菜单已由应用中心按租户展示设置与用户权限裁剪，找不到应用或菜单时 AppEmbed 会提示。
 */
const SubAppPage = createWithRemoteLoader({
  modules: ['components-core:Global@useGlobalValue']
})(
  withLocale(({ remoteModules, baseUrl }) => {
    const [useGlobalValue] = remoteModules;
    const { formatMessage } = useIntl();
    const { appName, '*': splat } = useParams();
    const { apps, tenantId, loading } = useSubAppMenus();
    const themeToken = useGlobalValue('themeToken');
    const app = apps.find(item => item.name === appName);
    const menu = app && matchMenu(app.menus, splat);

    if (loading && !app) {
      return (
        <Page>
          <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}>
            <Spin />
          </div>
        </Page>
      );
    }
    if (!app || !menu) {
      return (
        <Page>
          <Alert type="warning" showIcon message={formatMessage({ id: 'tenantAdmin.subAppNotFound' })} />
        </Page>
      );
    }
    // 子应用页面自己控制 Page 标题 / 返回 / 操作区，宿主这里不再包 Page，避免出现两层标题
    return <RemoteLoader key={`${tenantId}/${app.name}`} module="components-app-manager:AppEmbed" app={app} menu={menu} baseUrl={`${baseUrl}/ext/${app.name}/${menu.fullKey}`} tenantId={tenantId} themeToken={themeToken} />;
  })
);

export default SubAppPage;
