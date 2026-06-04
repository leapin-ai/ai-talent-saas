const recruit = [
  { value: '统招', description: '统招', type: 'success' },
  { value: '自考', description: '自考', type: 'info' },
  { value: '在职', description: '在职', type: 'default' },
  { value: '成教', description: '成教', type: 'default' },
  { value: '函授', description: '函授', type: 'default' }
];

export const createRecruit = formatMessage => [
  { value: '统招', description: formatMessage({ id: 'enumLoader.recruitUnified' }), type: 'success' },
  { value: '自考', description: formatMessage({ id: 'enumLoader.recruitSelfStudy' }), type: 'info' },
  { value: '在职', description: formatMessage({ id: 'enumLoader.recruitOnJob' }), type: 'default' },
  { value: '成教', description: formatMessage({ id: 'enumLoader.recruitAdultEdu' }), type: 'default' },
  { value: '函授', description: formatMessage({ id: 'enumLoader.recruitCorrespondence' }), type: 'default' }
];

export default recruit;
