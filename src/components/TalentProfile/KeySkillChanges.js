import { Empty } from 'antd';
import { Card } from '@kne/react-box';
import { useIntl } from '@kne/react-intl';
import classnames from 'classnames';
import { MdAdd, MdCallMerge, MdTrendingUp } from 'react-icons/md';
import style from './style.module.scss';
import keyStyle from './keySkillChanges.module.scss';
import iconPath from './assets/icon-path.svg';

const getChangeType = item => {
  const count = (item.skillNow || []).length;
  if (count === 0) {
    return 'new';
  }
  return count > 1 ? 'merge' : 'upgrade';
};

const CHANGE_ICONS = {
  merge: MdCallMerge,
  upgrade: MdTrendingUp,
  new: MdAdd
};

const CATEGORY_KEYS = ['tool', 'action', 'knowledge'];

const KeySkillChanges = ({ gaps, extra }) => {
  const { formatMessage } = useIntl();
  const list = (Array.isArray(gaps) ? gaps : []).slice().sort((a, b) => (a.rank || 0) - (b.rank || 0));
  if (!list.length && !extra) {
    return null;
  }

  return (
    <Card
      className={style['future-task-card']}
      hover={false}
      padding={0}
      title={
        <span className={style['section-title']}>
          <span className={style['section-icon']}>
            <img src={iconPath} alt="" />
          </span>
          {formatMessage({ id: 'talentProfile.keySkillChanges' })}
        </span>
      }
      extra={extra}
    >
      {!list.length ? (
        <Empty description={formatMessage({ id: 'talentProfile.keySkillEmpty' })} />
      ) : (
        <div className={keyStyle['table']}>
          <div className={classnames(keyStyle['row'], keyStyle['head'])}>
            <div className={keyStyle['now']}>{formatMessage({ id: 'talentProfile.keySkillNow' })}</div>
            <div className={keyStyle['change']} />
            <div className={keyStyle['future']}>{formatMessage({ id: 'talentProfile.keySkillFuture' })}</div>
          </div>
          {list.map((item, index) => {
            const type = getChangeType(item);
            const ChangeIcon = CHANGE_ICONS[type];
            const tasks = [item.primaryTask].concat(item.alsoOnTasks || []).filter(Boolean);
            return (
              <div key={`${item.rank}-${item.name}-${index}`} className={keyStyle['row']}>
                <div className={keyStyle['now']}>
                  {type === 'new' ? (
                    <span className={keyStyle['none']}>—</span>
                  ) : (
                    item.skillNow.map(skill => (
                      <div key={skill} className={keyStyle['now-item']}>
                        {skill}
                      </div>
                    ))
                  )}
                </div>
                <div className={classnames(keyStyle['change'], keyStyle[`is-${type}`])}>
                  <span className={keyStyle['change-tag']}>
                    <ChangeIcon className={keyStyle['change-icon']} />
                    {formatMessage({ id: `talentProfile.keySkillType.${type}` })}
                  </span>
                  <span className={keyStyle['change-arrow']} />
                </div>
                <div className={keyStyle['future']}>
                  <div className={classnames(keyStyle['future-name'], type === 'new' && keyStyle['is-new'])}>{item.skillFuture || item.name}</div>
                  <div className={keyStyle['future-meta']}>
                    {CATEGORY_KEYS.includes(item.category) ? <span className={keyStyle['category']}>{formatMessage({ id: `talentProfile.keySkillCategory.${item.category}` })}</span> : null}
                    {tasks.length ? (
                      <span className={keyStyle['tasks']} title={tasks.join(' / ')}>
                        {item.primaryTask || tasks[0]}
                        {tasks.length > 1 ? <span className={keyStyle['tasks-more']}>+{tasks.length - 1}</span> : null}
                      </span>
                    ) : null}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
};

export default KeySkillChanges;
