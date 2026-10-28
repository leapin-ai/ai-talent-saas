import { useState } from 'react';
import Tooltip from '../../../commons/ResponsiveTooltip';
import { useIntl } from '@kne/react-intl';
import withLocale from '../withLocale';
import SkillList from './SkillList';
import SkillOverview from './SkillList/SkillOverview';
import style from './RoleInsights.module.scss';

const STRATEGY_ACTIONS = ['BUILD', 'MOVE', 'BUY', 'AUGMENT'];

/**
 * Role Insights 只读展示：SkillOverview + Task 列表 + Gap Recommendations。
 * 岗位详情与分析任务预览共用，保证样式一致。
 */
const RoleInsightsContent = withLocale(({ skill, verdict, impact = null, strategies = null }) => {
  const { formatMessage } = useIntl();
  const [changeFilter, setChangeFilter] = useState('all');
  const skills = Array.isArray(skill) ? skill : [];
  const strategyList = Array.isArray(strategies) ? strategies.filter(card => card && (card.action || card.title || card.detail)) : [];

  return (
    <div className={style.stack}>
      <section className={style['overview-shell']}>
        <SkillOverview skill={skills} verdict={verdict} activeFilter={changeFilter} onSelect={setChangeFilter} />
        {impact}
      </section>
      <section className={style.card}>
        <h2 className={style['section-title']}>{formatMessage({ id: 'position.skillListTitle' })}</h2>
        <SkillList skill={skills} filter={changeFilter} onFilterChange={setChangeFilter} />
      </section>
      {strategyList.length ? (
        <section className={style.card}>
          <h2 className={style['section-title']}>{formatMessage({ id: 'position.gapRecommendations' })}</h2>
          <div className={style.strategies}>
            {strategyList.map(card => {
              const action = String(card.action || '').toUpperCase();
              const known = STRATEGY_ACTIONS.includes(action);
              return (
                <article key={card.id || `${action}-${card.title}`} className={style.strategy}>
                  <div className={style['strategy-action']}>
                    {known ? (
                      <Tooltip title={formatMessage({ id: `position.strategyActionTip.${action}` })}>
                        <span className={style['strategy-action-label']}>{formatMessage({ id: `position.strategyAction.${action}` })}</span>
                      </Tooltip>
                    ) : (
                      action || '—'
                    )}
                  </div>
                  <div className={style['strategy-title']}>{card.title || '—'}</div>
                  {card.detail ? <p className={style['strategy-detail']}>{card.detail}</p> : null}
                </article>
              );
            })}
          </div>
        </section>
      ) : null}
    </div>
  );
});

export default RoleInsightsContent;
