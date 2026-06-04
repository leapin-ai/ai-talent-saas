import { useIntl } from '@kne/react-intl';
import withLocale from '../withLocale';

const createPaySalary = formatMessage => value => {
  if (value?.description && value?.description.length > 50) {
    return {
      result: false,
      errMsg: formatMessage({ id: 'position.salaryDescMaxLength' })
    };
  }
  if (!value?.minimumAmount && !value?.maximumAmount) {
    return {
      result: true,
      errMsg: ''
    };
  }
  if (!value?.minimumAmount) {
    return {
      result: false,
      errMsg: formatMessage({ id: 'position.salaryMinRequired' })
    };
  }
  if (!value?.maximumAmount) {
    return {
      result: false,
      errMsg: formatMessage({ id: 'position.salaryMaxRequired' })
    };
  }
  if (value?.minimumAmount > value?.maximumAmount) {
    return {
      result: false,
      errMsg: formatMessage({ id: 'position.salaryMinGreaterThanMax' })
    };
  }

  return {
    result: true,
    errMsg: ''
  };
};

const PaySalaryWithIntl = withLocale(() => {
  const { formatMessage } = useIntl();
  return createPaySalary(formatMessage);
});

export { createPaySalary };

export default PaySalaryWithIntl;
