const getColumns = ({ onDetail, onPositionDetail, addressRender, formatMessage }) => {
  return [
    {
      name: 'avatar',
      title: formatMessage({ id: 'employee.avatar' }),
      renderType: 'avatar',
      getValueOf: item => Object.assign({}, { gender: item.gender || 'M' }, { id: item.avatar })
    },
    {
      name: 'name',
      title: formatMessage({ id: 'employee.name' }),
      renderType: 'main',
      onClick: onDetail
    },
    {
      name: 'department',
      title: formatMessage({ id: 'employee.department' }),
      getValueOf: (item, { context } = {}) => {
        const data = context?.data || {};
        const positionId = item.options?.position?.id || item.options?.position;
        if (!positionId) {
          return null;
        }
        const position = data.positionEnums?.find(target => String(target.value) === String(positionId));
        if (!position?.tenantOrgId) {
          return null;
        }
        const org = data.orgEnums?.find(target => String(target.value) === String(position.tenantOrgId));
        return org?.description;
      }
    },
    {
      name: 'position',
      title: formatMessage({ id: 'employee.position' }),
      renderType: 'main',
      onClick: onPositionDetail,
      getValueOf: (item, { context } = {}) => {
        const data = context?.data || {};
        const position = item.options && data.positionEnums?.find(target => String(target.value) === String(item.options.position));
        return position?.description;
      }
    },
    {
      name: 'status',
      title: formatMessage({ id: 'employee.status' }),
      renderType: 'enum',
      moduleName: 'employeeStatus',
      getValueOf: item => item.status && { moduleName: 'employeeStatus', name: item.status }
    },
    {
      name: 'gender',
      title: formatMessage({ id: 'employee.gender' }),
      renderType: 'enum',
      moduleName: 'gender',
      getValueOf: item => item.gender && { moduleName: 'gender', name: item.gender }
    },
    {
      name: 'email',
      title: formatMessage({ id: 'employee.email' })
    },
    {
      name: 'phone',
      title: formatMessage({ id: 'employee.phone' })
    },
    {
      name: 'college',
      title: formatMessage({ id: 'employee.college' })
    },
    {
      name: 'degree',
      title: formatMessage({ id: 'employee.degree' }),
      renderType: 'enum',
      moduleName: 'degreeEnum',
      getValueOf: item => item.degree != null && item.degree !== '' && { moduleName: 'degreeEnum', name: item.degree }
    },
    {
      name: 'city',
      title: formatMessage({ id: 'employee.city' }),
      getValueOf: item => (item.city ? addressRender(item.city) : null)
    },
    {
      name: 'workLocation',
      title: formatMessage({ id: 'employee.workLocation' }),
      getValueOf: item => (item.options?.workLocation ? addressRender(item.options.workLocation) : null)
    },
    {
      name: 'hireDate',
      title: formatMessage({ id: 'employee.hireDate' }),
      format: 'date'
    },
    {
      name: 'description',
      title: formatMessage({ id: 'employee.description' }),
      renderType: 'description',
      ellipsis: true
    }
  ];
};

module.exports = getColumns;
