import { useEffect, useMemo, useState } from 'react';
import { Empty, Flex, Typography } from 'antd';
import { Card } from '@kne/react-box';
import '@kne/react-box/dist/index.css';
import { createWithRemoteLoader } from '@kne/remote-loader';
import { useIntl } from '@kne/react-intl';
import { useIsMobile } from '@kne/responsive-utils';
import classnames from 'classnames';
import withLocale from './withLocale';
import ProfileEvidence from './ProfileEvidence';
import style from './style.module.scss';
import iconSpark from './assets/icon-spark.svg';
import iconClipboard from './assets/icon-clipboard.svg';
import iconCollapse from './assets/icon-collapse.svg';

const padRank = rank => String(rank).padStart(2, '0');

const parseActivityGroup = raw => {
  const text = String(raw || '').trim();
  if (!text) {
    return { code: '', title: '' };
  }
  const matched = text.match(/^([A-Za-z]?\d{1,3})\s*[·.\-–—:]?\s+(.+)$/);
  if (matched) {
    return { code: matched[1].toUpperCase(), title: matched[2].trim() };
  }
  if (/^[A-Za-z]?\d{1,3}$/.test(text)) {
    return { code: text.toUpperCase(), title: '' };
  }
  return { code: '', title: text };
};

const resolveStatus = row => {
  if (row?.status) {
    return row.status;
  }
  const current = Number(row?.current) || 0;
  const required = Number(row?.required) || 0;
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

const STATUS_META = {
  critical: { tone: 'status-critical', labelKey: 'talentProfile.statusCritical' },
  gap: { tone: 'status-gap', labelKey: 'talentProfile.statusGap' },
  onTarget: { tone: 'status-on-target', labelKey: 'talentProfile.statusOnTarget' },
  above: { tone: 'status-above', labelKey: 'talentProfile.statusAbove' }
};

const CONFIDENCE_KEYS = {
  high: 'talentProfile.confidenceHigh',
  medium: 'talentProfile.confidenceMedium',
  low: 'talentProfile.confidenceLow'
};

const ReadinessRing = ({ value, formatMessage }) => {
  const pct = Math.min(100, Math.max(0, Math.round(Number(value) || 0)));
  const size = 132;
  const stroke = 10;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - pct / 100);

  return (
    <div className={style['readiness-ring']} aria-label={formatMessage({ id: 'talentProfile.readinessAria' }, { percent: pct })}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#e2e8f0" strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#059669" strokeWidth={stroke} strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={offset} transform={`rotate(-90 ${size / 2} ${size / 2})`} />
      </svg>
      <div className={style['readiness-ring-label']}>
        <div className={style['readiness-ring-value']}>{pct}%</div>
        <div className={style['readiness-ring-caption']}>{formatMessage({ id: 'talentProfile.readinessCaption' })}</div>
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
        {gap ? <div className={style['skill-bar-gap']} style={{ left: `${gapLeft}%`, width: `${gapWidth}%` }} /> : null}
        <div className={style['skill-bar-mark']} style={{ left: `${requiredPct}%` }} />
      </div>
    </div>
  );
};

const deriveFromRows = rows => {
  const list = rows || [];
  if (!list.length) {
    return { readiness: 0, metrics: { criticalGaps: 0, atOrAbove: 0, monthsToClose: null }, priorityGaps: [] };
  }
  let sum = 0;
  let criticalGaps = 0;
  let atOrAbove = 0;
  const gaps = [];
  list.forEach(row => {
    const current = Number(row.current) || 0;
    const required = Number(row.required) || 0;
    const status = resolveStatus(row);
    const ratio = required > 0 ? Math.min(1, current / required) : current > 0 ? 1 : 0;
    sum += ratio;
    if (status === 'critical' || status === 'gap') {
      criticalGaps += status === 'critical' ? 1 : 0;
      gaps.push({
        rank: gaps.length + 1,
        title: row.title,
        description: '',
        current,
        required,
        delta: required - current
      });
    }
    if (status === 'onTarget' || status === 'above') {
      atOrAbove += 1;
    }
  });
  gaps.sort((a, b) => b.delta - a.delta);
  const topGaps = gaps.slice(0, 3).map((item, index) => ({ ...item, rank: index + 1 }));
  return {
    readiness: Math.round((sum / list.length) * 100),
    metrics: {
      criticalGaps: list.filter(row => resolveStatus(row) === 'critical').length || criticalGaps,
      atOrAbove,
      monthsToClose: topGaps.length ? Math.max(3, topGaps.reduce((acc, g) => acc + g.delta, 0) * 2) : null
    },
    priorityGaps: topGaps
  };
};

