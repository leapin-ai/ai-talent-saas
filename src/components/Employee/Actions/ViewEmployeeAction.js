import { createWithRemoteLoader } from '@kne/remote-loader';
import { useNavigate } from 'react-router-dom';
import { Button } from 'antd';
import withLocale from '../withLocale';
import { useIntl } from '@kne/react-intl';

const ViewEmployeeAction = createWithRemoteLoader({
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
          const query = filterToUrlParams([{ name: 'id', label: 'ID', value: { label: String(data.employee.id), value: String(data.employee.id) } }]);
          navigate(`${baseUrl}/employee?${query.toString()}`);
        }}
      >
        {formatMessage({ id: 'employee.viewEmployee' })}
      </Button>
    );
  })
);

export default ViewEmployeeAction;
