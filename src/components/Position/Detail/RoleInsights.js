import { useEffect, useMemo, useState } from 'react';
import { Tooltip } from 'antd';
import { createWithRemoteLoader } from '@kne/remote-loader';
import { useIntl } from '@kne/react-intl';
import withLocale from '../withLocale';
import RoleInsightsContent from './RoleInsightsContent';
import style from './RoleInsights.module.scss';

const TAG_TO_CHANGE = {
  critical_to_build: 'must_build',
  ai_emerging: 'ai_emerging',
  new: 'new',
  increasing: 'enhanced',
  stable: 'stable',
  decreasing: 'declining'
};

const taskToSkill = task => {
  const detail = task?.detail && typeof task.detail === 'object' ? task.detail : {};
  const fromItems = Array.isArray(detail.contentItems) ? detail.contentItems : Array.isArray(detail.evidence) ? detail.evidence : Array.isArray(detail.evidenceItems) ? detail.evidenceItems : null;

  let contentItems = [];
  if (fromItems) {
    contentItems = fromItems
      .map(item => {
        if (!item || typeof item !== 'object') {
          return null;
        }
        const title = typeof item.title === 'string' ? item.title.trim() : typeof item.sourceType === 'string' ? item.sourceType.trim() : '';
        const description = typeof item.description === 'string' ? item.description.trim() : typeof item.summary === 'string' ? item.summary.trim() : typeof item.desc === 'string' ? item.desc.trim() : '';
        const source = typeof item.source === 'string' ? item.source.trim() : typeof item.sourceReference === 'string' ? item.sourceReference.trim() : typeof item.reference === 'string' ? item.reference.trim() : '';
        if (!title && !description && !source) {
          return null;
        }
        return { title, description, source };
      })
      .filter(Boolean);
  }

  const activityGroup = task.activityGroup || '';
  const activityMatch = String(activityGroup).match(/^([A-Za-z]?\d{1,3})\s*[·.\-–—:]?\s*(.*)$/);
  return {
    id: String(task.id),
    name: task.title || '',
    activityGroup,
    activityCode: activityMatch?.[1] ? activityMatch[1].toUpperCase() : '',
    activityTitle: activityMatch?.[2] ? activityMatch[2].trim() : activityGroup,
    origin: task.changeTag === 'new' || task.changeTag === 'ai_emerging' ? 'new' : 'existing',
    importanceNow: task.importanceNow,
    importanceYear: task.importanceFuture,
    change: TAG_TO_CHANGE[task.changeTag] || 'stable',
    confidence: task.confidence || 'medium',
    aiExposure: detail.aiExposure || 'medium',
    contentItems
  };
};

const outlookToVerdict = outlook => {
  const data = outlook && typeof outlook === 'object' ? outlook : {};
  const today = Array.isArray(data.drivesSuccessNow) ? data.drivesSuccessNow.filter(Boolean).join('\n') : data.today || '';
  const future = Array.isArray(data.howRoleChanging) ? data.howRoleChanging.filter(Boolean).join('\n') : data.future || '';
  return {
    summary: data.summary || '',
    today,
    future
  };
};

