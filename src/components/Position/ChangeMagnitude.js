import React from 'react';
import { useIntl } from '@kne/react-intl';
import classnames from 'classnames';
import style from './changeMagnitude.module.scss';

const META = {
  low: { labelKey: 'position.changeMagnitude.low', level: 1 },
  medium: { labelKey: 'position.changeMagnitude.medium', level: 2 },
  high: { labelKey: 'position.changeMagnitude.high', level: 3 }
};

const ChangeMagnitude = ({ value }) => {
  const { formatMessage } = useIntl();
  const key = META[value] ? value : 'low';
  const meta = META[key];

  return (
    <span className={classnames(style.root, style[key])}>
      <span className={style.tag}>{formatMessage({ id: meta.labelKey })}</span>
      <span className={style.bars} aria-hidden="true">
        {[1, 2, 3].map(n => (
          <span key={n} className={classnames(style.bar, n <= meta.level && style['bar-on'])} />
        ))}
      </span>
    </span>
  );
};

export default ChangeMagnitude;
