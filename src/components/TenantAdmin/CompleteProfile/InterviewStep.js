import { Alert, Empty } from 'antd';
import { useIntl } from '@kne/react-intl';
import style from './style.module.scss';

const InterviewStep = () => {
  const { formatMessage } = useIntl();
  return (
    <div className={style['interview-panel']}>
      <Empty description={formatMessage({ id: 'tenantAdmin.completeInterviewEmpty' })} />
      <div className={style['interview-card']}>
        <div className={style['side-card-title']}>{formatMessage({ id: 'tenantAdmin.completeInterviewTipsTitle' })}</div>
        <ul className={style['interview-tips']}>
          <li>{formatMessage({ id: 'tenantAdmin.completeInterviewTip1' })}</li>
          <li>{formatMessage({ id: 'tenantAdmin.completeInterviewTip2' })}</li>
          <li>{formatMessage({ id: 'tenantAdmin.completeInterviewTip3' })}</li>
        </ul>
        <Alert type="info" showIcon message={formatMessage({ id: 'tenantAdmin.completeInterviewAlert' })} />
      </div>
    </div>
  );
};

export default InterviewStep;
