import React from 'react';
import classnames from 'classnames';
import style from './style.module.scss';

/** Map importance 1–5 onto the track: 1 → 0%, 5 → 100%. */
const toTrackPercent = value => ((Number(value) - 1) / 4) * 100;

const ImportanceBar = ({ importanceNow, importanceYear }) => {
  const now = Math.min(5, Math.max(1, Number(importanceNow) || 1));
  const year = Math.min(5, Math.max(1, Number(importanceYear) || 1));
  const declining = year < now;
  const equal = year === now;

  let left;
  let width;
  if (equal) {
    left = 0;
    width = Math.max(toTrackPercent(now), 8);
  } else {
    const low = Math.min(now, year);
    const high = Math.max(now, year);
    left = toTrackPercent(low);
    width = Math.max(toTrackPercent(high) - left, 6);
  }

  const tone = declining ? 'down' : 'up';

  return (
    <div className={style.importance}>
      <div className={style['importance-track']}>
        <div className={classnames(style['importance-fill'], style[`importance-fill-${tone}`])} style={{ left: `${left}%`, width: `${width}%` }} />
        <span className={classnames(style['importance-dot'], style[`importance-dot-${tone}`])} style={{ left: `${toTrackPercent(now)}%` }} />
        <span className={classnames(style['importance-dot'], style[`importance-dot-${tone}`])} style={{ left: `${toTrackPercent(year)}%` }} />
      </div>
      <span className={classnames(style['importance-label'], style[`importance-label-${tone}`])}>
        {now}→{year}
      </span>
    </div>
  );
};

export default ImportanceBar;
