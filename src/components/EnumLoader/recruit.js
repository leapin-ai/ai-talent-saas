import { createFormatMessage } from './withLocale';

const recruit = ({ locale }) => {
  const formatMessage = createFormatMessage(locale);
  return [
    { value: '统招', description: formatMessage({ id: 'enumLoader.recruitUnified' }), type: 'success' },
    { value: '自考', description: formatMessage({ id: 'enumLoader.recruitSelfStudy' }), type: 'info' },
    { value: '在职', description: formatMessage({ id: 'enumLoader.recruitOnJob' }), type: 'default' },
    { value: '成教', description: formatMessage({ id: 'enumLoader.recruitAdultEdu' }), type: 'default' },
    { value: '函授', description: formatMessage({ id: 'enumLoader.recruitCorrespondence' }), type: 'default' }
  ];
};

export default recruit;
