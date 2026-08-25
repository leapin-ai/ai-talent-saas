import React from 'react';
import classnames from 'classnames';
import style from './style.module.scss';

const ImportanceBar = ({ importanceNow, importanceYear }) => {
  const now = Number(importanceNow) || 1;
  const year = Number(importanceYear) || 1;
  const low = Math.min(now, year);
  const high = Math.max(now, year);
  const declining = year < now;
  const left = ((low - 1) / 4) * 100;
  const width = high === low ? 100 / 5 : ((high - low) / 4) * 100;

  return (
    <div className={style.importance}>
      <div className={style['importance-track']}>
        <div className={classnames(style['importance-fill'], declining ? style['importance-fill-down'] : style['importance-fill-up'])} style={{ left: `${left}%`, width: `${Math.max(width, 8)}%` }} />
      </div>
      <span className={classnames(style['importance-label'], declining ? style['importance-label-down'] : style['importance-label-up'])}>
        {now}→{year}
      </span>
    </div>
  );
};

export default ImportanceBar;
