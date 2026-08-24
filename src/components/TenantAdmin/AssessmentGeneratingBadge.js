import { LoadingOutlined } from '@ant-design/icons';
import { useIntl } from '@kne/react-intl';
import style from './AssessmentGeneratingBadge.module.scss';

const AssessmentGeneratingBadge = ({ className }) => {
  const { formatMessage } = useIntl();

  return (
    <span className={`${style.badge}${className ? ` ${className}` : ''}`} aria-live="polite">
      <LoadingOutlined spin className={style.icon} />
      <span>{formatMessage({ id: 'tenantAdmin.assessmentGenerating' })}</span>
    </span>
  );
};

export default AssessmentGeneratingBadge;