const RoleInsights = createWithRemoteLoader({
  modules: ['components-core:Global@usePreset']
})(
  withLocale(({ remoteModules, apis, position }) => {
    const [usePreset] = remoteModules;
    const { ajax } = usePreset();
    const { formatMessage } = useIntl();
    const [tasks, setTasks] = useState(null);
    const [talentMetrics, setTalentMetrics] = useState(null);

    useEffect(() => {
      let cancelled = false;
      const load = async () => {
        if (!apis?.tasks || !position?.id) {
          setTasks([]);
          return;
        }
        try {
          const { data: resData } = await ajax(Object.assign({}, apis.tasks, { params: { positionId: position.id } }));
          if (!cancelled) {
            setTasks(resData?.code === 0 ? resData.data?.pageData || [] : []);
          }
        } catch (e) {
          if (!cancelled) {
            setTasks([]);
          }
        }
      };
      load();
      return () => {
        cancelled = true;
      };
    }, [ajax, apis?.tasks, position?.id]);

    useEffect(() => {
      let cancelled = false;
      const load = async () => {
        if (!apis?.employeeList || !position?.id) {
          return;
        }
        try {
          const { data: resData } = await ajax(
            Object.assign({}, apis.employeeList, {
              params: {
                positionId: String(position.id),
                currentPage: 1,
                perPage: 1,
                filter: { withTalentAnalysis: true }
              }
            })
          );
          if (!cancelled && resData?.code === 0) {
            setTalentMetrics(resData.data?.talentMetrics || null);
          }
        } catch (e) {
          if (!cancelled) {
            setTalentMetrics(null);
          }
        }
      };
      load();
      return () => {
        cancelled = true;
      };
    }, [ajax, apis?.employeeList, position?.id]);

    const skills = useMemo(() => {
      if (!Array.isArray(tasks) || !tasks.length) {
        return [];
      }
      return tasks.map(taskToSkill);
    }, [tasks]);

    const strategies = Array.isArray(position?.workforceStrategy) ? position.workforceStrategy : [];
    const magnitude = position?.changeMagnitude || 'low';
    const assessed = talentMetrics?.assessed || 0;
    const total = talentMetrics?.total || 0;
    const efficiencyGain = position?.outlook?.aiEfficiencyGain ?? position?.verdict?.aiEfficiencyGain;
    const efficiencyText = efficiencyGain == null || efficiencyGain === '' || !Number.isFinite(Number(efficiencyGain)) ? '—' : `${Math.round(Number(efficiencyGain))}%`;

    if (tasks == null) {
      return null;
    }

    const renderCaption = (captionId, tipId) => (
      <div className={style['impact-caption']}>
        <Tooltip placement="bottom" styles={{ root: { maxWidth: 440 } }} title={<div style={{ whiteSpace: 'pre-line', textAlign: 'justify' }}>{formatMessage({ id: tipId })}</div>}>
          <span className={style['impact-caption-tip']}>{formatMessage({ id: captionId })}</span>
        </Tooltip>
      </div>
    );

    const renderValue = (text, tip) => (
      <div className={style['impact-value']}>
        <Tooltip placement="top" styles={{ root: { maxWidth: 440 } }} title={<div style={{ textAlign: 'justify' }}>{tip}</div>}>
          <span className={style['impact-value-tip']}>{text}</span>
        </Tooltip>
      </div>
    );

    const teamReadiness = talentMetrics?.teamReadiness;
    const efficiencyValue = efficiencyText === '—' ? null : Math.round(Number(efficiencyGain));

    const impact = (
      <div className={style.impact}>
        <div className={style['impact-item']}>
          {renderValue(formatMessage({ id: `position.changeMagnitude.${magnitude}` }), formatMessage({ id: `position.aiImpactValueTip.${magnitude}` }))}
          {renderCaption('position.aiImpactCaption', 'position.aiImpactTip')}
        </div>
        <div className={style['impact-divider']} />
        <div className={style['impact-item']}>
          {renderValue(
            teamReadiness == null ? '—' : `${teamReadiness}%`,
            teamReadiness == null ? formatMessage({ id: 'position.teamReadinessValueTipEmpty' }) : formatMessage({ id: 'position.teamReadinessValueTip' }, { count: assessed, value: teamReadiness })
          )}
          {renderCaption('position.teamReadinessCaption', 'position.teamReadinessTip')}
        </div>
        <div className={style['impact-divider']} />
        <div className={style['impact-item']}>
          {renderValue(efficiencyText, efficiencyValue == null ? formatMessage({ id: 'position.aiEfficiencyGainValueTipEmpty' }) : formatMessage({ id: 'position.aiEfficiencyGainValueTip' }, { value: efficiencyValue }))}
          {renderCaption('position.aiEfficiencyGainCaption', 'position.aiEfficiencyGainTip')}
        </div>
        <div className={style['impact-divider']} />
        <div className={style['impact-item']}>
          <div className={style['impact-value']}>{formatMessage({ id: 'position.assessedValue' }, { assessed, total })}</div>
          <div className={style['impact-caption']}>{formatMessage({ id: 'position.assessedCaption' })}</div>
        </div>
      </div>
    );

    return <RoleInsightsContent skill={skills} verdict={outlookToVerdict(position?.outlook)} impact={impact} strategies={strategies} />;
  })
);

export default RoleInsights;
