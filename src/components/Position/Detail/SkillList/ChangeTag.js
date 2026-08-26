import React from 'react';
import { useIntl } from '@kne/react-intl';
import { CHANGE_META } from './skillModel';
import style from './style.module.scss';

const ChangeTag = ({ change }) => {
  const { formatMessage } = useIntl();
  const meta = CHANGE_META[change] || CHANGE_META.stable;
  return (
    <span className={style['change-tag']} style={{ background: meta.bg, color: meta.color }}>
      {formatMessage({ id: meta.labelKey })}
    </span>
  );
};

export default ChangeTag;
