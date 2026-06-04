import language from './language';
import positionStatus from './positionStatus';
import locationType from './locationType';
import employeeStatus from './employeeStatus';
import collegeType from './collegeType';
import recruit from './recruit';
import taskType from './taskType';

export const enums = { language, positionStatus, locationType, employeeStatus, collegeType, recruit, taskType };

const EnumLoader = ({ children }) => {
  if (typeof children !== 'function') {
    return null;
  }
  return children(enums);
};

export default EnumLoader;
