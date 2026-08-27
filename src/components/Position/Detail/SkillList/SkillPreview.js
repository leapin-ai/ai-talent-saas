import React from 'react';
import { useIntl } from '@kne/react-intl';
import ChangeTag from './ChangeTag';
import { LEVEL_META } from './skillModel';
import style from './style.module.scss';

const LevelTag = ({ level, prefixId }) => {
  const { formatMessage } = useIntl();
  const meta = LEVEL_META[level] || LEVEL_META.medium;
  return (
    <span className={style['level-tag']}>
      {formatMessage({ id: prefixId })} {formatMessage({ id: meta.labelKey })}
    </span>
  );
};

const resolveSourceLabel = (source, formatMessage, messages) => {
  if (!source) {
    return '';
  }
  if (messages && Object.prototype.hasOwnProperty.call(messages, source)) {
    return formatMessage({ id: source });
  }
  return source;
};

const SkillPreview = ({ skill }) => {
  const { formatMessage, messages } = useIntl();

  if (!skill) {
    return null;
  }

  const jdSource = resolveSourceLabel(skill.jd?.source, formatMessage, messages);
  const shockSource = resolveSourceLabel(skill.shockReport?.source, formatMessage, messages);

  return (
    <div className={style.preview}>
      <div className={style['preview-header']}>
        <div className={style['preview-eyebrow']}>{formatMessage({ id: 'position.skillPreviewTitle' })}</div>
        <div className={style['preview-name']}>{skill.name}</div>
        <div className={style['preview-tags']}>
          <ChangeTag change={skill.change} />
          <LevelTag level={skill.aiExposure} prefixId="position.skillAiExposure" />
          <LevelTag level={skill.confidence} prefixId="position.skillConfidence" />
        </div>
      </div>
      <div className={style['preview-card']}>
        <div className={style['preview-card-title']}>{formatMessage({ id: 'position.skillJdTitle' })}</div>
        <div className={style['preview-card-body']}>{skill.jd?.text || formatMessage({ id: 'position.skillNoContent' })}</div>
        {jdSource ? <div className={style['preview-card-source']}>{jdSource}</div> : null}
      </div>
      <div className={style['preview-card']}>
        <div className={style['preview-card-title']}>{formatMessage({ id: 'position.skillShockTitle' })}</div>
        <div className={style['preview-card-body']}>{skill.shockReport?.text || formatMessage({ id: 'position.skillNoContent' })}</div>
        {shockSource ? <div className={style['preview-card-source']}>{shockSource}</div> : null}
      </div>
    </div>
  );
};

export default SkillPreview;
