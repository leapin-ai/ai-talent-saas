import React, { useMemo } from 'react';
import { useIntl } from '@kne/react-intl';
import { getSkillMetrics, normalizeSkills, normalizeVerdict } from './skillModel';
import style from './style.module.scss';

const MetricCard = ({ value, label, valueClassName }) => (
  <div className={style.metric}>
    <div className={valueClassName || style['metric-value']}>{value}</div>
    <div className={style['metric-label']}>{label}</div>
  </div>
);

const SkillOverview = ({ skill, verdict }) => {
  const { formatMessage } = useIntl();
  const skills = useMemo(() => normalizeSkills(skill), [skill]);
  const metrics = useMemo(() => getSkillMetrics(skills), [skills]);
  const verdictData = useMemo(() => normalizeVerdict(verdict), [verdict]);
  const year = new Date().getFullYear();
  const futureLabel = verdictData.futureLabel || formatMessage({ id: 'position.skillVerdictFutureLabel' }, { start: year, end: year + 4 });
  const empty = formatMessage({ id: 'position.skillVerdictEmpty' });

  return (
    <div className={style.overview}>
      <div className={style.verdict}>
        <div className={style['verdict-title']}>{formatMessage({ id: 'position.skillVerdictTitle' })}</div>
        <p className={style['verdict-summary']}>{verdictData.summary || empty}</p>
        <div className={style['verdict-boxes']}>
          <div className={style['verdict-box']}>
            <div className={style['verdict-box-title']}>{formatMessage({ id: 'position.skillVerdictToday' })}</div>
            <p className={style['verdict-box-body']}>{verdictData.today || empty}</p>
          </div>
          <div className={style['verdict-box']}>
            <div className={style['verdict-box-title']}>{futureLabel}</div>
            <p className={style['verdict-box-body']}>{verdictData.future || empty}</p>
          </div>
        </div>
      </div>
      <div className={style.metrics}>
        <MetricCard value={metrics.inScope} label={formatMessage({ id: 'position.skillMetricInScope' })} />
        <MetricCard value={metrics.mustBuild} label={formatMessage({ id: 'position.skillMetricMustBuild' })} valueClassName={style['metric-value-must']} />
        <MetricCard value={metrics.aiEmerging} label={formatMessage({ id: 'position.skillMetricAiEmerging' })} valueClassName={style['metric-value-emerging']} />
        <MetricCard value={metrics.fading} label={formatMessage({ id: 'position.skillMetricFading' })} valueClassName={style['metric-value-fading']} />
      </div>
    </div>
  );
};

export default SkillOverview;
