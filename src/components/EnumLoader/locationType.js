import { createFormatMessage } from './withLocale';

const locationType = ({ locale }) => {
  const formatMessage = createFormatMessage(locale);
  return [
    { value: 'on-site', description: formatMessage({ id: 'enumLoader.locationTypeOnSite' }), type: 'info' },
    { value: 'remote', description: formatMessage({ id: 'enumLoader.locationTypeRemote' }), type: 'success' }
  ];
};

export default locationType;
