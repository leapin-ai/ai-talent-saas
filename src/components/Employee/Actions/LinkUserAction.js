import { createWithRemoteLoader } from '@kne/remote-loader';
import { Button } from 'antd';
import withLocale from '../withLocale';
import { useIntl } from '@kne/react-intl';

const LinkUserAction = createWithRemoteLoader({
  modules: ['components-core:FormInfo@useFormModal', 'components-admin:UserSelect', 'components-core:FormInfo', 'components-core:Global@usePreset']
})(
  withLocale(({ remoteModules, data, apis, onSuccess, ...props }) => {
    const { formatMessage } = useIntl();
    const [useFormModal, UserSelect, FormInfo, usePreset] = remoteModules;
    const { ajax } = usePreset();
    const formModal = useFormModal();

    return (
      <Button
        {...props}
        onClick={() => {
          formModal({
            title: formatMessage({ id: 'employee.linkUser' }),
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
                  throw new Error(resData.msg || formatMessage({ id: 'employee.linkFailed' }));
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
                    label={formatMessage({ id: 'employee.selectUser' })}
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
        {formatMessage({ id: 'employee.linkUser' })}
      </Button>
    );
  })
);

export default LinkUserAction;
