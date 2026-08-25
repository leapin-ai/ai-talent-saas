import { useNavigate } from 'react-router-dom';
import { Button } from 'antd';
import withLocale from '../withLocale';
import { useIntl } from '@kne/react-intl';

const ViewEmployeeAction = withLocale(({ data, baseUrl, ...props }) => {
  const { formatMessage } = useIntl();
  const navigate = useNavigate();

  return (
    <Button
      {...props}
      onClick={() => {
        const query = new URLSearchParams({ id: String(data.employee.id) });
        navigate(`${baseUrl}/employee?${query.toString()}`);
      }}
    >
      {formatMessage({ id: 'employee.viewEmployee' })}
    </Button>
  );
});

export default ViewEmployeeAction;
