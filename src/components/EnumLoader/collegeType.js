import { createFormatMessage } from './withLocale';

const collegeType = ({ locale }) => {
  const formatMessage = createFormatMessage(locale);
  return [
    { value: '0', description: formatMessage({ id: 'enumLoader.collegeType0' }), type: 'info' },
    { value: '1', description: formatMessage({ id: 'enumLoader.collegeType1' }), type: 'success' },
    { value: '2', description: formatMessage({ id: 'enumLoader.collegeType2' }), type: 'warning' },
    { value: '3', description: formatMessage({ id: 'enumLoader.collegeType3' }), type: 'info' },
    { value: '4', description: formatMessage({ id: 'enumLoader.collegeType4' }), type: 'success' },
    { value: '5', description: formatMessage({ id: 'enumLoader.collegeType5' }), type: 'default' },
    { value: '6', description: formatMessage({ id: 'enumLoader.collegeType6' }), type: 'default' },
    { value: '7', description: formatMessage({ id: 'enumLoader.collegeType7' }), type: 'default' }
  ];
};

export default collegeType;
