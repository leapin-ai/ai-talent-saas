import { createWithRemoteLoader } from '@kne/remote-loader';
import { useMemo } from 'react';

const TenantUserPlugin = createWithRemoteLoader({
  modules: ['components-core:FormInfo']
})(({ remoteModules, list, apis, ...props }) => {
  const [FormInfo] = remoteModules;
  const { SuperSelect, DatePicker } = FormInfo.fields;

  const formInnerList = useMemo(() => {
    const newList = list.slice(0);
    newList.splice(2, 0, <SuperSelect name="options.position" label="岗位" rule="REQ" labelKey="name" valueKey="id" interceptor="object-output-value" single api={apis.positionList} />);
    newList.splice(7, 0, <DatePicker name="options.joinDate" label="加入公司时间" />, <DatePicker name="options.workStartDate" label="开始工作时间" />);
    return newList;
  }, [list, apis.positionList]);
  return <FormInfo {...props} list={formInnerList} />;
});

export const getUserListColumns = ({ columns }) => {
  const newColumns = columns.slice(0);
  newColumns.splice(
    7,
    0,
    {
      title: '岗位',
      name: 'options.position',
      valueOf: (item, { data }) => {
        const position = data.positionList && data.positionList.find(target => target.id === item.options?.position);
        if (position) {
          return position.name;
        }
      }
    },
    {
      title: '加入公司时间',
      name: 'options.joinDate',
      type: 'date'
    },
    {
      title: '开始工作时间',
      name: 'options.workStartDate',
      type: 'date'
    }
  );
  return newColumns;
};

export default TenantUserPlugin;
