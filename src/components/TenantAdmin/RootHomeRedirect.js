import { Navigate } from 'react-router-dom';
import { createWithRemoteLoader } from '@kne/remote-loader';
import Fetch from '@kne/react-fetch';
import { resolveTenantHomeUrl, DEFAULT_HOME_PATH } from './constants';

const RootHomeRedirect = createWithRemoteLoader({
  modules: ['components-admin:Tenant@Authenticate', 'components-core:Global@usePreset']
})(({ remoteModules, baseUrl = '' }) => {
  const [Authenticate, usePreset] = remoteModules;
  const { apis } = usePreset();
  return (
    <Authenticate>
      {() => (
        <Fetch {...apis.talentSaas.tenant.homeSetting.detail} error={<Navigate to={`${baseUrl}/tenant/home`} replace />} render={({ data }) => <Navigate to={resolveTenantHomeUrl(baseUrl, data?.homePath || DEFAULT_HOME_PATH)} replace />} />
      )}
    </Authenticate>
  );
});

export default RootHomeRedirect;
