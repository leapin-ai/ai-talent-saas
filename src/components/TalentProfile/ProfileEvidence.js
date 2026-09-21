import { useEffect, useMemo, useState } from 'react';
import { Empty, Flex, Typography } from 'antd';
import { createWithRemoteLoader } from '@kne/remote-loader';
import { useIntl } from '@kne/react-intl';
import classnames from 'classnames';
import withLocale from './withLocale';
import style from './style.module.scss';
import iconFile from './assets/icon-file.svg';

const SOURCE_LABEL_KEYS = {
  cv: 'talentProfile.evidenceSourceCv',
  linkedin: 'talentProfile.evidenceSourceLinkedin',
  ai_interview: 'talentProfile.evidenceSourceInterview',
  interview: 'talentProfile.evidenceSourceInterview',
  project: 'talentProfile.evidenceSourceProject',
  profile: 'talentProfile.evidenceSourceProfile'
};

const evidenceTitle = (item, formatMessage) => item.title || item.summary || formatMessage({ id: 'talentProfile.evidenceUntitled' });

const groupBySource = (items, formatMessage) => {
  const map = new Map();
  (items || []).forEach(item => {
    const key = item.sourceType || 'profile';
    if (!map.has(key)) {
      map.set(key, []);
    }
    map.get(key).push(item);
  });
  return [...map.entries()].map(([sourceType, list]) => ({
    sourceType,
    label: formatMessage({ id: SOURCE_LABEL_KEYS[sourceType] || 'talentProfile.evidenceSourceProfile' }),
    items: list
  }));
};

const EvidenceGroups = ({ items, formatMessage, emptyText }) => {
  const groups = useMemo(() => groupBySource(items, formatMessage), [items, formatMessage]);
  if (!groups.length) {
    return <Empty description={emptyText || formatMessage({ id: 'talentProfile.evidenceEmpty' })} />;
  }
  return (
    <Flex vertical gap={12} className={style['evidence-groups']}>
      {groups.map(group => (
        <div key={group.sourceType} className={style['evidence-group']}>
          <div className={style['evidence-group-head']}>
            <img src={iconFile} alt="" />
            <span className={style['evidence-group-title']}>{group.label}</span>
            <span className={style['evidence-dot']} />
            <span className={style['evidence-group-count']}>{formatMessage({ id: 'talentProfile.evidenceItemCount' }, { count: group.items.length })}</span>
          </div>
          <ul className={style['evidence-bullets']}>
            {group.items.map((item, index) => (
              <li key={item.id || `${group.sourceType}-${index}`}>
                <Typography.Text>{item.summary || evidenceTitle(item, formatMessage)}</Typography.Text>
                {item.summary && item.title ? (
                  <Typography.Text type="secondary" className={style['evidence-ref']}>
                    {item.title}
                  </Typography.Text>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </Flex>
  );
};

const ChecklistPanel = ({ checklist, percent, formatMessage }) => (
  <div className={style['sources-checklist']}>
    <div className={style['sources-checklist-head']}>
      <Typography.Text strong>{formatMessage({ id: 'talentProfile.completion' })}</Typography.Text>
      <Typography.Text type="secondary">{formatMessage({ id: 'talentProfile.completionPercent' }, { percent: Number(percent) || 0 })}</Typography.Text>
    </div>
    <ul className={style['sources-checklist-list']}>
      {(checklist || []).map(item => (
        <li key={item.key || item.label} className={item.done ? style['sources-done'] : style['sources-todo']}>
          <span className={style['sources-check-mark']}>{item.done ? '✓' : '–'}</span>
          <span>{item.label}</span>
        </li>
      ))}
    </ul>
  </div>
);

const ProfileEvidence = createWithRemoteLoader({
  modules: ['components-core:Global@usePreset']
})(
  withLocale(({ remoteModules, employeeId, percent, checklist, variant = 'all', selectedTask }) => {
    const [usePreset] = remoteModules;
    const { ajax, apis } = usePreset();
    const { formatMessage } = useIntl();
    const [items, setItems] = useState([]);

    useEffect(() => {
      let cancelled = false;
      const load = async () => {
        const api = apis?.talentSaas?.tenant?.employee?.evidence;
        if (!api || !employeeId) {
          return;
        }
        try {
          const { data: resData } = await ajax(Object.assign({}, api, { params: { employeeId } }));
          if (!cancelled && resData?.code === 0) {
            setItems(resData.data?.pageData || []);
          }
        } catch (e) {
          if (!cancelled) {
            setItems([]);
          }
        }
      };
      load();
      return () => {
        cancelled = true;
      };
    }, [ajax, apis, employeeId]);

    if (variant === 'sources') {
      return (
        <Flex vertical gap={20}>
          <ChecklistPanel checklist={checklist} percent={percent} formatMessage={formatMessage} />
          <div>
            <Typography.Text strong className={style['sources-section-title']}>
              {formatMessage({ id: 'talentProfile.evidence' })}
            </Typography.Text>
            <EvidenceGroups items={items} formatMessage={formatMessage} />
          </div>
        </Flex>
      );
    }

    if (variant === 'task') {
      return (
        <div className={style['task-evidence-panel']}>
          {selectedTask ? (
            <div className={style['task-evidence-head']}>
              <div className={style['task-evidence-title']}>{selectedTask.title}</div>
              <div className={style['task-evidence-meta']}>
                <span>{formatMessage({ id: 'talentProfile.currentVsRequired' })}</span>
                <span className={style['task-evidence-score']}>{formatMessage({ id: 'talentProfile.scoreSlash' }, { current: selectedTask.current ?? 0, required: selectedTask.required ?? 0 })}</span>
                {selectedTask.statusLabel ? <span className={classnames(style['status-pill'], style[selectedTask.statusTone] || style['status-gap'])}>{selectedTask.statusLabel}</span> : null}
              </div>
            </div>
          ) : null}
          <div className={style['task-evidence-section-title']}>
            {formatMessage({ id: 'talentProfile.evidenceUsed' })}
            <span className={style['evidence-dot']} />
            <span className={style['evidence-group-count']}>{formatMessage({ id: 'talentProfile.evidenceItemCount' }, { count: items.length })}</span>
          </div>
          <EvidenceGroups items={items} formatMessage={formatMessage} />
          {selectedTask?.confidence ? (
            <div className={style['task-evidence-confidence']}>
              <span className={style['task-evidence-confidence-icon']} aria-hidden />
              <span>{formatMessage({ id: 'talentProfile.confidenceBasedOnSources' }, { level: selectedTask.confidenceLabel || selectedTask.confidence })}</span>
            </div>
          ) : null}
        </div>
      );
    }

    return <EvidenceGroups items={items} formatMessage={formatMessage} />;
  })
);

export default ProfileEvidence;
