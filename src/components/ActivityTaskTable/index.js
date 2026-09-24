import classnames from 'classnames';
import { useIsMobile } from '@kne/responsive-utils';
import PinnedScrollPanel from '@components/PinnedScrollPanel';
import iconCollapse from './assets/icon-collapse.svg';
import style from './style.module.scss';

/**
 * 活动分组任务表。岗位洞察与未来任务就绪共用。
 * 移动端收起表头，任务名独占一行，置信度在右，其余两列落在第二行。
 * 传入 maxBodyHeight 时：表头/footer 固定，中间分组限高滚动（PinnedScrollPanel）。
 */
const ActivityTaskTable = ({ groups = [], columns = [], expanded = {}, onToggle, selectedId, onSelect, onHover, renderPrimary, renderSecondary, renderMetric, renderTrailing, empty = null, footer = null, maxBodyHeight }) => {
  const isMobile = useIsMobile();
  const [primaryTitle, secondaryTitle, metricTitle, trailingTitle] = columns;

  if (!groups.length) {
    return <div className={style.table}>{empty ? <div className={style['task-empty']}>{empty}</div> : null}</div>;
  }

  const head = !isMobile ? (
    <div className={classnames(style['task-row'], style['task-head'])}>
      <div>{primaryTitle}</div>
      <div>{secondaryTitle}</div>
      <div>{metricTitle}</div>
      <div className={style['task-head-end']}>{trailingTitle}</div>
    </div>
  ) : null;

  const body = groups.map(group => {
    const open = expanded[group.id] !== false;
    return (
      <div key={group.id} className={style['task-group']}>
        <button type="button" className={style['task-parent']} onClick={() => onToggle?.(group.id)} aria-expanded={open}>
          <span className={style['task-parent-main']}>
            {group.code ? <span className={style['activity-code']}>{group.code}</span> : null}
            <span className={style['activity-meta']}>
              <span className={style['activity-title']}>{group.title || group.code}</span>
              {group.countLabel ? <span className={style['activity-count']}>{group.countLabel}</span> : null}
            </span>
          </span>
          <img className={classnames(style['collapse-icon'], !open && style['collapse-icon-collapsed'])} src={iconCollapse} alt="" />
        </button>
        <div className={classnames(style['task-children'], !open && style['task-children-collapsed'])}>
          {(group.children || []).map(item => (
            <div key={item.id} className={classnames(style['task-row'], style['task-child'], selectedId === item.id && style['task-selected'])} onClick={() => onSelect?.(item)} onMouseEnter={onHover ? () => onHover(item) : undefined}>
              <div className={style['task-name']} title={typeof item.name === 'string' ? item.name : item.title}>
                {renderPrimary?.(item)}
              </div>
              <div className={style['task-secondary']}>{renderSecondary?.(item)}</div>
              <div className={style['task-metric']}>{renderMetric?.(item)}</div>
              <div className={style['task-confidence']}>{renderTrailing?.(item)}</div>
            </div>
          ))}
        </div>
      </div>
    );
  });

  if (maxBodyHeight) {
    return (
      <PinnedScrollPanel className={style.table} maxHeight={maxBodyHeight} header={head} footer={footer ? <div className={style['table-footer']}>{footer}</div> : null}>
        {body}
      </PinnedScrollPanel>
    );
  }

  return (
    <div className={style.table}>
      {head}
      {body}
      {footer ? <div className={style['table-footer']}>{footer}</div> : null}
    </div>
  );
};

export default ActivityTaskTable;
