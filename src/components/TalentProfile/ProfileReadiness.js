import { useEffect, useMemo, useState } from 'react';
import { App, Button, Empty, Flex, Typography } from 'antd';
import { MdOutlineEdit } from 'react-icons/md';
import { Card } from '@kne/react-box';
import '@kne/react-box/dist/index.css';
import { createWithRemoteLoader } from '@kne/remote-loader';
import { useIntl } from '@kne/react-intl';
import classnames from 'classnames';
import ActivityTaskTable from '@components/ActivityTaskTable';
import withLocale from './withLocale';
import ProfileEvidence from './ProfileEvidence';
import { ReadinessFormInner, TaskReadinessFormInner } from './FormInner';
import { CapabilityStatusCard } from '@components/Position/Detail/TalentSkillAnalysis';
import style from './style.module.scss';
import iconClipboard from './assets/icon-clipboard.svg';

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
  modules: ['components-core:Global@usePreset', 'components-core:FormInfo@useFormModal', 'components-core:Global@useGlobalValue']
})(
  withLocale(({ remoteModules, positionId, employeeId, displayName, readOnly, analysisOverride }) => {
    const [usePreset, useFormModal, useGlobalValue] = remoteModules;
    const { ajax, apis } = usePreset();
    const formModal = useFormModal();
    const { message } = App.useApp();
    const { formatMessage } = useIntl();
    const themeColor = useGlobalValue('themeToken')?.colorPrimary;
    const [rows, setRows] = useState(null);
    const [analysis, setAnalysis] = useState(null);
    const [error, setError] = useState('');
    const [selectedId, setSelectedId] = useState(null);
    const [expanded, setExpanded] = useState({});
    const [reloadKey, setReloadKey] = useState(0);

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
    }, [ajax, apis, employeeId, formatMessage, positionId, reloadKey]);

    const derived = useMemo(() => deriveFromRows(rows || []), [rows]);
    const effectiveAnalysis = analysisOverride || analysis;
    const readiness = effectiveAnalysis?.readiness != null ? effectiveAnalysis.readiness : derived.readiness;
    const metrics = effectiveAnalysis?.metrics || derived.metrics;
    const priorityGaps = Array.isArray(effectiveAnalysis?.priorityGaps) && effectiveAnalysis.priorityGaps.length ? effectiveAnalysis.priorityGaps : derived.priorityGaps;
    const summary = effectiveAnalysis?.summary || '';

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
          countLabel: formatMessage({ id: 'talentProfile.activityTaskCount' }, { count: children.length }),
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

    if (!positionId && !effectiveAnalysis) {
      return <Empty description={formatMessage({ id: 'talentProfile.readinessNoPosition' })} />;
    }
    if (rows == null && positionId) {
      return null;
    }

    const toggleGroup = id => {
      setExpanded(prev => ({ ...prev, [id]: !(prev[id] !== false) }));
    };

    const openEditReadiness = () => {
      if (readOnly || !positionId || !employeeId) {
        return;
      }
      const saveApi = apis?.talentSaas?.tenant?.position?.skillAnalysisSave;
      if (!saveApi) {
        message.error(formatMessage({ id: 'talentProfile.editReadinessFailed' }));
        return;
      }
      formModal({
        title: formatMessage({ id: 'talentProfile.editReadiness' }),
        size: 'small',
        formProps: {
          data: {
            readiness: readiness ?? 0,
            summary: summary || '',
            metrics: {
              criticalGaps: metrics?.criticalGaps ?? 0,
              atOrAbove: metrics?.atOrAbove ?? 0,
              monthsToClose: metrics?.monthsToClose ?? null
            },
            priorityGaps: (priorityGaps || []).map((gap, index) => ({
              rank: gap.rank || index + 1,
              title: gap.title || '',
              description: gap.description || '',
              current: gap.current ?? null,
              required: gap.required ?? null
            }))
          },
          onSubmit: async formData => {
            const { data: resData } = await ajax(
              Object.assign({}, saveApi, {
                data: {
                  positionId: String(positionId),
                  employeeId: String(employeeId),
                  readiness: formData.readiness,
                  summary: formData.summary,
                  metrics: formData.metrics,
                  priorityGaps: formData.priorityGaps,
                  skills: effectiveAnalysis?.skills || analysis?.skills || [],
                  developmentPlan: effectiveAnalysis?.developmentPlan || analysis?.developmentPlan || null
                }
              })
            );
            if (resData.code !== 0) {
              throw new Error(resData.msg || formatMessage({ id: 'talentProfile.editReadinessFailed' }));
            }
            message.success(formatMessage({ id: 'talentProfile.editReadinessSuccess' }));
            setReloadKey(key => key + 1);
          }
        },
        children: <ReadinessFormInner />
      });
    };

    const openEditFutureTasks = async () => {
      if (readOnly || !positionId || !employeeId || String(employeeId).startsWith('draft-')) {
        return;
      }
      const replaceApi = apis?.talentSaas?.tenant?.position?.taskReadinessReplace;
      const tasksApi = apis?.talentSaas?.tenant?.position?.tasks;
      if (!replaceApi) {
        message.error(formatMessage({ id: 'talentProfile.editFutureTasksFailed' }));
        return;
      }

      let taskRows = (rows || []).map(item => ({
        id: item.id || null,
        taskId: item.taskId,
        title: item.title || '',
        activityGroup: item.activityGroup || '',
        current: item.current ?? 0,
        required: item.required ?? 0,
        status: item.status || 'gap',
        confidence: item.confidence || 'medium'
      }));

      if (!taskRows.length && tasksApi) {
        try {
          const { data: tasksRes } = await ajax(Object.assign({}, tasksApi, { params: { positionId: String(positionId) } }));
          if (tasksRes?.code === 0) {
            taskRows = (tasksRes.data?.pageData || []).map(task => ({
              id: null,
              taskId: task.id,
              title: task.title || '',
              activityGroup: task.activityGroup || '',
              current: 0,
              required: task.importanceFuture ?? task.importanceNow ?? 0,
              status: 'gap',
              confidence: 'medium'
            }));
          }
        } catch (e) {
          // ignore, fall through to empty check
        }
      }

      if (!taskRows.length) {
        message.warning(formatMessage({ id: 'talentProfile.editFutureTasksEmpty' }));
        return;
      }

      formModal({
        title: formatMessage({ id: 'talentProfile.editFutureTasks' }),
        size: 'small',
        formProps: {
          data: { tasks: taskRows },
          onSubmit: async formData => {
            const payloadRows = (formData.tasks || [])
              .map((item, index) => ({
                taskId: item.taskId || taskRows[index]?.taskId,
                current: item.current,
                required: item.required,
                status: item.status,
                confidence: item.confidence
              }))
              .filter(item => item.taskId);
            const { data: resData } = await ajax(
              Object.assign({}, replaceApi, {
                data: {
                  positionId: String(positionId),
                  employeeId: String(employeeId),
                  rows: payloadRows
                }
              })
            );
            if (resData.code !== 0) {
              throw new Error(resData.msg || formatMessage({ id: 'talentProfile.editFutureTasksFailed' }));
            }
            message.success(formatMessage({ id: 'talentProfile.editFutureTasksSuccess' }));
            setReloadKey(key => key + 1);
          }
        },
        children: <TaskReadinessFormInner itemCount={taskRows.length} />
      });
    };

    const canEditFutureTasks = !readOnly && positionId && employeeId && !String(employeeId).startsWith('draft-');

    return (
      <div className={style['readiness-root']}>
        {error ? <Typography.Text type="danger">{error}</Typography.Text> : null}
        <div className={style['readiness-top']}>
          <CapabilityStatusCard name={displayName} readiness={readiness} summary={summary} metrics={metrics} themeColor={themeColor} />

          <Card
            className={style['gaps-card']}
            theme="inset"
            hover={false}
            title={formatMessage({ id: 'talentProfile.priorityGaps' })}
            extra={
              <Flex align="center" gap={4}>
                <span className={style['gaps-badge']}>{formatMessage({ id: 'talentProfile.topGaps' }, { count: Math.min(3, priorityGaps.length || 3) })}</span>
                {!readOnly && positionId && employeeId ? <Button type="text" className={style['edit-btn']} icon={<MdOutlineEdit />} onClick={openEditReadiness} /> : null}
              </Flex>
            }
          >
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
          extra={
            canEditFutureTasks ? (
              <Button type="text" className={style['edit-btn']} icon={<MdOutlineEdit />} onClick={openEditFutureTasks}>
                {formatMessage({ id: 'talentProfile.editFutureTasks' })}
              </Button>
            ) : null
          }
        >
          {(rows || []).length === 0 ? (
            <Empty description={formatMessage({ id: 'talentProfile.readinessEmpty' })} />
          ) : (
            <div className={style['future-task-body']}>
              <div className={style['future-task-main']}>
                <ActivityTaskTable
                  groups={groups}
                  columns={[
                    formatMessage({ id: 'talentProfile.colActivityTask' }),
                    formatMessage({ id: 'talentProfile.status' }),
                    formatMessage({ id: 'talentProfile.currentVsRequiredScale' }),
                    formatMessage({ id: 'talentProfile.confidence' })
                  ]}
                  expanded={expanded}
                  onToggle={toggleGroup}
                  selectedId={selectedTask?.id}
                  onSelect={item => setSelectedId(item.id)}
                  onHover={item => {
                    if (item?.id && item.id !== selectedId) {
                      setSelectedId(item.id);
                    }
                  }}
                  renderPrimary={item => item.title}
                  renderSecondary={item => {
                    const status = resolveStatus(item);
                    const meta = STATUS_META[status] || STATUS_META.gap;
                    return <span className={classnames(style['status-pill'], style[meta.tone])}>{formatMessage({ id: meta.labelKey })}</span>;
                  }}
                  renderMetric={item => (
                    <div className={style['task-progress-cell']}>
                      <SkillProgress current={item.current} required={item.required} />
                      <span className={style['skill-score']}>{formatMessage({ id: 'talentProfile.scoreSlash' }, { current: item.current ?? 0, required: item.required ?? 0 })}</span>
                    </div>
                  )}
                  renderTrailing={item => formatMessage({ id: CONFIDENCE_KEYS[item.confidence || 'medium'] || CONFIDENCE_KEYS.medium })}
                />
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
                <ProfileEvidence employeeId={employeeId} variant="task" selectedTask={selectedTask} readOnly={readOnly} />
              </div>
            </div>
          )}
        </Card>
      </div>
    );
  })
);

export default ProfileReadiness;
