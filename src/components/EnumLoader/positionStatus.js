import { createFormatMessage } from './withLocale';

const positionStatus = ({ locale }) => {
  const formatMessage = createFormatMessage(locale);
  return [
    { value: 'draft', description: formatMessage({ id: 'enumLoader.positionStatusDraft' }), type: 'default' },
    { value: 'published', description: formatMessage({ id: 'enumLoader.positionStatusPublished' }), type: 'success' },
    { value: 'closed', description: formatMessage({ id: 'enumLoader.positionStatusClosed' }), type: 'danger' }
  ];
};

export default positionStatus;
