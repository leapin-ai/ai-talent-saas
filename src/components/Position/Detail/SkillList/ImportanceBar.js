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
    // Absolute level from the left (5 → 5 fills the whole track).
    left = 0;
    width = Math.max(toTrackPercent(now), 8);
  } else {
    // Colored segment covers the span between now and year.
    const low = Math.min(now, year);
    const high = Math.max(now, year);
    left = toTrackPercent(low);
    width = toTrackPercent(high) - left;
  }

  return (
    <div className={style.importance}>
      <div className={style['importance-track']}>
        <div className={classnames(style['importance-fill'], declining ? style['importance-fill-down'] : style['importance-fill-up'])} style={{ left: `${left}%`, width: `${width}%` }} />
      </div>
      <span className={classnames(style['importance-label'], declining ? style['importance-label-down'] : style['importance-label-up'])}>
        {now} → {year}
      </span>
    </div>
  );
};

export default ImportanceBar;
