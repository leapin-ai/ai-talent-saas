import { createWithRemoteLoader } from '@kne/remote-loader';
import { useIntl } from '@kne/react-intl';
import withLocale from './withLocale';
import getColumns from './getColumns';
import BaseFormInner from './EmployeeForm/BaseFormInner';
import { LinkUserAction, UnlinkUserAction, ViewUserAction } from './Actions';

const mapFilterValue = (value, getFilterValue) => ({
  filter: getFilterValue(value)
});

const Employee = createWithRemoteLoader({
  modules: ['components-admin:BizUnit', 'components-core:Filter', 'components-core:Common@AddressEnum']
})(
  withLocale(({ remoteModules, baseUrl, apis, onDetail, onPositionDetail, ...props }) => {
    const [BizUnit, Filter, AddressEnum] = remoteModules;
    const { InputFilterItem, SuperSelectFilterItem } = Filter.fields;
    const { formatMessage } = useIntl();

    const getActionList = ({ data, ...actionProps }) => {
      const actions = [];
      if (data.tenantUserId) {
        actions.push({
          ...actionProps,
          data,
          baseUrl,
          children: '查看用户',
          buttonComponent: ViewUserAction
        });
        actions.push({
          ...actionProps,
          data,
          apis,
          buttonComponent: UnlinkUserAction
        });
      } else {
        actions.push({
          ...actionProps,
          data,
          apis,
          buttonComponent: LinkUserAction
        });
      }
      return actions;
    };

    return (
      <BizUnit
        {...props}
        isNext
        apis={apis}
        getColumns={() =>
          getColumns({
            onDetail,
            onPositionDetail,
            formatMessage,
            addressRender: value => <AddressEnum name={value} />
          })
        }
        getFormInner={({ apis: formApis, action }) => <BaseFormInner apis={formApis} action={action} />}
        getActionList={getActionList}
        name="employee"
        searchParamsValue={[{ name: 'id', label: 'ID' }]}
        filter={{
          list: [
            { type: InputFilterItem, props: { name: 'id', label: 'ID' } },
            {
              type: SuperSelectFilterItem,
              props: {
                name: 'status',
                label: formatMessage({ id: 'employee.status' }),
                single: true,
                options: [
                  { label: formatMessage({ id: 'employeeStatus.ACTIVE' }), value: 'ACTIVE' },
                  { label: formatMessage({ id: 'employeeStatus.RESIGN' }), value: 'RESIGN' },
                  { label: formatMessage({ id: 'employeeStatus.STOP_SALARY' }), value: 'STOP_SALARY' },
                  { label: formatMessage({ id: 'employeeStatus.RETIRE' }), value: 'RETIRE' },
                  { label: formatMessage({ id: 'employeeStatus.INTERN' }), value: 'INTERN' },
                  { label: formatMessage({ id: 'employeeStatus.PRE_EMPLOYEE' }), value: 'PRE_EMPLOYEE' }
                ]
              }
            },
            {
              type: SuperSelectFilterItem,
              props: {
                name: 'gender',
                label: formatMessage({ id: 'employee.gender' }),
                single: true,
                options: [
                  { label: formatMessage({ id: 'gender.M' }), value: 'M' },
                  { label: formatMessage({ id: 'gender.F' }), value: 'F' }
                ]
              }
            }
          ]
        }}
        options={{
          bizName: '员工档案',
          keywordFilterName: 'keyword',
          keywordFilterLabel: '员工关键字',
          mapFilterValue,
          saveData: (data, { fetchOptions }) => {
            const orgIds = Array.isArray(data.tenantOrgIds) ? data.tenantOrgIds : [];
            const tenantOrgs = orgIds
              .map(id => fetchOptions.data.orgEnums.find(item => item.value === id))
              .filter(Boolean)
              .map(org => ({ name: org.description, id: org.value }));
            const position = fetchOptions.data.positionEnums.find(item => item.value === data.options?.position);
            return Object.assign({}, data, {
              tenantOrgIds: tenantOrgs,
              options: Object.assign({}, data.options, {
                position: position ? { name: position.description, id: position.value } : null
              }),
              tenantOrgs
            });
          }
        }}
      />
    );
  })
);

export default Employee;
