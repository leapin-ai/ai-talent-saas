import { useIntl } from '@kne/react-intl';
import style from './style.module.scss';

const AssessmentTag = ({ status }) => {
  const { formatMessage } = useIntl();
  // outdated 兼容历史数据，与 assessed 同视为已评估
  const assessed = status === 'assessed' || status === 'outdated';
  return (
    <span className={`${style.assessment} ${assessed ? style['assessment-assessed'] : style['assessment-never']}`}>{formatMessage({ id: assessed ? 'position.talentAssessment.assessed' : 'position.talentAssessment.notAssessed' })}</span>
  );
};

export default AssessmentTag;
