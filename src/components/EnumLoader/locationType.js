const locationType = () => {
  return [
    { value: 'on-site', description: '现场', type: 'info' },
    { value: 'remote', description: '远程', type: 'success' }
  ];
};

export const createLocationType = formatMessage => () => [
  { value: 'on-site', description: formatMessage({ id: 'enumLoader.locationTypeOnSite' }), type: 'info' },
  { value: 'remote', description: formatMessage({ id: 'enumLoader.locationTypeRemote' }), type: 'success' }
];

export default locationType;
