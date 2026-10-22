import React from 'react';
import { Tooltip } from 'antd';
import { useIntl } from '@kne/react-intl';
import classnames from 'classnames';
import style from './style.module.scss';

/** Map importance 1–5 onto the track: 1 → 0%, 5 → 100%. */
const toTrackPercent = value => ((Number(value) - 1) / 4) * 100;

const ImportanceBar = ({ importanceNow, importanceYear }) => {
  const { formatMessage } = useIntl();
  const now = Math.min(5, Math.max(1, Number(importanceNow) || 1));
  const year = Math.min(5, Math.max(1, Number(importanceYear) || 1));
  const declining = year < now;
  const equal = year === now;

  const tone = declining ? 'down' : 'up';

  let fillStyle = null;
  if (!equal) {
    const low = Math.min(now, year);
    const high = Math.max(now, year);
    const left = toTrackPercent(low);
    const width = Math.max(toTrackPercent(high) - left, 6);
    fillStyle = { left: `${left}%`, width: `${width}%` };
  }

  const tip = formatMessage(
    { id: `position.importanceTip.${equal ? 'same' : tone}` },
    {
      now: formatMessage({ id: `position.importanceLevel.${now}` }),
      future: formatMessage({ id: `position.importanceLevel.${year}` }),
      desc: formatMessage({ id: `position.importanceLevelDesc.${year}` })
    }
  );

  return (
    <Tooltip title={tip}>
      <div className={style.importance}>
        <div className={style['importance-track']}>
          {fillStyle ? <div className={classnames(style['importance-fill'], style[`importance-fill-${tone}`])} style={fillStyle} /> : null}
          <span className={classnames(style['importance-dot'], style[`importance-dot-${tone}`])} style={{ left: `${toTrackPercent(now)}%` }} />
          {!equal ? <span className={classnames(style['importance-dot'], style[`importance-dot-${tone}`])} style={{ left: `${toTrackPercent(year)}%` }} /> : null}
        </div>
        <span className={classnames(style['importance-label'], style[`importance-label-${tone}`])}>
          {now}→{year}
        </span>
      </div>
    </Tooltip>
  );
};

export default ImportanceBar;
