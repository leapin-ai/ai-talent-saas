const employeeStatus = [
  { description: '在职', value: 'ACTIVE' },
  { description: '离职', value: 'RESIGN' },
  { description: '停薪留职', value: 'STOP_SALARY' },
  { description: '退休', value: 'RETIRE' },
  { description: '实习', value: 'INTERN' },
  { description: '预入职', value: 'PRE_EMPLOYEE' }
];

export const createEmployeeStatus = formatMessage => [
  { description: formatMessage({ id: 'enumLoader.employeeStatusActive' }), value: 'ACTIVE' },
  { description: formatMessage({ id: 'enumLoader.employeeStatusResign' }), value: 'RESIGN' },
  { description: formatMessage({ id: 'enumLoader.employeeStatusStopSalary' }), value: 'STOP_SALARY' },
  { description: formatMessage({ id: 'enumLoader.employeeStatusRetire' }), value: 'RETIRE' },
  { description: formatMessage({ id: 'enumLoader.employeeStatusIntern' }), value: 'INTERN' },
  { description: formatMessage({ id: 'enumLoader.employeeStatusPreEmployee' }), value: 'PRE_EMPLOYEE' }
];

export default employeeStatus;
