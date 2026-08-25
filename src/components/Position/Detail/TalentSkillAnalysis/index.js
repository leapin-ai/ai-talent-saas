import { useMemo } from 'react';
import { Avatar, Button, Empty, Flex } from 'antd';
import { createWithRemoteLoader } from '@kne/remote-loader';
import { useIntl } from '@kne/react-intl';
import { useNavigate, useParams } from 'react-router-dom';
import Fetch from '@kne/react-fetch';
import { Card } from '@kne/react-box';
import '@kne/react-box/dist/index.css';
import { useIsMobile } from '@kne/responsive-utils';
import withLocale from '../../withLocale';
import style from './style.module.scss';
import iconSpark from './assets/icon-spark.svg';
import iconClipboard from './assets/icon-clipboard.svg';
import iconPlan from './assets/icon-plan.svg';

const DEFAULT_PRIMARY = '#4183F0';

const initialsOf = name => {
  const text = String(name || '').trim();
  if (!text) {
    return '?';
  }
  const parts = text.split(/\s+/).filter(Boolean);
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }
  return `${parts[0][0] || ''}${parts[1][0] || ''}`.toUpperCase();
};

const padRank = rank => String(rank).padStart(2, '0');

const resolveSkillStatus = skill => {
  if (skill?.status) {
    return skill.status;
  }
  const current = Number(skill?.current) || 0;
  const required = Number(skill?.required) || 0;
  if (current > required) {
    return 'above';
  }
  if (current === required) {
    return 'onTarget';
  }
  if (required - current >= 2) {
    return 'critical';
  }
  return 'gap';
};

const statusToneClass = {
  critical: 'status-critical',
  gap: 'status-gap',
  onTarget: 'status-on-target',
  above: 'status-above'
};

const statusDotClass = {
  critical: 'dot-critical',
  gap: 'dot-gap',
  onTarget: 'dot-on-target',
  above: 'dot-above'
};

const ReadinessRing = ({ value, formatMessage }) => {
  const pct = Math.min(100, Math.max(0, Number(value) || 0));
  const size = 132;
  const stroke = 10;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - pct / 100);
  const readinessLabel = formatMessage({ id: 'position.talentSkillReadinessCaption' });

  return (
    <div className={style.ring} aria-label={formatMessage({ id: 'position.talentSkillReadinessAria' }, { percent: pct })}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle className={style['ring-track']} cx={size / 2} cy={size / 2} r={radius} strokeWidth={stroke} fill="none" />
        <circle
          className={style['ring-progress']}
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={stroke}
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      <div className={style['ring-label']}>
        <div className={style['ring-value']}>{formatMessage({ id: 'position.talentSkillReadinessPercent' }, { percent: pct })}</div>
        <div className={style['ring-caption']}>{readinessLabel}</div>
      </div>
    </div>
  );
};

const SkillProgress = ({ current, required }) => {
  const max = Math.max(5, Number(required) || 5, Number(current) || 0);
  const currentPct = Math.min(100, ((Number(current) || 0) / max) * 100);
  const requiredPct = Math.min(100, ((Number(required) || 0) / max) * 100);
  const gap = Number(required) > Number(current);
  const gapLeft = Math.min(currentPct, requiredPct);
  const gapWidth = Math.max(0, requiredPct - currentPct);

  return (
    <div className={style['skill-bar']}>
      <div className={style['skill-bar-track']}>
        <div className={style['skill-bar-fill']} style={{ width: `${currentPct}%` }} />
        {gap && <div className={style['skill-bar-gap']} style={{ left: `${gapLeft}%`, width: `${gapWidth}%` }} />}
        <div className={style['skill-bar-mark']} style={{ left: `${requiredPct}%` }} />
      </div>
    </div>
  );
};

