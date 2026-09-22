import React from 'react';
import { useIntl } from '@kne/react-intl';
import { createWithRemoteLoader } from '@kne/remote-loader';
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

const formatSource = (source, formatMessage) => {
  const text = typeof source === 'string' ? source.trim() : '';
  if (!text) {
    return '';
  }
  if (/^source\s*[:：]/i.test(text)) {
    return text;
  }
  return `${formatMessage({ id: 'position.skillContentSource' })}: ${text}`;
};

const SkillPreview = createWithRemoteLoader({
  modules: ['components-core:Common@SimpleBar']
})(({ remoteModules, skill }) => {
  const [SimpleBar] = remoteModules;
  const { formatMessage } = useIntl();

  if (!skill) {
    return null;
  }

  const items = normalizeSkillContentItems(skill);

  const body =
    items.length === 0 ? (
      <div className={style['preview-card']}>
        <div className={style['preview-card-body']}>{formatMessage({ id: 'position.skillNoContent' })}</div>
      </div>
    ) : (
      items.map((item, index) => (
        <div key={`${item.title}-${item.source}-${index}`} className={style['preview-card']}>
          {item.title ? <div className={style['preview-card-title']}>{item.title}</div> : null}
          {item.description ? <div className={style['preview-card-body']}>{item.description}</div> : null}
          {item.source ? <div className={style['preview-card-source']}>{formatSource(item.source, formatMessage)}</div> : null}
        </div>
      ))
    );

  return (
    <div className={style.preview}>
      <div className={style['preview-header']}>
        <div className={style['preview-name']}>{skill.name}</div>
        <div className={style['preview-tags']}>
          <ChangeTag change={skill.change} />
          <LevelTag level={skill.aiExposure} prefixId="position.skillAiExposure" />
          <LevelTag level={skill.confidence} prefixId="position.skillConfidence" />
        </div>
      </div>
      <div className={style['preview-body']}>
        <SimpleBar style={{ height: '100%' }} autoHide>
          {body}
        </SimpleBar>
      </div>
    </div>
  );
});

export default SkillPreview;
