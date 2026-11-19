import { createWithRemoteLoader } from '@kne/remote-loader';
import { Empty } from 'antd';

/**
 * 超级管理员：租户详情 → 设置 → 应用展示方式。
 * 设置按当前租户保存（tenantId），后端只放行超级管理员；应用中心未启用时不展示。
 * 应用的多语言名称按租户支持的语言（tenant.supportLanguage）配置。
 */
const AppDisplaySetting = createWithRemoteLoader({
  modules: ['components-core:Global@usePreset', 'components-app-manager:AppDisplaySettings']
})(({ remoteModules, tenant }) => {
  const [usePreset, AppDisplaySettings] = remoteModules;
  const { capabilities } = usePreset();
  if (!capabilities?.appManager) {
    return <Empty description="应用中心未启用" />;
  }
  return <AppDisplaySettings tenantId={tenant?.id} languages={tenant?.supportLanguage} />;
});

export default AppDisplaySetting;
