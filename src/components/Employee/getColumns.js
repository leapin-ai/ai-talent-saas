const getColumns = ({ onDetail, formatMessage }) => {
  return [
    {
      name: 'name',
      title: formatMessage({ id: 'employee.name' }),
      onClick: onDetail,
      type: 'mainInfo'
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
      type: 'text'
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
