import React, { useMemo } from 'react';
import classnames from 'classnames';
import { useIntl } from '@kne/react-intl';
import { getSkillMetrics, normalizeSkills, normalizeVerdict } from './skillModel';
import style from './style.module.scss';

const MetricCard = ({ value, label, valueClassName, active, onClick }) => {
  if (!onClick) {
    return (
      <div className={style.metric}>
        <div className={valueClassName || style['metric-value']}>{value}</div>
        <div className={style['metric-label']}>{label}</div>
      </div>
    );
  }
  return (
    <button type="button" className={classnames(style.metric, style['metric-clickable'], active && style['metric-active'])} aria-pressed={!!active} onClick={onClick}>
      <div className={valueClassName || style['metric-value']}>{value}</div>
      <div className={style['metric-label']}>{label}</div>
    </button>
  );
};

/**
 * Figma 973:5293 Role Insights Overview 上半区：Role outlook + 竖分割线 + 2×2 指标。
 * 外层渐变卡与底栏 AI impact 由 RoleInsightsContent 的 overview-shell 承载。
 */
const SkillOverview = ({ skill, verdict, activeFilter, onSelect }) => {
  const { formatMessage } = useIntl();
  const skills = useMemo(() => normalizeSkills(skill), [skill]);
  const metrics = useMemo(() => getSkillMetrics(skills), [skills]);
  const verdictData = useMemo(() => normalizeVerdict(verdict), [verdict]);
  const empty = formatMessage({ id: 'position.skillVerdictEmpty' });
  const select = key => (onSelect ? () => onSelect(activeFilter === key ? 'all' : key) : undefined);

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
            <div className={style['verdict-box-title']}>{formatMessage({ id: 'position.skillVerdictFuture' })}</div>
            <p className={style['verdict-box-body']}>{verdictData.future || empty}</p>
          </div>
        </div>
      </div>
      <div className={style['overview-divider']} aria-hidden />
      <div className={style.metrics}>
        <MetricCard value={metrics.inScope} label={formatMessage({ id: 'position.skillMetricInScope' })} onClick={select('all')} />
        <MetricCard value={metrics.mustBuild} label={formatMessage({ id: 'position.skillMetricMustBuild' })} valueClassName={style['metric-value-must']} active={activeFilter === 'must_build'} onClick={select('must_build')} />
        <MetricCard value={metrics.aiEmerging} label={formatMessage({ id: 'position.skillMetricAiEmerging' })} valueClassName={style['metric-value-emerging']} active={activeFilter === 'ai_emerging'} onClick={select('ai_emerging')} />
        <MetricCard value={metrics.fading} label={formatMessage({ id: 'position.skillMetricFading' })} valueClassName={style['metric-value-fading']} active={activeFilter === 'declining'} onClick={select('declining')} />
      </div>
    </div>
  );
};

export default SkillOverview;
