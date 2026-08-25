import { createFormatMessage } from './withLocale';

const taskType = ({ locale }) => {
  const formatMessage = createFormatMessage(locale);
  return [
    { value: 'sync-org', description: formatMessage({ id: 'enumLoader.taskTypeSyncOrg' }), type: 'warning' },
    { value: 'parse-resume', description: formatMessage({ id: 'enumLoader.taskTypeParseResume' }), type: 'info' },
    { value: 'assessment-profile-review', description: formatMessage({ id: 'enumLoader.taskTypeAssessmentProfileReview' }), type: 'progress' }
  ];
};

export default taskType;
