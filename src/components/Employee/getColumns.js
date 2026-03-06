const getColumns = ({ onDetail, onPositionDetail, addressRender, formatMessage }) => {
  return [
    {
      name: 'avatar',
      title: formatMessage({ id: 'employee.avatar' }),
      type: 'avatar',
      valueOf: (item, { name }) => Object.assign({}, { gender: item['gender'] || 'M' }, { id: item[name] })
    },
    {
      name: 'name',
      title: formatMessage({ id: 'employee.name' }),
      onClick: onDetail,
      type: 'mainInfo'
    },
    {
      name: 'position',
      title: formatMessage({ id: 'employee.position' }),
      type: 'mainInfo',
      onClick: onPositionDetail,
      valueOf: (item, { data }) => {
        const position = item.options && data.positionEnums.find(target => target.value === item.options.position);
        return position?.description;
      }
    },
    {
      name: 'department',
      title: formatMessage({ id: 'employee.department' }),
      valueOf: (item, { data }) => {
        const department = item.options && data.orgEnums.find(target => target.value === item.options.tenantOrgId);
        return department?.description;
      }
    },
    {
      name: 'status',
      title: formatMessage({ id: 'employee.status' }),
      type: 'tag',
      valueOf: item => ({
        isEnum: true,
        moduleName: 'employeeStatus',
        name: item.status
      })
    },
    {
      name: 'gender',
      title: formatMessage({ id: 'employee.gender' }),
      type: 'tag',
      valueOf: item => ({
        isEnum: true,
        moduleName: 'gender',
        name: item.gender
      })
    },
    {
      name: 'email',
      title: formatMessage({ id: 'employee.email' }),
      type: 'text'
    },
    {
      name: 'phone',
      title: formatMessage({ id: 'employee.phone' }),
      type: 'text'
    },
    {
      name: 'college',
      title: formatMessage({ id: 'employee.college' }),
      type: 'text'
    },
    {
      name: 'degree',
      title: formatMessage({ id: 'employee.degree' }),
      type: 'tag',
      valueOf: item => ({
        isEnum: true,
        moduleName: 'degreeEnum',
        name: item.degree
      })
    },
    {
      name: 'city',
      title: formatMessage({ id: 'employee.city' }),
      valueOf: item => {
        return item.city && addressRender(item.city);
      }
    },
    {
      name: 'hireDate',
      title: formatMessage({ id: 'employee.hireDate' }),
      type: 'date'
    },
    {
      name: 'description',
      title: formatMessage({ id: 'employee.description' }),
      type: 'description'
    }
  ];
};

module.exports = getColumns;
