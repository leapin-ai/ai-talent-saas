import React from 'react';
import { useIntl } from '@kne/react-intl';
import ChangeTag from './ChangeTag';
import { LEVEL_META, normalizeSkillContentItems } from './skillModel';
import style from './style.module.scss';

const LevelTag = ({ level, prefixId }) => {
  const { formatMessage } = useIntl();
  const meta = LEVEL_META[level] || LEVEL_META.medium;
  return (
    <span className={style['level-tag']} style={{ background: meta.bg, color: meta.color }}>
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

  const items = normalizeSkillContentItems(skill);

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
      {items.length === 0 ? (
        <div className={style['preview-card']}>
          <div className={style['preview-card-body']}>{formatMessage({ id: 'position.skillNoContent' })}</div>
        </div>
      ) : (
        items.map((item, index) => (
          <div key={`${item.title}-${index}`} className={style['preview-card']}>
            {item.title ? <div className={style['preview-card-title']}>{item.title}</div> : null}
            {item.description ? <div className={style['preview-card-body']}>{item.description}</div> : null}
            {item.source ? (
              <div className={style['preview-card-source']}>
                {formatMessage({ id: 'position.skillContentSource' })}：{resolveSourceLabel(item.source, formatMessage, messages)}
              </div>
            ) : null}
          </div>
        ))
      )}
    </div>
  );
};

export default SkillPreview;
