import { Navigate } from 'react-router-dom';
import { createWithRemoteLoader } from '@kne/remote-loader';
import Fetch from '@kne/react-fetch';
import { normalizeHomePath, DEFAULT_HOME_PATH } from './constants';

/**
 * /tenant 入口：按首页设置跳转到 {baseUrl}{homePath}（默认 /tenant/home）。
 */
const TenantHomeRedirect = createWithRemoteLoader({
  modules: ['components-core:Global@usePreset']
})(({ remoteModules, baseUrl = '/tenant' }) => {
  const [usePreset] = remoteModules;
  const { apis } = usePreset();
  const tenantBase = String(baseUrl || '/tenant').replace(/\/+$/, '') || '/tenant';

  return (
    <Fetch
      {...apis.talentSaas.tenant.homeSetting.detail}
      error={<Navigate to={`${tenantBase}${DEFAULT_HOME_PATH}`} replace />}
      render={({ data }) => {
        const homePath = normalizeHomePath(data?.homePath || DEFAULT_HOME_PATH);
        return <Navigate to={`${tenantBase}${homePath}`} replace />;
      }}
    />
  );
});

export default TenantHomeRedirect;
