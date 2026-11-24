import { createFormatMessage } from './withLocale';

const taskType = ({ locale }) => {
  const formatMessage = createFormatMessage(locale);
  return [
    { value: 'sync-org', description: formatMessage({ id: 'enumLoader.taskTypeSyncOrg' }), type: 'warning' },
    { value: 'parse-resume', description: formatMessage({ id: 'enumLoader.taskTypeParseResume' }), type: 'info' },
    { value: 'invite-video-asr', description: formatMessage({ id: 'enumLoader.taskTypeInviteVideoAsr' }), type: 'info' },
    { value: 'Readiness', description: formatMessage({ id: 'enumLoader.taskTypeReadiness' }), type: 'other' },
    { value: 'ReadinessPublish', description: formatMessage({ id: 'enumLoader.taskTypeReadinessPublish' }), type: 'other' },
    { value: 'ReadinessRoleApply', description: formatMessage({ id: 'enumLoader.taskTypeReadinessRoleApply' }), type: 'other' }
  ];
};

export default taskType;
