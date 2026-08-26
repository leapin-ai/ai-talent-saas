import { createWithRemoteLoader } from '@kne/remote-loader';
import { Button } from 'antd';
import withLocale from '../withLocale';
import { useIntl } from '@kne/react-intl';

const LinkEmployeeAction = createWithRemoteLoader({
  modules: ['components-core:FormInfo@useFormModal', 'components-core:FormInfo', 'components-core:Global@usePreset']
})(
  withLocale(({ remoteModules, data, apis, onSuccess, ...props }) => {
    const { formatMessage } = useIntl();
    const [useFormModal, FormInfo, usePreset] = remoteModules;
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
                  <SuperSelect
                    name="employeeId"
                    label={formatMessage({ id: 'employee.selectEmployee' })}
                    rule="REQ"
                    single
                    labelKey="name"
                    valueKey="id"
                    interceptor="object-output-value"
                    api={apis.employeeList}
                    getSearchProps={({ searchText }) => ({
                      filter: { keyword: searchText }
                    })}
                    dataFormat={response => ({
                      list: response.pageData || [],
                      total: response.totalCount || 0
                    })}
                    pagination={{
                      paramsType: 'params'
                    }}
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
