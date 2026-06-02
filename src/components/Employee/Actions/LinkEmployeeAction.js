import { createWithRemoteLoader } from '@kne/remote-loader';
import { Button } from 'antd';

const LinkEmployeeAction = createWithRemoteLoader({
  modules: ['components-core:FormInfo@useFormModal', 'components-core:FormInfo', 'components-core:Global@usePreset', 'components-admin:UserSelect']
})(({ remoteModules, data, apis, onSuccess, ...props }) => {
  const [useFormModal, FormInfo, usePreset, UserSelect] = remoteModules;
  const { SuperSelect } = FormInfo.fields;
  const { ajax } = usePreset();
  const formModal = useFormModal();

  return (
    <Button
      {...props}
      onClick={() => {
        formModal({
          title: '关联员工档案',
          size: 'small',
          formProps: {
            onSubmit: async formData => {
              const { data: resData } = await ajax(
                Object.assign({}, apis.linkTenantUser, {
                  data: {
                    id: formData.employeeId,
                    tenantUserId: data.id
                  }
                })
              );
              if (resData.code !== 0) {
                throw new Error(resData.msg || '关联失败');
              }
              onSuccess && onSuccess();
            }
          },
          children: (
            <FormInfo
              column={1}
              list={[
                <UserSelect
                  name="employeeId"
                  label="选择员工"
                  rule="REQ"
                  single
                  api={apis.employeeList}
                  interceptor="object-output-value"
                  getSearchProps={({ searchText }) => ({
                    filter: { keyword: searchText }
                  })}
                />
              ]}
            />
          )
        });
      }}
    >
      关联员工档案
    </Button>
  );
});

export default LinkEmployeeAction;
