import { useEffect, useMemo, useState } from 'react';
import { useIntl } from '@kne/react-intl';
import { Card } from '@kne/react-box';
import '@kne/react-box/dist/index.css';
import withLocale from '../../withLocale';
import style from './style.module.scss';
import iconSpark from './assets/icon-spark.svg';
import iconClock from './assets/icon-clock.svg';

const DEFAULT_PRIMARY = '#4F46E5';

const STEP_KEYS = [
  { id: 'org', labelId: 'position.aiAnalysisStepOrg' },
  { id: 'position', labelId: 'position.aiAnalysisStepPosition' },
  { id: 'person', labelId: 'position.aiAnalysisStepPerson' }
];

const resolveActiveIndex = progress => {
  const value = Number(progress) || 0;
  if (value >= 70) {
    return 2;
  }
  if (value >= 40) {
    return 1;
  }
  return 0;
};

const AiAnalysisInner = ({ positionName, progress = 0, animate = true }) => {
  const { formatMessage } = useIntl();
  const cardColor = DEFAULT_PRIMARY;
  const baseProgress = Math.min(100, Math.max(0, Number(progress) || 0));
  const [displayProgress, setDisplayProgress] = useState(baseProgress);

  useEffect(() => {
    setDisplayProgress(baseProgress);
  }, [baseProgress]);

  useEffect(() => {
    if (!animate || baseProgress >= 100) {
      return undefined;
    }
    const timer = setInterval(() => {
      setDisplayProgress(prev => {
        if (prev >= 90) {
          return prev;
        }
        const next = prev + 1;
        return next > 90 ? 90 : next;
      });
    }, 1200);
    return () => clearInterval(timer);
  }, [animate, baseProgress]);

  const activeIndex = resolveActiveIndex(displayProgress);
  const steps = useMemo(
    () =>
      STEP_KEYS.map((step, index) => {
        let statusId = 'position.aiAnalysisStepStatusPending';
        if (index < activeIndex) {
          statusId = 'position.aiAnalysisStepStatusDone';
        } else if (index === activeIndex) {
          statusId = 'position.aiAnalysisStepStatusActive';
        }
        return Object.assign({}, step, { statusId, active: index === activeIndex });
      }),
    [activeIndex]
  );

  return (
    <div className={style.root}>
      <div className={style.grid} aria-hidden />
      <Card className={style.card} theme="ribbon" color={cardColor} hover={false}>
        <div className={style.panel}>
          <div className={style.head}>
            <div className={style['icon-wrap']}>
              <img src={iconSpark} alt="" />
            </div>
            <div className={style['title-block']}>
              <h2 className={style.title}>{formatMessage({ id: 'position.aiAnalysisTitle' }, { name: positionName || '—' })}</h2>
              <p className={style.subtitle}>{formatMessage({ id: 'position.aiAnalysisSubtitle' })}</p>
            </div>
          </div>

          <div className={style.meta}>
            <span className={style.percent}>{Math.round(displayProgress)}%</span>
            <span className={style['complete-label']}>{formatMessage({ id: 'position.aiAnalysisCompleteLabel' })}</span>
          </div>

          <div className={style.track} role="progressbar" aria-valuenow={Math.round(displayProgress)} aria-valuemin={0} aria-valuemax={100}>
            <div className={style.bar} style={{ width: `${displayProgress}%` }} />
          </div>

          <div className={style.steps}>
            {steps.map((step, index) => (
              <div key={step.id} className={`${style.step}${step.active ? ` ${style['step-active']}` : ''}`}>
                <span className={style['step-dot']} />
                <span className={style['step-index']}>{String(index + 1).padStart(2, '0')}</span>
                <span className={style['step-label']}>{formatMessage({ id: step.labelId })}</span>
                <span className={style['step-status']}>{formatMessage({ id: step.statusId })}</span>
              </div>
            ))}
          </div>

          <div className={style.footer}>
            <img src={iconClock} alt="" />
            <span>{formatMessage({ id: 'position.aiAnalysisEta' })}</span>
          </div>
        </div>
      </Card>
    </div>
  );
};

const AiAnalysis = withLocale(AiAnalysisInner);

export default AiAnalysis;
