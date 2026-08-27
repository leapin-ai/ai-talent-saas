import { Navigate } from 'react-router-dom';
import { createWithRemoteLoader } from '@kne/remote-loader';
import Fetch from '@kne/react-fetch';
import Home from './Home';
import { normalizeHomePath, DEFAULT_HOME_PATH } from './constants';

/**
 * /tenant 入口：按首页设置跳转。
 * homePath 为 / 时渲染首页；否则跳到 /tenant{homePath}（如 /market → /tenant/market）。
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
      error={<Home baseUrl={baseUrl} />}
      render={({ data }) => {
        const homePath = normalizeHomePath(data?.homePath || DEFAULT_HOME_PATH);
        if (homePath === '/') {
          return <Home baseUrl={baseUrl} />;
        }
        return <Navigate to={`${tenantBase}${homePath}`} replace />;
      }}
    />
  );
});

export default TenantHomeRedirect;