const ProfileReadiness = createWithRemoteLoader({
  modules: ['components-core:Global@usePreset']
})(
  withLocale(({ remoteModules, positionId, employeeId, displayName }) => {
    const [usePreset] = remoteModules;
    const { ajax, apis } = usePreset();
    const { formatMessage } = useIntl();
    const isMobile = useIsMobile();
    const [rows, setRows] = useState(null);
    const [analysis, setAnalysis] = useState(null);
    const [error, setError] = useState('');
    const [selectedId, setSelectedId] = useState(null);
    const [expanded, setExpanded] = useState({});

    useEffect(() => {
      let cancelled = false;
      const load = async () => {
        if (!positionId || !employeeId) {
          setRows([]);
          return;
        }
        const taskApi = apis?.talentSaas?.tenant?.position?.taskReadiness;
        const analysisApi = apis?.talentSaas?.tenant?.position?.skillAnalysisDetail;
        try {
          const tasks = [];
          if (taskApi) {
            tasks.push(ajax(Object.assign({}, taskApi, { params: { positionId, employeeId } })));
          } else {
            tasks.push(Promise.resolve({ data: { code: 0, data: { pageData: [] } } }));
          }
          if (analysisApi) {
            tasks.push(ajax(Object.assign({}, analysisApi, { params: { positionId, employeeId } })));
          } else {
            tasks.push(Promise.resolve({ data: { code: 0, data: null } }));
          }
          const [taskRes, analysisRes] = await Promise.all(tasks);
          if (cancelled) {
            return;
          }
          if (taskRes?.data?.code !== 0) {
            setError(taskRes?.data?.msg || formatMessage({ id: 'talentProfile.readinessLoadFailed' }));
            setRows([]);
          } else {
            setRows(taskRes.data.data?.pageData || []);
            setError('');
          }
          if (analysisRes?.data?.code === 0) {
            setAnalysis(analysisRes.data.data?.analysis || analysisRes.data.data || null);
          }
        } catch (e) {
          if (!cancelled) {
            setError(e.message || formatMessage({ id: 'talentProfile.readinessLoadFailed' }));
            setRows([]);
          }
        }
      };
      load();
      return () => {
        cancelled = true;
      };
    }, [ajax, apis, employeeId, formatMessage, positionId]);

    const derived = useMemo(() => deriveFromRows(rows || []), [rows]);
    const readiness = analysis?.readiness != null ? analysis.readiness : derived.readiness;
    const metrics = analysis?.metrics || derived.metrics;
    const priorityGaps = Array.isArray(analysis?.priorityGaps) && analysis.priorityGaps.length ? analysis.priorityGaps : derived.priorityGaps;
    const summary = analysis?.summary || '';
    const firstName =
      String(displayName || '')
        .split(/\s+/)
        .filter(Boolean)[0] ||
      displayName ||
      '';

    const groups = useMemo(() => {
      const list = rows || [];
      const map = new Map();
      list.forEach(item => {
        const key = item.activityGroup || '';
        if (!map.has(key)) {
          map.set(key, []);
        }
        map.get(key).push(item);
      });
      return [...map.entries()].map(([key, children], index) => {
        const parsed = parseActivityGroup(key);
        return {
          id: key || 'ungrouped',
          code: parsed.code || `A${String(index + 1).padStart(2, '0')}`,
          title: parsed.title || key || formatMessage({ id: 'talentProfile.task' }),
          children
        };
      });
    }, [rows, formatMessage]);

    useEffect(() => {
      const flat = groups.flatMap(group => group.children);
      if (!flat.length) {
        setSelectedId(null);
        return;
      }
      setSelectedId(prev => (prev && flat.some(item => item.id === prev) ? prev : flat[0].id));
    }, [groups]);

    const selectedTask = useMemo(() => {
      const flat = groups.flatMap(group => group.children);
      const found = flat.find(item => item.id === selectedId) || flat[0] || null;
      if (!found) {
        return null;
      }
      const status = resolveStatus(found);
      const meta = STATUS_META[status] || STATUS_META.gap;
      const confidence = found.confidence || 'medium';
      return {
        ...found,
        status,
        statusTone: meta.tone,
        statusLabel: formatMessage({ id: meta.labelKey }),
        confidence,
        confidenceLabel: formatMessage({ id: CONFIDENCE_KEYS[confidence] || CONFIDENCE_KEYS.medium })
      };
    }, [groups, selectedId, formatMessage]);

    if (!positionId) {
      return <Empty description={formatMessage({ id: 'talentProfile.readinessNoPosition' })} />;
    }
    if (rows == null) {
      return null;
    }

    const toggleGroup = id => {
      setExpanded(prev => ({ ...prev, [id]: !(prev[id] !== false) }));
    };

    return (
      <div className={style['readiness-root']}>
        {error ? <Typography.Text type="danger">{error}</Typography.Text> : null}
        <div className={style['readiness-top']}>
          <Card className={style['halo-card']} theme="halo" hover={false}>
            <div className={style['halo-body']}>
              <ReadinessRing value={readiness} formatMessage={formatMessage} />
              <div className={style['halo-copy']}>
                <div className={style['halo-title']}>
                  <span className={style['halo-title-icon']}>
                    <img src={iconSpark} alt="" />
                  </span>
                  {formatMessage({ id: 'talentProfile.whereStands' }, { name: firstName || formatMessage({ id: 'talentProfile.you' }) })}
                </div>
                <div className={style['halo-summary']}>{summary || formatMessage({ id: 'talentProfile.readinessNoSummary' })}</div>
                <Flex className={style['halo-metrics']} align="stretch" gap={0}>
                  <div className={style['halo-metric']}>
                    <div className={classnames(style['halo-metric-value'], style['halo-metric-critical'])}>{metrics?.criticalGaps ?? 0}</div>
                    <div className={style['halo-metric-label']}>{formatMessage({ id: 'talentProfile.criticalGaps' })}</div>
                  </div>
                  <div className={style['halo-divider']} />
                  <div className={style['halo-metric']}>
                    <div className={classnames(style['halo-metric-value'], style['halo-metric-ok'])}>{metrics?.atOrAbove ?? 0}</div>
                    <div className={style['halo-metric-label']}>{formatMessage({ id: 'talentProfile.atOrAbove' })}</div>
                  </div>
                  <div className={style['halo-divider']} />
                  <div className={style['halo-metric']}>
                    <div className={classnames(style['halo-metric-value'], style['halo-metric-close'])}>
                      {metrics?.monthsToClose == null ? formatMessage({ id: 'talentProfile.emptyValue' }) : formatMessage({ id: 'talentProfile.monthsValue' }, { months: metrics.monthsToClose })}
                    </div>
                    <div className={style['halo-metric-label']}>{formatMessage({ id: 'talentProfile.toClose' })}</div>
                  </div>
                </Flex>
              </div>
            </div>
          </Card>

          <Card className={style['gaps-card']} theme="inset" hover={false} title={formatMessage({ id: 'talentProfile.priorityGaps' })} extra={formatMessage({ id: 'talentProfile.topGaps' }, { count: Math.min(3, priorityGaps.length || 3) })}>
            {priorityGaps.length === 0 ? (
              <Empty description={formatMessage({ id: 'talentProfile.noGaps' })} />
            ) : (
              <Flex vertical gap={10}>
                {priorityGaps.slice(0, 3).map((gap, index) => {
                  const hasScore = gap.current != null && gap.required != null;
                  return (
                    <div key={`${gap.rank}-${gap.title}-${index}`} className={style['gap-item']}>
                      <div className={style['gap-rank']}>{padRank(gap.rank || index + 1)}</div>
                      <div className={style['gap-body']}>
                        <div className={style['gap-title-row']}>
                          <div className={style['gap-title']}>{gap.title}</div>
                          {hasScore ? <div className={style['gap-score']}>{formatMessage({ id: 'talentProfile.gapScore' }, { current: gap.current, required: gap.required })}</div> : null}
                        </div>
                        {gap.description ? <div className={style['gap-desc']}>{gap.description}</div> : null}
                      </div>
                    </div>
                  );
                })}
              </Flex>
            )}
          </Card>
        </div>

        <Card
          className={style['future-task-card']}
          hover={false}
          padding={0}
          title={
            <span className={style['section-title']}>
              <span className={style['section-icon']}>
                <img src={iconClipboard} alt="" />
              </span>
              {formatMessage({ id: 'talentProfile.futureTaskReadiness' })}
            </span>
          }
        >
          {(rows || []).length === 0 ? (
            <Empty description={formatMessage({ id: 'talentProfile.readinessEmpty' })} />
          ) : (
            <div className={style['future-task-body']}>
              <div className={style['future-task-main']}>
                <div className={style['future-task-table']}>
                  {!isMobile ? (
                    <div className={classnames(style['task-row'], style['task-head'])}>
                      <div>{formatMessage({ id: 'talentProfile.colActivityTask' })}</div>
                      <div>{formatMessage({ id: 'talentProfile.status' })}</div>
                      <div>{formatMessage({ id: 'talentProfile.currentVsRequiredScale' })}</div>
                      <div className={style['task-head-end']}>{formatMessage({ id: 'talentProfile.confidence' })}</div>
                    </div>
                  ) : null}
                  {groups.map(group => {
                    const open = expanded[group.id] !== false;
                    return (
                      <div key={group.id} className={style['task-group']}>
                        <button type="button" className={style['task-parent']} onClick={() => toggleGroup(group.id)} aria-expanded={open}>
                          <span className={style['task-parent-main']}>
                            {group.code ? <span className={style['activity-code']}>{group.code}</span> : null}
                            <span className={style['activity-meta']}>
                              <span className={style['activity-title']}>{group.title || group.code}</span>
                              <span className={style['activity-count']}>{formatMessage({ id: 'talentProfile.activityTaskCount' }, { count: group.children.length })}</span>
                            </span>
                          </span>
                          <img className={classnames(style['collapse-icon'], !open && style['collapse-icon-collapsed'])} src={iconCollapse} alt="" />
                        </button>
                        {open
                          ? group.children.map(item => {
                              const status = resolveStatus(item);
                              const meta = STATUS_META[status] || STATUS_META.gap;
                              const confidence = item.confidence || 'medium';
                              return (
                                <div key={item.id} className={classnames(style['task-row'], style['task-child'], selectedTask?.id === item.id && style['task-selected'])} onClick={() => setSelectedId(item.id)}>
                                  <div className={style['task-name']} title={item.title}>
                                    {item.title}
                                  </div>
                                  <div>
                                    <span className={classnames(style['status-pill'], style[meta.tone])}>{formatMessage({ id: meta.labelKey })}</span>
                                  </div>
                                  <div className={style['task-progress-cell']}>
                                    <SkillProgress current={item.current} required={item.required} />
                                    <span className={style['skill-score']}>{formatMessage({ id: 'talentProfile.scoreSlash' }, { current: item.current ?? 0, required: item.required ?? 0 })}</span>
                                  </div>
                                  <div className={style['task-confidence']}>{formatMessage({ id: CONFIDENCE_KEYS[confidence] || CONFIDENCE_KEYS.medium })}</div>
                                </div>
                              );
                            })
                          : null}
                      </div>
                    );
                  })}
                </div>
                <div className={style.legend}>
                  <span className={style['legend-item']}>
                    <span className={style['legend-fill']} />
                    {formatMessage({ id: 'talentProfile.legendCurrent' })}
                  </span>
                  <span className={style['legend-item']}>
                    <span className={style['legend-mark']} />
                    {formatMessage({ id: 'talentProfile.legendRequired' })}
                  </span>
                  <span className={style['legend-item']}>
                    <span className={style['legend-gap']} />
                    {formatMessage({ id: 'talentProfile.legendGap' })}
                  </span>
                </div>
              </div>
              <div className={style['future-task-evidence']}>
                <ProfileEvidence employeeId={employeeId} variant="task" selectedTask={selectedTask} />
              </div>
            </div>
          )}
        </Card>
      </div>
    );
  })
);

export default ProfileReadiness;
