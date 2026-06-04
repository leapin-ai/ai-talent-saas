import language, { createLanguage } from './language';
import positionStatus, { createPositionStatus } from './positionStatus';
import locationType, { createLocationType } from './locationType';
import employeeStatus, { createEmployeeStatus } from './employeeStatus';
import collegeType, { createCollegeType } from './collegeType';
import recruit, { createRecruit } from './recruit';

export const enums = { language, positionStatus, locationType, employeeStatus, collegeType, recruit };

export const createEnums = formatMessage => ({
  language: createLanguage(formatMessage),
  positionStatus: createPositionStatus(formatMessage),
  locationType: createLocationType(formatMessage),
  employeeStatus: createEmployeeStatus(formatMessage),
  collegeType: createCollegeType(formatMessage),
  recruit: createRecruit(formatMessage)
});

const EnumLoader = ({ children }) => {
  if (typeof children !== 'function') {
    return null;
  }
  return children(enums);
};

export default EnumLoader;
