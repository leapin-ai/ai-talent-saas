import { useIntl } from '@kne/react-intl';
import withLocale from '../withLocale';
import SkillList from './SkillList';
import SkillOverview from './SkillList/SkillOverview';
import style from './RoleInsights.module.scss';

/**
 * Role Insights 只读展示：SkillOverview + Task 列表 + Gap Recommendations。
 * 岗位详情与分析任务预览共用，保证样式一致。
 */
const RoleInsightsContent = withLocale(({ skill, verdict, impact = null, strategies = null }) => {
  const { formatMessage } = useIntl();
  const skills = Array.isArray(skill) ? skill : [];
  const strategyList = Array.isArray(strategies) ? strategies.filter(card => card && (card.action || card.title || card.detail)) : [];

  return (
    <div className={style.stack}>
      <section className={style['overview-shell']}>
        <SkillOverview skill={skills} verdict={verdict} />
        {impact}
      </section>
      <section className={style.card}>
        <h2 className={style['section-title']}>{formatMessage({ id: 'position.skillListTitle' })}</h2>
        <SkillList skill={skills} />
      </section>
      {strategyList.length ? (
        <section className={style.card}>
          <h2 className={style['section-title']}>{formatMessage({ id: 'position.gapRecommendations' })}</h2>
          <div className={style.strategies}>
            {strategyList.map(card => {
              const action = String(card.action || '').toUpperCase();
              return (
                <article key={card.id || `${action}-${card.title}`} className={style.strategy}>
                  <div className={style['strategy-action']}>{action || '—'}</div>
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
