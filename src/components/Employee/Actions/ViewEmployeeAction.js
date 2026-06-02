import { createWithRemoteLoader } from '@kne/remote-loader';
import { useNavigate } from 'react-router-dom';
import { Button } from 'antd';
const ViewEmployeeAction = createWithRemoteLoader({
  modules: ['components-core:Filter@filterToUrlParams']
})(({ remoteModules, data, baseUrl, ...props }) => {
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
      查看员工档案
    </Button>
  );
});

export default ViewEmployeeAction;
