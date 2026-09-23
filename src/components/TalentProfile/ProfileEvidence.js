import { useEffect, useMemo, useState } from 'react';
import { App, Button, Empty, Flex, Typography } from 'antd';
import { MdOutlineEdit } from 'react-icons/md';
import { createWithRemoteLoader } from '@kne/remote-loader';
import { useIntl } from '@kne/react-intl';
import classnames from 'classnames';
import withLocale from './withLocale';
import { EvidenceFormInner } from './FormInner';
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
  modules: ['components-core:Global@usePreset', 'components-core:FormInfo@useFormModal']
})(
  withLocale(({ remoteModules, employeeId, percent, checklist, variant = 'all', selectedTask, readOnly }) => {
    const [usePreset, useFormModal] = remoteModules;
    const { ajax, apis } = usePreset();
    const formModal = useFormModal();
    const { message } = App.useApp();
    const { formatMessage } = useIntl();
    const [items, setItems] = useState([]);
    const [reloadKey, setReloadKey] = useState(0);

    const taskId = selectedTask?.taskId || null;
    const canEditTaskEvidence = !readOnly && employeeId && taskId && !String(employeeId).startsWith('draft-') && !!apis?.talentSaas?.tenant?.employee?.replaceTaskEvidence;

    useEffect(() => {
      let cancelled = false;
      const load = async () => {
        const api = apis?.talentSaas?.tenant?.employee?.evidence;
        if (!api || !employeeId || String(employeeId).startsWith('draft-')) {
          if (!cancelled) {
            setItems([]);
          }
          return;
        }
        try {
          const params = { employeeId };
          if (variant === 'task' && taskId) {
            params.taskId = String(taskId);
          }
          const { data: resData } = await ajax(Object.assign({}, api, { params }));
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
    }, [ajax, apis, employeeId, taskId, variant, reloadKey]);

    const openEditTaskEvidence = () => {
      if (!canEditTaskEvidence) {
        return;
      }
      const replaceApi = apis.talentSaas.tenant.employee.replaceTaskEvidence;
      formModal({
        title: formatMessage({ id: 'talentProfile.editTaskEvidence' }, { title: selectedTask?.title || '' }),
        size: 'small',
        formProps: {
          data: {
            items: (items || []).map(item => ({
              id: item.id || null,
              sourceType: item.sourceType || 'profile',
              title: item.title || '',
              summary: item.summary || ''
            }))
          },
          onSubmit: async formData => {
            const { data: resData } = await ajax(
              Object.assign({}, replaceApi, {
                data: {
                  employeeId: String(employeeId),
                  taskId: String(taskId),
                  items: formData.items || []
                }
              })
            );
            if (resData.code !== 0) {
              throw new Error(resData.msg || formatMessage({ id: 'talentProfile.editEvidenceFailed' }));
            }
            message.success(formatMessage({ id: 'talentProfile.editEvidenceSuccess' }));
            setItems(resData.data?.pageData || []);
            setReloadKey(key => key + 1);
          }
        },
        children: <EvidenceFormInner />
      });
    };

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
              <Flex justify="space-between" align="flex-start" gap={8}>
                <div>
                  <div className={style['task-evidence-title']}>{selectedTask.title}</div>
                  <div className={style['task-evidence-meta']}>
                    <span>{formatMessage({ id: 'talentProfile.currentVsRequired' })}</span>
                    <span className={style['task-evidence-score']}>{formatMessage({ id: 'talentProfile.scoreSlash' }, { current: selectedTask.current ?? 0, required: selectedTask.required ?? 0 })}</span>
                    {selectedTask.statusLabel ? <span className={classnames(style['status-pill'], style[selectedTask.statusTone] || style['status-gap'])}>{selectedTask.statusLabel}</span> : null}
                  </div>
                </div>
                {canEditTaskEvidence ? (
                  <Button type="text" className={style['edit-btn']} icon={<MdOutlineEdit />} onClick={openEditTaskEvidence}>
                    {formatMessage({ id: 'talentProfile.editEvidence' })}
                  </Button>
                ) : null}
              </Flex>
            </div>
          ) : (
            <Empty description={formatMessage({ id: 'talentProfile.selectTaskForEvidence' })} />
          )}
          {selectedTask ? (
            <>
              <div className={style['task-evidence-section-title']}>
                {formatMessage({ id: 'talentProfile.evidenceUsed' })}
                <span className={style['evidence-dot']} />
                <span className={style['evidence-group-count']}>{formatMessage({ id: 'talentProfile.evidenceItemCount' }, { count: items.length })}</span>
              </div>
              <EvidenceGroups items={items} formatMessage={formatMessage} emptyText={canEditTaskEvidence ? formatMessage({ id: 'talentProfile.evidenceEmptyHint' }) : formatMessage({ id: 'talentProfile.evidenceEmpty' })} />
              {selectedTask?.confidence ? (
                <div className={style['task-evidence-confidence']}>
                  <span className={style['task-evidence-confidence-icon']} aria-hidden />
                  <span>{formatMessage({ id: 'talentProfile.confidenceBasedOnSources' }, { level: selectedTask.confidenceLabel || selectedTask.confidence })}</span>
                </div>
              ) : null}
            </>
          ) : null}
        </div>
      );
    }

    return <EvidenceGroups items={items} formatMessage={formatMessage} />;
  })
);

export default ProfileEvidence;
