import { createWithRemoteLoader } from '@kne/remote-loader';
import { useNavigate } from 'react-router-dom';
import { Button } from 'antd';
import withLocale from '../withLocale';
import { useIntl } from '@kne/react-intl';

const ViewUserAction = createWithRemoteLoader({
  modules: ['components-core:Filter@filterToUrlParams']
})(
  withLocale(({ remoteModules, data, baseUrl, ...props }) => {
    const { formatMessage } = useIntl();
    const [filterToUrlParams] = remoteModules;
    const navigate = useNavigate();

    return (
      <Button
        {...props}
        onClick={() => {
          const query = filterToUrlParams([{ name: 'id', label: 'ID', value: { label: data.tenantUserId, value: String(data.tenantUserId) } }]);
          navigate(`${baseUrl}/setting/user?${query.toString()}`);
        }}
      >
        {formatMessage({ id: 'employee.viewUser' })}
      </Button>
    );
  })
);

export default ViewUserAction;