const HaloMetrics = ({ metrics, formatMessage }) => {
  const criticalGaps = metrics?.criticalGaps ?? 0;
  const atOrAbove = metrics?.atOrAbove ?? 0;
  const monthsToClose = metrics?.monthsToClose;

  return (
    <Flex className={style['halo-metrics']} align="stretch" gap={0}>
      <div className={style['halo-metric']}>
        <div className={`${style['halo-metric-value']} ${style['halo-metric-critical']}`}>{criticalGaps}</div>
        <div className={style['halo-metric-label']}>{formatMessage({ id: 'position.talentSkillCriticalGaps' })}</div>
      </div>
      <div className={style['halo-divider']} />
      <div className={style['halo-metric']}>
        <div className={`${style['halo-metric-value']} ${style['halo-metric-ok']}`}>{atOrAbove}</div>
        <div className={style['halo-metric-label']}>{formatMessage({ id: 'position.talentSkillAtOrAbove' })}</div>
      </div>
      <div className={style['halo-divider']} />
      <div className={style['halo-metric']}>
        <div className={`${style['halo-metric-value']} ${style['halo-metric-close']}`}>
          {monthsToClose == null ? formatMessage({ id: 'position.talentSkillEmptyValue' }) : formatMessage({ id: 'position.talentSkillMonthsValue' }, { months: monthsToClose })}
        </div>
        <div className={style['halo-metric-label']}>{formatMessage({ id: 'position.talentSkillToClose' })}</div>
      </div>
    </Flex>
  );
};

const PriorityGapsPanel = ({ gaps, formatMessage, cardColor }) => {
  return (
    <Card
      className={style['gaps-card']}
      theme="inset"
      color={cardColor}
      hover={false}
      title={formatMessage({ id: 'position.talentSkillPriorityGaps' })}
      extra={<span className={style['gaps-badge']}>{formatMessage({ id: 'position.talentSkillTopGaps' }, { count: Math.min(3, gaps.length || 3) })}</span>}
    >
      {gaps.length === 0 ? (
        <Empty description={formatMessage({ id: 'position.talentSkillNoGaps' })} />
      ) : (
        <Flex vertical gap={10}>
          {gaps.slice(0, 3).map((gap, index) => {
            const hasScore = gap.current != null && gap.required != null;
            return (
              <div key={`${gap.rank}-${gap.title}-${index}`} className={style['gap-item']}>
                <div className={style['gap-rank']}>{padRank(gap.rank || index + 1)}</div>
                <div className={style['gap-body']}>
                  <div className={style['gap-title-row']}>
                    <div className={style['gap-title']}>{gap.title}</div>
                    {hasScore ? <div className={style['gap-score']}>{formatMessage({ id: 'position.talentSkillGapScore' }, { current: gap.current, required: gap.required })}</div> : null}
                  </div>
                  {gap.description ? <div className={style['gap-desc']}>{gap.description}</div> : null}
                </div>
              </div>
            );
          })}
        </Flex>
      )}
    </Card>
  );
};

