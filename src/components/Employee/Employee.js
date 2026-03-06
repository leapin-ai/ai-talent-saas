import { createWithRemoteLoader } from '@kne/remote-loader';
import { useIntl } from '@kne/react-intl';
import withLocale from './withLocale';
import getColumns from './getColumns';
import BaseFormInner from './EmployeeForm/BaseFormInner';

const Employee = createWithRemoteLoader({
  modules: ['components-admin:BizUnit', 'components-core:Filter', 'components-core:Common@AddressEnum']
})(
  withLocale(({ remoteModules, baseUrl, apis, onDetail, onPositionDetail, ...props }) => {
    const [BizUnit, Filter, AddressEnum] = remoteModules;
    const { SuperSelectFilterItem } = Filter.fields;
    const { formatMessage } = useIntl();
    return (
      <BizUnit
        {...props}
        apis={apis}
        getColumns={() =>
          getColumns({
            onDetail: colItem => onDetail(colItem),
            onPositionDetail: colItem => onPositionDetail(colItem),
            formatMessage,
            addressRender: value => <AddressEnum name={value} />
          })
        }
        getFormInner={({ apis }) => <BaseFormInner apis={apis} />}
        name="employee"
        filterList={[
          [
            <SuperSelectFilterItem
              name="status"
              label={formatMessage({ id: 'employee.status' })}
              single
              options={[
                { label: formatMessage({ id: 'employeeStatus.ACTIVE' }), value: 'ACTIVE' },
                { label: formatMessage({ id: 'employeeStatus.RESIGN' }), value: 'RESIGN' },
                { label: formatMessage({ id: 'employeeStatus.STOP_SALARY' }), value: 'STOP_SALARY' },
                { label: formatMessage({ id: 'employeeStatus.RETIRE' }), value: 'RETIRE' },
                { label: formatMessage({ id: 'employeeStatus.INTERN' }), value: 'INTERN' },
                { label: formatMessage({ id: 'employeeStatus.PRE_EMPLOYEE' }), value: 'PRE_EMPLOYEE' }
              ]}
            />,
            <SuperSelectFilterItem
              name="gender"
              label={formatMessage({ id: 'employee.gender' })}
              single
              options={[
                { label: formatMessage({ id: 'gender.M' }), value: 'M' },
                { label: formatMessage({ id: 'gender.F' }), value: 'F' }
              ]}
            />
          ]
        ]}
        options={{
          bizName: '员工档案',
          keywordFilterName: 'keyword',
          keywordFilterLabel: '员工关键字'
        }}
      />
    );
  })
);

export default Employee;
