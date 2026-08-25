import { useNavigate } from 'react-router-dom';
import { Button } from 'antd';
import withLocale from '../withLocale';
import { useIntl } from '@kne/react-intl';

const ViewUserAction = withLocale(({ data, baseUrl, ...props }) => {
  const { formatMessage } = useIntl();
  const navigate = useNavigate();

  return (
    <Button
      {...props}
      onClick={() => {
        const query = new URLSearchParams({ userId: String(data.tenantUserId) });
        navigate(`${baseUrl}/setting/user?${query.toString()}`);
      }}
    >
      {formatMessage({ id: 'employee.viewUser' })}
    </Button>
  );
});

export default ViewUserAction;
