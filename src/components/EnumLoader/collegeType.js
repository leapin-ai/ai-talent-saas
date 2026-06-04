const collegeType = [
  { value: '0', description: '普通院校', type: 'info' },
  { value: '1', description: '985', type: 'success' },
  { value: '2', description: '211', type: 'warning' },
  { value: '3', description: '港澳台院校', type: 'info' },
  { value: '4', description: '海外院校', type: 'success' },
  { value: '5', description: '中学', type: 'default' },
  { value: '6', description: '职业教育', type: 'default' },
  { value: '7', description: '培训机构', type: 'default' }
];

export const createCollegeType = formatMessage => [
  { value: '0', description: formatMessage({ id: 'enumLoader.collegeType0' }), type: 'info' },
  { value: '1', description: formatMessage({ id: 'enumLoader.collegeType1' }), type: 'success' },
  { value: '2', description: formatMessage({ id: 'enumLoader.collegeType2' }), type: 'warning' },
  { value: '3', description: formatMessage({ id: 'enumLoader.collegeType3' }), type: 'info' },
  { value: '4', description: formatMessage({ id: 'enumLoader.collegeType4' }), type: 'success' },
  { value: '5', description: formatMessage({ id: 'enumLoader.collegeType5' }), type: 'default' },
  { value: '6', description: formatMessage({ id: 'enumLoader.collegeType6' }), type: 'default' },
  { value: '7', description: formatMessage({ id: 'enumLoader.collegeType7' }), type: 'default' }
];

export default collegeType;
