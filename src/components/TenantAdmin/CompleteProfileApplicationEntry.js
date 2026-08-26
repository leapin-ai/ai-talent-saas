import { Badge, Button } from 'antd';
import Fetch from '@kne/react-fetch';
import { createWithRemoteLoader } from '@kne/remote-loader';
import { useNavigate } from 'react-router-dom';
import { useIntl } from '@kne/react-intl';
import withLocale from './withLocale';

const CompleteProfileApplicationEntry = createWithRemoteLoader({
  modules: ['components-core:Global@usePreset']
})(
  withLocale(({ remoteModules, baseUrl }) => {
    const [usePreset] = remoteModules;
    const { apis } = usePreset();
    const navigate = useNavigate();
    const { formatMessage } = useIntl();

    return (
      <Fetch
        {...apis.talentSaas.tenant.assessment.list}
        params={{ perPage: 1, currentPage: 1, filter: { status: 'submitted' } }}
        error={null}
        render={({ data }) => {
          const count = data?.totalCount || 0;
          if (!count) {
            return null;
          }
          return (
            <Badge count={count} overflowCount={99}>
              <Button type="primary" onClick={() => navigate(`${baseUrl}/complete-profile-applications`)}>
                {formatMessage({ id: 'tenantAdmin.completeProfileApplications' })}
              </Button>
            </Badge>
          );
        }}
      />
    );
  })
);

export default CompleteProfileApplicationEntry;
