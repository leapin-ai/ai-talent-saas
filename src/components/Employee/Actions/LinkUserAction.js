import { createWithRemoteLoader } from '@kne/remote-loader';
import { Button } from 'antd';

const LinkUserAction = createWithRemoteLoader({
  modules: ['components-core:FormInfo@useFormModal', 'components-admin:UserSelect', 'components-core:FormInfo', 'components-core:Global@usePreset']
})(({ remoteModules, data, apis, onSuccess, ...props }) => {
  const [useFormModal, UserSelect, FormInfo, usePreset] = remoteModules;
  const { ajax } = usePreset();
  const formModal = useFormModal();

  return (
    <Button
      {...props}
      onClick={() => {
        formModal({
          title: '关联用户',
          size: 'small',
          formProps: {
            onSubmit: async formData => {
              const { data: resData } = await ajax(
                Object.assign({}, apis.linkTenantUser, {
                  data: {
                    id: data.id,
                    tenantUserId: formData.tenantUserId
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
                  name="tenantUserId"
                  label="选择用户"
                  rule="REQ"
                  single
                  api={apis.userList}
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
      关联用户
    </Button>
  );
});

export default LinkUserAction;
