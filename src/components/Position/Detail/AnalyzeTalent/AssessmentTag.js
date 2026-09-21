import { useIntl } from '@kne/react-intl';
import style from './style.module.scss';

const AssessmentTag = ({ status }) => {
  const { formatMessage } = useIntl();
  const assessed = status === 'assessed';
  return (
    <span className={`${style.assessment} ${assessed ? style['assessment-assessed'] : style['assessment-never']}`}>{formatMessage({ id: assessed ? 'position.talentAssessment.assessed' : 'position.talentAssessment.notAssessed' })}</span>
  );
};

export default AssessmentTag;
