import { useIntl } from '@kne/react-intl';
import { GRID_COLORS, getGridSize, getLocation, resolveCell } from './constants';
import style from './style.module.scss';

const levelKeys = size => (size === 3 ? ['high', 'moderate', 'low'] : ['high', 'low']);

const Cell = ({ cell, color, count, onEdit }) => {
  const { formatMessage } = useIntl();
  return (
    <div className={style['grid-cell']} style={{ '--cell-color': color }}>
      <div className={style['grid-cell-title']} title={cell.title}>
        {cell.title}
      </div>
      {count === undefined ? (
        <>
          <div className={style['grid-cell-label']}>{formatMessage({ id: 'traits' })}</div>
          <div className={style['grid-cell-desc']}>{cell.description}</div>
        </>
      ) : null}
      {onEdit ? (
        <button type="button" className={style['grid-cell-edit']} onClick={onEdit}>
          {formatMessage({ id: 'edit' })}
        </button>
      ) : null}
      {count !== undefined ? (
        <div className={style['grid-cell-count']}>
          {formatMessage({ id: 'personCount' }, { count: count.count })}
          <small>({count.rate || 0}%)</small>
        </div>
      ) : null}
    </div>
  );
};

/**
 * 2D（维度 × 绩效）与 1D（仅维度）人才九宫格
 * counts: { [index]: { count, rate } } 传入时显示人数与占比，否则显示特质说明
 */
const GridBoard = ({ gridType, dimension, dimensionLabel, nineSquareGrid, locale, onEdit, counts, show1D = true, show2D = true }) => {
  const { formatMessage } = useIntl();
  const size = getGridSize(gridType);
  const colors = GRID_COLORS[size * size];
  const levels = levelKeys(size);
  const cellOf = index => resolveCell(nineSquareGrid, String(size * size), dimension, index, locale);
  const countOf = index => (counts ? counts[index] || { count: 0, rate: 0 } : undefined);

  return (
    <div className={style['grid-board']}>
      {show2D ? (
        <div className={style['grid-2d']}>
          <div className={style['grid-sub-title']}>
            {formatMessage({ id: 'withPerformance' })}
            <span className={style['grid-badge']}>{formatMessage({ id: 'grid2D' })}</span>
          </div>
          <div className={style['grid-axis-wrap']}>
            <div className={style['grid-axis-y']}>
              <span className={style['grid-axis-name']}>{dimensionLabel}</span>
              {levels.map(key => (
                <span key={key}>{formatMessage({ id: key })}</span>
              ))}
            </div>
            <div className={style['grid-cells']} style={{ gridTemplateColumns: `repeat(${size}, minmax(0, 162px))` }}>
              {levels.map((_, row) =>
                levels.map((__, col) => {
                  const index = getLocation(row, col, size);
                  return <Cell key={index} cell={cellOf(index)} color={colors[row * size + col]} count={countOf(index)} onEdit={onEdit ? () => onEdit(index) : null} />;
                })
              )}
            </div>
            <div />
            <div className={style['grid-axis-x']} style={{ gridTemplateColumns: `repeat(${size}, minmax(0, 162px))` }}>
              {[...levels].reverse().map(key => (
                <span key={key}>{formatMessage({ id: key })}</span>
              ))}
              <span className={style['grid-axis-name']}>{formatMessage({ id: 'performance' })}</span>
            </div>
          </div>
        </div>
      ) : null}
      {show1D ? (
        <div className={style['grid-1d']} style={show2D ? undefined : { width: '100%', paddingLeft: 0, borderLeft: 'none' }}>
          <div className={style['grid-sub-title']}>
            {formatMessage({ id: 'noPerformance' })}
            <span className={style['grid-badge']}>{formatMessage({ id: 'grid1D' })}</span>
          </div>
          <div className={style['grid-axis-wrap']}>
            <div className={style['grid-axis-y']}>
              <span className={style['grid-axis-name']}>{dimensionLabel}</span>
              {levels.map(key => (
                <span key={key}>{formatMessage({ id: key })}</span>
              ))}
            </div>
            <div className={style['grid-cells']} style={{ gridTemplateColumns: 'minmax(0, 162px)' }}>
              {levels.map((_, row) => {
                const index = getLocation(row, 0, size);
                return <Cell key={index} cell={cellOf(index)} color={colors[row * size]} count={countOf(index)} onEdit={onEdit && !show2D ? () => onEdit(index) : null} />;
              })}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default GridBoard;
