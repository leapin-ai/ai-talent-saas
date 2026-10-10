import React from 'react';
import { Tag, Typography } from 'antd';
import classnames from 'classnames';
import style from './style.module.scss';

const EllipsisTag = ({ children, className, ...props }) => (
  <Tag {...props} className={classnames(style['ellipsis-tag'], className)}>
    <Typography.Text className={style['ellipsis-tag-text']} ellipsis={{ tooltip: children }}>
      {children}
    </Typography.Text>
  </Tag>
);

export default EllipsisTag;
