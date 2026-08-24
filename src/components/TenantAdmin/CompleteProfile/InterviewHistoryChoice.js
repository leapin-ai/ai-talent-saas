import dayjs from 'dayjs';
import { Button, Descriptions, Typography } from 'antd';
import { useIntl } from '@kne/react-intl';
import style from './style.module.scss';

const COMPLETED_STATUSES = ['completed', 'ended', 'done'];

export const getInterviewStatusLabel = (status, formatMessage) => {
  const normalized = String(status || '').toLowerCase();
  if (COMPLETED_STATUSES.includes(normalized)) {
    return formatMessage({ id: 'tenantAdmin.assessmentInterviewStatusCompleted' });
  }
  if (normalized) {
    return formatMessage({ id: 'tenantAdmin.assessmentInterviewStatusInProgress' });
  }
  return formatMessage({ id: 'tenantAdmin.assessmentInterviewStatusUnknown' });
};

const formatDateTime = value => {
  if (!value) {
    return '-';
  }
  const parsed = dayjs(value);
  return parsed.isValid() ? parsed.format('YYYY-MM-DD HH:mm') : '-';
};

const InterviewHistoryChoice = ({ previousInterview, loading, onUsePrevious, onRetakeInterview }) => {
  const { formatMessage } = useIntl();

  if (!previousInterview) {
    return null;
  }

  return (
    <div className={style['interview-history-panel']}>
      <div className={style['interview-history-card']}>
        <Typography.Title level={4} className={style['interview-history-title']}>
          {formatMessage({ id: 'tenantAdmin.assessmentInterviewHistoryTitle' })}
        </Typography.Title>
        <Typography.Paragraph className={style['interview-history-desc']}>{formatMessage({ id: 'tenantAdmin.assessmentInterviewHistoryDesc' })}</Typography.Paragraph>
        <Descriptions column={1} size="small" className={style['interview-history-meta']}>
          <Descriptions.Item label={formatMessage({ id: 'tenantAdmin.assessmentInterviewProject' })}>{previousInterview.projectName || '-'}</Descriptions.Item>
          <Descriptions.Item label={formatMessage({ id: 'tenantAdmin.assessmentInterviewInviteCode' })}>{previousInterview.inviteCode || '-'}</Descriptions.Item>
          <Descriptions.Item label={formatMessage({ id: 'tenantAdmin.assessmentInterviewStatus' })}>{getInterviewStatusLabel(previousInterview.completed ? 'completed' : previousInterview.interviewStatus, formatMessage)}</Descriptions.Item>
          <Descriptions.Item label={formatMessage({ id: 'tenantAdmin.assessmentInterviewInvitedAt' })}>{formatDateTime(previousInterview.invitedAt || previousInterview.lastSyncAt)}</Descriptions.Item>
        </Descriptions>
        <div className={style['interview-history-actions']}>
          <Button type="primary" loading={loading === 'previous'} onClick={onUsePrevious}>
            {formatMessage({ id: 'tenantAdmin.assessmentUsePreviousInterview' })}
          </Button>
          <Button loading={loading === 'new'} onClick={onRetakeInterview}>
            {formatMessage({ id: 'tenantAdmin.assessmentRetakeInterview' })}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default InterviewHistoryChoice;
