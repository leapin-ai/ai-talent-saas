import { createWithRemoteLoader } from '@kne/remote-loader';
import { Button } from 'antd';
import withLocale from '../withLocale';
import { useIntl } from '@kne/react-intl';

const LinkEmployeeAction = createWithRemoteLoader({
  modules: ['components-core:FormInfo@useFormModal', 'components-core:FormInfo', 'components-core:Global@usePreset', 'components-admin:UserSelect']
})(
  withLocale(({ remoteModules, data, apis, onSuccess, ...props }) => {
    const { formatMessage } = useIntl();
    const [useFormModal, FormInfo, usePreset, UserSelect] = remoteModules;
    const { SuperSelect } = FormInfo.fields;
    const { ajax } = usePreset();
    const formModal = useFormModal();

    return (
      <Button
        {...props}
        onClick={() => {
          formModal({
            title: formatMessage({ id: 'employee.linkEmployee' }),
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
                    name="employeeId"
                    label={formatMessage({ id: 'employee.selectEmployee' })}
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
        {formatMessage({ id: 'employee.linkEmployee' })}
      </Button>
    );
  })
);

export default LinkEmployeeAction;
