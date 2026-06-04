import { createFormatMessage } from './withLocale';

const employeeStatus = ({ locale }) => {
  const formatMessage = createFormatMessage(locale);
  return [
    { description: formatMessage({ id: 'enumLoader.employeeStatusActive' }), value: 'ACTIVE' },
    { description: formatMessage({ id: 'enumLoader.employeeStatusResign' }), value: 'RESIGN' },
    { description: formatMessage({ id: 'enumLoader.employeeStatusStopSalary' }), value: 'STOP_SALARY' },
    { description: formatMessage({ id: 'enumLoader.employeeStatusRetire' }), value: 'RETIRE' },
    { description: formatMessage({ id: 'enumLoader.employeeStatusIntern' }), value: 'INTERN' },
    { description: formatMessage({ id: 'enumLoader.employeeStatusPreEmployee' }), value: 'PRE_EMPLOYEE' }
  ];
};

export default employeeStatus;
