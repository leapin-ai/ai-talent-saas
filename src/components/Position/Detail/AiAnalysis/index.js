import { useEffect, useMemo, useRef, useState } from 'react';
import { useIntl } from '@kne/react-intl';
import { Card } from '@kne/react-box';
import '@kne/react-box/dist/index.css';
import withLocale from '../../withLocale';
import style from './style.module.scss';
import iconSpark from './assets/icon-spark.svg';
import iconClock from './assets/icon-clock.svg';

const DEFAULT_PRIMARY = '#4F46E5';
const ANIMATION_MS = 5000;
const COMPLETE_DELAY_MS = 500;

const STEP_KEYS = [
  { id: 'org', labelId: 'position.aiAnalysisStepOrg' },
  { id: 'position', labelId: 'position.aiAnalysisStepPosition' },
  { id: 'person', labelId: 'position.aiAnalysisStepPerson' }
];

const DONE_ITEMS = [
  { titleId: 'position.aiAnalysisDoneItemSummary', descId: 'position.aiAnalysisDoneItemSummaryDesc' },
  { titleId: 'position.aiAnalysisStepOrg', descId: 'position.aiAnalysisDoneItemOrgDesc' },
  { titleId: 'position.aiAnalysisStepPosition', descId: 'position.aiAnalysisDoneItemPositionDesc' },
  { titleId: 'position.aiAnalysisStepPerson', descId: 'position.aiAnalysisDoneItemPersonDesc' }
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

const PersonIcon = () => (
  <svg className={style['person-icon']} width="64" height="64" viewBox="0 0 64 64" fill="none" aria-hidden>
    <rect width="64" height="64" rx="32" fill="#F4F6FF" />
    <circle cx="32" cy="26" r="10.5" stroke="#5B6CFF" strokeWidth="3" />
    <rect x="17" y="27" width="30" height="24" rx="6" fill="#5B6CFF" />
    <rect x="30" y="35" width="4" height="8" rx="2" fill="white" />
  </svg>
);

const BadgeCheck = () => (
  <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden>
    <path d="M1.694 4.559L2.624 3.617L4.519 5.481L8.616 1.398L9.554 2.34L4.519 7.355L1.694 4.559Z" fill="#10B981" />
  </svg>
);

const ItemCheck = () => (
  <svg className={style['item-check']} width="19" height="19" viewBox="0 0 19 19" fill="none" aria-hidden>
    <rect x="0.5" y="0.5" width="18" height="18" rx="9" fill="#ECFDF5" stroke="#A7F3D0" />
    <path d="M5.71 10.145L6.8115 9.039L8.6201 10.816L12.6318 6.82L13.7412 7.926L8.6201 13.02L5.71 10.145Z" fill="#10B981" />
  </svg>
);

const CompleteView = ({ formatMessage }) => (
  <div className={style.complete} role="status">
    <div className={style['badge-success']}>
      <BadgeCheck />
      <span>{formatMessage({ id: 'position.aiAnalysisDoneBadge' })}</span>
    </div>
    <PersonIcon />
    <div className={style.tag}>{formatMessage({ id: 'position.aiAnalysisDoneTag' })}</div>
    <h2 className={style['complete-title']}>{formatMessage({ id: 'position.aiAnalysisDoneTitle' })}</h2>
    <p className={style['complete-subtitle']}>{formatMessage({ id: 'position.aiAnalysisDoneSubtitle' })}</p>
    <div className={style.divider} />
    <ul className={style.checklist}>
      {DONE_ITEMS.map(item => (
        <li key={item.titleId} className={style['check-item']}>
          <ItemCheck />
          <div className={style['check-text']}>
            <div className={style['check-title']}>{formatMessage({ id: item.titleId })}</div>
            <div className={style['check-desc']}>{formatMessage({ id: item.descId })}</div>
          </div>
        </li>
      ))}
    </ul>
  </div>
);

const AiAnalysisInner = ({ positionName, progress = 0, animate = true, locked = false, onAnimationComplete }) => {
  const { formatMessage } = useIntl();
  const cardColor = DEFAULT_PRIMARY;
  const initialProgressRef = useRef(Math.min(100, Math.max(0, Number(progress) || 0)));
  const initialProgress = initialProgressRef.current;
  const onCompleteRef = useRef(onAnimationComplete);
  const savedRef = useRef(false);
  onCompleteRef.current = onAnimationComplete;
  const [displayProgress, setDisplayProgress] = useState(locked ? 100 : initialProgress);
  const [complete, setComplete] = useState(locked || (!animate && initialProgress >= 100));

  useEffect(() => {
    if (locked) {
      setDisplayProgress(100);
      setComplete(true);
      return undefined;
    }
    if (!animate) {
      return undefined;
    }
    if (initialProgress >= 100) {
      setDisplayProgress(100);
      setComplete(true);
      if (!savedRef.current) {
        savedRef.current = true;
        onCompleteRef.current && onCompleteRef.current();
      }
      return undefined;
    }
    let completeTimer;
    const startedAt = Date.now();
    const tick = setInterval(() => {
      const t = Math.min(1, (Date.now() - startedAt) / ANIMATION_MS);
      setDisplayProgress(initialProgress + (100 - initialProgress) * t);
      if (t >= 1) {
        clearInterval(tick);
        completeTimer = setTimeout(() => {
          setComplete(true);
          if (!savedRef.current) {
            savedRef.current = true;
            onCompleteRef.current && onCompleteRef.current();
          }
        }, COMPLETE_DELAY_MS);
      }
    }, 80);
    return () => {
      clearInterval(tick);
      clearTimeout(completeTimer);
    };
  }, [animate, initialProgress, locked]);

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
        {complete ? (
          <CompleteView formatMessage={formatMessage} />
        ) : (
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
        )}
      </Card>
    </div>
  );
};

const AiAnalysis = withLocale(AiAnalysisInner);

export default AiAnalysis;