const SkillsTable = ({ skills, firstName, formatMessage, cardColor, isMobile }) => {
  const statusLabel = status => {
    const map = {
      critical: 'position.talentSkillStatusCritical',
      gap: 'position.talentSkillStatusGap',
      onTarget: 'position.talentSkillStatusOnTarget',
      above: 'position.talentSkillStatusAbove'
    };
    return formatMessage({ id: map[status] || map.gap });
  };

  return (
    <Card
      className={style['skills-card']}
      theme="inset"
      color={cardColor}
      hover={false}
      title={
        <span className={style['section-title']}>
          <span className={`${style['section-icon']} ${style['section-icon-clipboard']}`}>
            <img src={iconClipboard} alt="" />
          </span>
          {formatMessage({ id: 'position.talentSkillBySkillTitle' })}
        </span>
      }
      extra={
        <div className={style.legend}>
          <span className={style['legend-item']}>
            <span className={style['legend-fill']} />
            {firstName}
          </span>
          <span className={style['legend-item']}>
            <span className={style['legend-mark']} />
            {formatMessage({ id: 'position.talentSkillLegendRequired' })}
          </span>
          <span className={style['legend-item']}>
            <span className={style['legend-gap']} />
            {formatMessage({ id: 'position.talentSkillLegendGap' })}
          </span>
        </div>
      }
    >
      {skills.length === 0 ? (
        <Empty description={formatMessage({ id: 'position.talentSkillNoSkills' })} />
      ) : (
        <div className={style['skills-table']}>
          {!isMobile ? (
            <div className={`${style['skills-row']} ${style['skills-head']}`}>
              <div>{formatMessage({ id: 'position.talentSkillColSkill' })}</div>
              <div>{formatMessage({ id: 'position.talentSkillColProgress' })}</div>
              <div>{formatMessage({ id: 'position.talentSkillColStatus' })}</div>
              <div className={style['skills-col-end']}>{formatMessage({ id: 'position.talentSkillColEvidence' })}</div>
            </div>
          ) : null}
          {skills.map((skill, index) => {
            const status = resolveSkillStatus(skill);
            return (
              <div key={skill.id || `${skill.name}-${index}`} className={style['skills-row']}>
                <div className={style['skill-name']}>
                  <span className={`${style['skill-dot']} ${style[statusDotClass[status] || 'dot-gap']}`} />
                  <span>{skill.name}</span>
                </div>
                <div className={style['skill-progress-cell']}>
                  <SkillProgress current={skill.current} required={skill.required} />
                  <span className={style['skill-score']}>{formatMessage({ id: 'position.talentSkillScore' }, { current: skill.current ?? 0, required: skill.required ?? 0 })}</span>
                </div>
                <div>
                  <span className={`${style['status-pill']} ${style[statusToneClass[status] || 'status-gap']}`}>{statusLabel(status)}</span>
                </div>
                <div className={style['skill-evidence']}>
                  <span>{skill.evidence || formatMessage({ id: 'position.talentSkillEmptyValue' })}</span>
                  <span className={`${style['evidence-dot']} ${style[statusDotClass[status] || 'dot-gap']}`} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
};

const DevelopmentPlan = ({ plan, formatMessage, cardColor }) => {
  const horizons = Array.isArray(plan?.horizons) ? plan.horizons : [];
  if (!plan || horizons.length === 0) {
    return null;
  }

  return (
    <Card
      className={style['plan-card']}
      theme="inset"
      color={cardColor}
      hover={false}
      title={
        <span className={style['section-title']}>
          <span className={`${style['section-icon']} ${style['section-icon-plan']}`}>
            <img src={iconPlan} alt="" />
          </span>
          {formatMessage({ id: 'position.talentSkillPlanTitle' })}
          <span className={style['plan-subtitle']}>{plan.subtitle || formatMessage({ id: 'position.talentSkillPlanSubtitle' })}</span>
        </span>
      }
    >
      <div className={style['plan-grid']}>
        {horizons.map((horizon, index) => {
          const tone = horizon.tone || (index === 0 ? 'primary' : index === 1 ? 'cyan' : 'rose');
          return (
            <div key={horizon.key || horizon.label || index} className={`${style['plan-horizon']} ${style[`tone-${tone}`]}`}>
              <div className={style['horizon-top']}>
                <div className={style['horizon-label']}>{horizon.label || formatMessage({ id: 'position.talentSkillHorizon' }, { n: index + 1 })}</div>
                <div className={style['horizon-period']}>{horizon.period}</div>
              </div>
              <div className={style['horizon-title']}>{horizon.title}</div>
              <div className={style['horizon-items']}>
                {(horizon.items || []).map((item, itemIndex) => (
                  <div key={`${item.tag}-${item.title}-${itemIndex}`} className={style['horizon-item']}>
                    <div className={style['item-tag']}>{item.tag}</div>
                    <div className={style['item-body']}>
                      <div className={style['item-title']}>{item.title}</div>
                      {item.meta ? <div className={style['item-meta']}>{item.meta}</div> : null}
                    </div>
                  </div>
                ))}
              </div>
              {horizon.target ? (
                <div className={style['horizon-target']}>
                  <span>{formatMessage({ id: 'position.talentSkillPlanTargets' })}</span>
                  <strong>{horizon.target}</strong>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </Card>
  );
};

const TalentSkillAnalysisContent = ({ data, formatMessage, isMobile, themeColor }) => {
  const employee = data?.employee || {};
  const analysis = data?.analysis;
  const displayName = employee.name || employee.nameEn || formatMessage({ id: 'position.talentSkillEmptyValue' });
  const skills = Array.isArray(analysis?.skills) ? analysis.skills : [];
  const priorityGaps = Array.isArray(analysis?.priorityGaps) ? analysis.priorityGaps : [];
  const developmentPlan = analysis?.developmentPlan || null;
  const firstName = String(displayName).split(/\s+/)[0] || displayName;
  const cardColor = themeColor || DEFAULT_PRIMARY;

  if (!analysis) {
    return (
      <div className={style.root}>
        <Card theme="ribbon" color={cardColor} hover={false}>
          <Empty description={formatMessage({ id: 'position.talentSkillEmptyDesc' })} />
        </Card>
      </div>
    );
  }

  return (
    <div className={style.root}>
      <div className={style.top}>
        <Card className={style['halo-card']} theme="halo" color={cardColor} hover={false}>
          <div className={style['halo-body']}>
            <ReadinessRing value={analysis.readiness} formatMessage={formatMessage} />
            <div className={style['halo-copy']}>
              <div className={style['halo-title']}>
                <span className={style['halo-title-icon']}>
                  <img src={iconSpark} alt="" />
                </span>
                {formatMessage({ id: 'position.talentSkillWhereStands' }, { name: firstName })}
              </div>
              <div className={style['halo-summary']}>{analysis.summary || formatMessage({ id: 'position.talentSkillNoSummary' })}</div>
              <HaloMetrics metrics={analysis.metrics} formatMessage={formatMessage} />
            </div>
          </div>
        </Card>

        <div className={style['gaps-wrap']}>
          <PriorityGapsPanel gaps={priorityGaps} formatMessage={formatMessage} cardColor={cardColor} />
        </div>
      </div>

      <div className={style['full-width']}>
        <SkillsTable skills={skills} firstName={firstName} formatMessage={formatMessage} cardColor={cardColor} isMobile={isMobile} />
      </div>

      <div className={style['full-width']}>
        <DevelopmentPlan plan={developmentPlan} formatMessage={formatMessage} cardColor={cardColor} />
      </div>
    </div>
  );
};

const TalentSkillAnalysis = createWithRemoteLoader({
  modules: ['components-core:Global@useGlobalValue']
})(
  withLocale(({ remoteModules, baseUrl = '', apis, children }) => {
    const [useGlobalValue] = remoteModules;
    const themeToken = useGlobalValue('themeToken') || {};
    const themeColor = themeToken.colorPrimary || DEFAULT_PRIMARY;
    const { formatMessage } = useIntl();
    const navigate = useNavigate();
    const { id: positionId, employeeId } = useParams();
    const isMobile = useIsMobile();

    const fetchApi = useMemo(() => {
      if (!apis?.skillAnalysisDetail || !positionId || !employeeId) {
        return null;
      }
      return Object.assign({}, apis.skillAnalysisDetail, {
        params: {
          positionId: String(positionId),
          employeeId: String(employeeId)
        }
      });
    }, [apis, positionId, employeeId]);

    if (!fetchApi) {
      return <div className={style.root}>{formatMessage({ id: 'position.talentSkillEmptyDesc' })}</div>;
    }

    return (
      <Fetch
        {...fetchApi}
        render={({ data }) => {
          const displayName = data?.employee?.name || data?.employee?.nameEn || formatMessage({ id: 'position.talentSkillPageTitle' });
          const title = (
            <Flex align="center" gap={10} className={style['page-title']}>
              <Avatar size={28} src={data?.employee?.avatar || undefined}>
                {initialsOf(displayName)}
              </Avatar>
              <span>{displayName}</span>
            </Flex>
          );
          const targetEmployeeId = data?.employee?.id || employeeId;
          const extra = targetEmployeeId ? (
            <Button type="primary" onClick={() => navigate(`${baseUrl}/profile/${targetEmployeeId}`)}>
              {formatMessage({ id: 'position.talentSkillViewEmployee' })}
            </Button>
          ) : null;
          const content = <TalentSkillAnalysisContent data={data} formatMessage={formatMessage} isMobile={isMobile} themeColor={themeColor} />;

          if (typeof children === 'function') {
            return children({
              title,
              extra,
              children: content
            });
          }
          return content;
        }}
      />
    );
  })
);

export default TalentSkillAnalysis;
