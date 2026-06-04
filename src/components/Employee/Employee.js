import { createWithRemoteLoader } from '@kne/remote-loader';
import { useIntl } from '@kne/react-intl';
import { useEffect, useState } from 'react';
import withLocale from './withLocale';
import getColumns from './getColumns';
import BaseFormInner from './EmployeeForm/BaseFormInner';
import { LinkUserAction, UnlinkUserAction, ViewUserAction } from './Actions';
import { Button } from 'antd';
import { useSearchParams } from 'react-router-dom';

const Employee = createWithRemoteLoader({
  modules: ['components-admin:BizUnit', 'components-core:Filter', 'components-core:Common@AddressEnum']
})(
  withLocale(({ remoteModules, baseUrl, apis, onDetail, onPositionDetail, ...props }) => {
    const [BizUnit, Filter, AddressEnum] = remoteModules;
    const { InputFilterItem, SuperSelectFilterItem } = Filter.fields;
    const { formatMessage } = useIntl();
    const [refreshKey, setRefreshKey] = useState(0);
    const [searchParams, setSearchParams] = useSearchParams();
    const filterList = [
      [
        <InputFilterItem key="id" label="ID" name="id" />,
        <SuperSelectFilterItem
          key="status"
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
          key="gender"
          name="gender"
          label={formatMessage({ id: 'employee.gender' })}
          single
          options={[
            { label: formatMessage({ id: 'gender.M' }), value: 'M' },
            { label: formatMessage({ id: 'gender.F' }), value: 'F' }
          ]}
        />
      ]
    ];

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
          buttonComponent: UnlinkUserAction,
          onSuccess: () => setRefreshKey(prev => prev + 1)
        });
      } else {
        actions.push({
          ...actionProps,
          data,
          apis,
          buttonComponent: LinkUserAction,
          onSuccess: () => setRefreshKey(prev => prev + 1)
        });
      }
      return actions;
    };

    return (
      <BizUnit
        key={refreshKey}
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
        getFormInner={({ apis, action }) => <BaseFormInner apis={apis} action={action} />}
        getActionList={getActionList}
        name="employee"
        filterList={filterList}
        urlFilterValue={[{ name: 'id', label: 'ID' }]}
        options={{
          bizName: '员工档案',
          keywordFilterName: 'keyword',
          keywordFilterLabel: '员工关键字',
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
