import { useEffect, useMemo, useState } from 'react';
import { Empty } from 'antd';
import { createWithRemoteLoader } from '@kne/remote-loader';
import { useIntl } from '@kne/react-intl';
import withLocale from '../withLocale';
import SkillList from './SkillList';
import SkillOverview from './SkillList/SkillOverview';
import style from './RoleInsights.module.scss';

const TAG_TO_CHANGE = {
  critical_to_build: 'must_build',
  ai_emerging: 'ai_emerging',
  new: 'new',
  increasing: 'enhanced',
  stable: 'stable',
  decreasing: 'declining'
};

const ACTION_CLASS = {
  BUILD: 'strategy-action-build',
  MOVE: 'strategy-action-move',
  BUY: 'strategy-action-buy',
  AUGMENT: 'strategy-action-augment'
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

  return {
    id: String(task.id),
    name: task.title || '',
    activityGroup: task.activityGroup || '',
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

    if (tasks == null) {
      return null;
    }

    return (
      <div className={style.stack}>
        <section className={style.card}>
          <SkillOverview skill={skills} verdict={outlookToVerdict(position?.outlook)} />
          <div className={style.impact}>
            <div className={style['impact-item']}>
              <div className={style['impact-value']}>{formatMessage({ id: `position.changeMagnitude.${magnitude}` })}</div>
              <div className={style['impact-caption']}>{formatMessage({ id: 'position.aiImpactCaption' })}</div>
            </div>
            <div className={style['impact-divider']} />
            <div className={style['impact-item']}>
              <div className={style['impact-value']}>{talentMetrics?.teamReadiness == null ? '—' : `${talentMetrics.teamReadiness}%`}</div>
              <div className={style['impact-caption']}>{formatMessage({ id: 'position.teamReadinessCaption' })}</div>
            </div>
            <div className={style['impact-divider']} />
            <div className={style['impact-item']}>
              <div className={style['impact-value']}>{formatMessage({ id: 'position.assessedValue' }, { assessed, total })}</div>
              <div className={style['impact-caption']}>{formatMessage({ id: 'position.assessedCaption' })}</div>
            </div>
          </div>
        </section>
        <section className={style.card}>
          <h2 className={style['section-title']}>{formatMessage({ id: 'position.skillListTitle' })}</h2>
          {skills.length ? (
            <SkillList skill={skills} />
          ) : (
            <div className={style['tasks-empty']}>
              <Empty description={formatMessage({ id: 'position.roleTasksEmpty' })} />
            </div>
          )}
        </section>
        {strategies.length ? (
          <section className={style.card}>
            <h2 className={style['section-title']}>{formatMessage({ id: 'position.gapRecommendations' })}</h2>
            <div className={style.strategies}>
              {strategies.map(card => {
                const action = String(card.action || '').toUpperCase();
                return (
                  <article key={card.id || action} className={style.strategy}>
                    <div className={`${style['strategy-action']} ${style[ACTION_CLASS[action]] || ''}`}>{action}</div>
                    <div className={style['strategy-title']}>{card.title}</div>
                    {card.detail ? <p className={style['strategy-detail']}>{card.detail}</p> : null}
                  </article>
                );
              })}
            </div>
          </section>
        ) : null}
      </div>
    );
  })
);

export default RoleInsights;
