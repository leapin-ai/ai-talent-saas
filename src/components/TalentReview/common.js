import classnames from 'classnames';
import { Fragment } from 'react';
import { CheckOutlined } from '@ant-design/icons';
import { useIntl } from '@kne/react-intl';
import style from './style.module.scss';

const STATUS_LABEL = {
  draft: 'statusDraft',
  notStarted: 'statusNotStarted',
  inProgress: 'statusInProgress',
  completed: 'statusCompleted'
};

export const StatusTag = ({ status, tone, children }) => {
  const { formatMessage } = useIntl();
  return <span className={classnames(style['status-tag'], style[`is-${tone || status}`])}>{children || (STATUS_LABEL[status] ? formatMessage({ id: STATUS_LABEL[status] }) : status)}</span>;
};

export const StepBar = ({ items, current }) => (
  <div className={style['steps']}>
    {items.map((label, index) => (
      <Fragment key={label}>
        {index > 0 ? (
          <span className={style['step-dots']}>
            <span />
            <span />
            <span />
            <span />
          </span>
        ) : null}
        <div className={classnames(style['step'], { [style['is-active']]: index === current, [style['is-done']]: index < current })}>
          <span className={style['step-index']}>{index < current ? <CheckOutlined /> : index + 1}</span>
          <span>{label}</span>
        </div>
      </Fragment>
    ))}
  </div>
);

const svgProps = { width: 24, height: 24, viewBox: '0 0 24 24', fill: 'none', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' };

/** Figma 统计卡片图标 */
export const StatIcons = {
  total: (
    <svg {...svgProps} stroke="#2B7FFF">
      <path d="M19 11C19 15.4183 15.4183 19 11 19C6.58172 19 3 15.4183 3 11C3 6.58172 6.58172 3 11 3C15.4183 3 19 6.58172 19 11Z" />
      <path d="M21.0031 20.9992L16.7031 16.6992" />
    </svg>
  ),
  inProgress: (
    <svg {...svgProps} stroke="#FF6900">
      <path d="M22 7L13.5 15.5L8.5 10.5L2 17" />
      <path d="M16 7H22V13" />
    </svg>
  ),
  completed: (
    <svg {...svgProps} stroke="#00C950">
      <path d="M8 2V6" />
      <path d="M16 2V6" />
      <path d="M5 4H19C20.1046 4 21 4.89543 21 6V20C21 21.1046 20.1046 22 19 22H5C3.89543 22 3 21.1046 3 20V6C3 4.89543 3.89543 4 5 4Z" />
      <path d="M3 10H21" />
    </svg>
  ),
  participants: (
    <svg {...svgProps} stroke="#AD46FF">
      <path d="M16 21V19C16 17.9391 15.5786 16.9217 14.8284 16.1716C14.0783 15.4214 13.0609 15 12 15H6C4.93913 15 3.92172 15.4214 3.17157 16.1716C2.42143 16.9217 2 17.9391 2 19V21" />
      <path d="M13 7C13 9.20914 11.2091 11 9 11C6.79086 11 5 9.20914 5 7C5 4.79086 6.79086 3 9 3C11.2091 3 13 4.79086 13 7Z" />
      <path d="M22 20.9989V18.9989C21.9993 18.1126 21.7044 17.2517 21.1614 16.5512C20.6184 15.8508 19.8581 15.3505 19 15.1289" />
      <path d="M16 3.12891C16.8604 3.34921 17.623 3.84961 18.1676 4.55122C18.7122 5.25283 19.0078 6.11574 19.0078 7.00391C19.0078 7.89208 18.7122 8.75499 18.1676 9.4566C17.623 10.1582 16.8604 10.6586 16 10.8789" />
    </svg>
  )
};

export const StatCard = ({ label, value, desc, icon, iconBg }) => (
  <div className={style['stat-card']}>
    <div className={style['stat-card-main']}>
      <div>
        <div className={style['stat-card-label']}>{label}</div>
        <div className={style['stat-card-value']}>{value}</div>
      </div>
      <div className={style['stat-card-icon']} style={{ background: iconBg }}>
        {icon}
      </div>
    </div>
    {desc ? <div className={style['stat-card-desc']}>{desc}</div> : null}
  </div>
);

export const SectionCard = ({ icon, title, extra, children, className }) => (
  <div className={classnames(style['card'], className)}>
    {title ? (
      <div className={style['card-title']} style={{ justifyContent: 'space-between' }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          {icon ? <span className={style['card-title-icon']}>{icon}</span> : null}
          {title}
        </span>
        {extra}
      </div>
    ) : null}
    {children}
  </div>
);
