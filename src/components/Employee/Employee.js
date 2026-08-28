import { createWithRemoteLoader } from '@kne/remote-loader';
import { useIntl } from '@kne/react-intl';
import withLocale from './withLocale';
import getColumns from './getColumns';
import BaseFormInner from './EmployeeForm/BaseFormInner';
import { LinkUserAction, UnlinkUserAction, ViewUserAction } from './Actions';
import { TENANT_ADMIN_PERMISSIONS } from '@components/TenantAdmin/constants';

const mapFilterValue = (value, getFilterValue) => ({
  filter: getFilterValue(value)
});

const Employee = createWithRemoteLoader({
  modules: ['components-admin:BizUnit', 'components-core:Filter', 'components-core:Common@AddressEnum', 'components-core:Permissions@usePermissionsPass']
})(
  withLocale(({ remoteModules, baseUrl, apis, onDetail, onPositionDetail, ...props }) => {
    const [BizUnit, Filter, AddressEnum, usePermissionsPass] = remoteModules;
    const { InputFilterItem, SuperSelectFilterItem } = Filter.fields;
    const { formatMessage } = useIntl();
    const canCreate = usePermissionsPass({ request: TENANT_ADMIN_PERMISSIONS.employeeCreate });
    const canEdit = usePermissionsPass({ request: TENANT_ADMIN_PERMISSIONS.employeeEdit });
    const canRemove = usePermissionsPass({ request: TENANT_ADMIN_PERMISSIONS.employeeRemove });
    const canLinkUser = usePermissionsPass({ request: TENANT_ADMIN_PERMISSIONS.employeeLinkUser });
    const canViewUser = usePermissionsPass({ request: TENANT_ADMIN_PERMISSIONS.userManagement });

    const listApis = Object.assign({}, apis, {
      create: canCreate ? apis.create : null,
      save: canEdit ? apis.save : null,
      remove: canRemove ? apis.remove : null
    });

    const getActionList = ({ data, ...actionProps }) => {
      const actions = [];
      if (data.tenantUserId) {
        if (canViewUser) {
          actions.push({
            ...actionProps,
            data,
            baseUrl,
            children: '查看用户',
            buttonComponent: ViewUserAction
          });
        }
        if (canLinkUser) {
          actions.push({
            ...actionProps,
            data,
            apis,
            buttonComponent: UnlinkUserAction
          });
        }
      } else if (canLinkUser) {
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
        apis={listApis}
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
          bizName: formatMessage({ id: 'employee.bizName' }),
          keywordFilterName: 'keyword',
          keywordFilterLabel: '员工关键字',
          mapFilterValue,
          saveData: (data, { fetchOptions }) => {
            const position = (fetchOptions.data.positionEnums || []).find(item => item.value === data.options?.position);
            // 有岗位时部门展示/回填岗位所属部门
            const orgIdFromPosition = position?.tenantOrgId;
            const orgIds = orgIdFromPosition ? [orgIdFromPosition] : Array.isArray(data.tenantOrgIds) ? data.tenantOrgIds : data.tenantOrgIds ? [data.tenantOrgIds] : [];
            const org = orgIds.length ? (fetchOptions.data.orgEnums || []).find(item => String(item.value) === String(orgIds[0])) : null;
            return Object.assign({}, data, {
              tenantOrgIds: org ? { name: org.description, id: org.value } : null,
              options: Object.assign({}, data.options, {
                position: position ? { name: position.description, id: position.value } : null
              })
            });
          }
        }}
      />
    );
  })
);

export default Employee;
