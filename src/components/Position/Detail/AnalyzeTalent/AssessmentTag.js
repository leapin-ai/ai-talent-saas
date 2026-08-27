import { useIntl } from '@kne/react-intl';
import style from './style.module.scss';

const STATUS_CLASS = {
  assessed: 'assessment-assessed',
  outdated: 'assessment-outdated',
  never: 'assessment-never'
};

const AssessmentTag = ({ status }) => {
  const { formatMessage } = useIntl();
  const key = STATUS_CLASS[status] ? status : 'never';
  return <span className={`${style.assessment} ${style[STATUS_CLASS[key]]}`}>{formatMessage({ id: `position.talentAssessment.${key}` })}</span>;
};

export default AssessmentTag;
