import { useEffect, useMemo, useState } from 'react';
import { App, Button, Drawer, Empty, Flex, Input, Typography } from 'antd';
import { MdOutlineEdit } from 'react-icons/md';
import { createWithRemoteLoader } from '@kne/remote-loader';
import { useIntl } from '@kne/react-intl';
import { useIsMobile } from '@kne/responsive-utils';
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
  profile: 'talentProfile.evidenceSourceProfile',
  other: 'talentProfile.evidenceSourceProfile',
  skill: 'talentProfile.evidenceSourceProfile'
};

const REPORT_REASON_OPTIONS = [
  { value: 'level_too_low', labelKey: 'talentProfile.reportReasonLevelTooLow', descKey: 'talentProfile.reportReasonLevelTooLowDesc' },
  { value: 'level_too_high', labelKey: 'talentProfile.reportReasonLevelTooHigh', descKey: 'talentProfile.reportReasonLevelTooHighDesc' },
  { value: 'evidence_incorrect', labelKey: 'talentProfile.reportReasonEvidenceIncorrect' },
  { value: 'requirement_incorrect', labelKey: 'talentProfile.reportReasonRequirementIncorrect' },
  { value: 'other', labelKey: 'talentProfile.reportReasonOther' }
];

const evidenceTitle = (item, formatMessage) => item.title || item.summary || formatMessage({ id: 'talentProfile.evidenceUntitled' });

/** 技能分析 / 草稿上的 evidence 可能是 string / string[] / { summary|text|content } */
const normalizeSkillEvidenceItems = (selectedTask, formatMessage) => {
  if (!selectedTask) {
    return [];
  }
  const raw = selectedTask.evidence;
  const pushText = (list, text, index) => {
    const summary = typeof text === 'string' ? text.trim() : '';
    if (!summary) {
      return;
    }
    list.push({
      id: `skill-evidence-${index}`,
      sourceType: 'skill',
      title: selectedTask.title || formatMessage({ id: 'talentProfile.evidenceUntitled' }),
      summary
    });
  };
  const list = [];
  if (typeof raw === 'string') {
    pushText(list, raw, 0);
  } else if (Array.isArray(raw)) {
    raw.forEach((item, index) => {
      if (typeof item === 'string') {
        pushText(list, item, index);
      } else if (item && typeof item === 'object') {
        pushText(list, item.summary || item.text || item.content || item.description || item.title || '', index);
      }
    });
  } else if (raw && typeof raw === 'object') {
    pushText(list, raw.summary || raw.text || raw.content || raw.description || '', 0);
  }
  return list;
};

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
    <Flex vertical gap={10} className={style['evidence-groups']}>
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
  withLocale(({ remoteModules, employeeId, positionId, percent, checklist, variant = 'all', selectedTask, readOnly }) => {
    const [usePreset, useFormModal] = remoteModules;
    const { ajax, apis } = usePreset();
    const formModal = useFormModal();
    const { message } = App.useApp();
    const { formatMessage } = useIntl();
    const isMobile = useIsMobile();
    const [items, setItems] = useState([]);
    const [reloadKey, setReloadKey] = useState(0);
    const [reportOpen, setReportOpen] = useState(false);
    const [reportReason, setReportReason] = useState('level_too_low');
    const [reportComment, setReportComment] = useState('');
    const [reportSubmitting, setReportSubmitting] = useState(false);

    const rawTaskId = selectedTask?.taskId;
    const taskId = rawTaskId != null && /^\d+$/.test(String(rawTaskId).trim()) ? String(rawTaskId).trim() : null;
    const canEditTaskEvidence = !readOnly && employeeId && taskId && !String(employeeId).startsWith('draft-') && !!apis?.talentSaas?.tenant?.employee?.replaceTaskEvidence;
    const canReportIssue = !!selectedTask && !!employeeId && !String(employeeId).startsWith('draft-');

    useEffect(() => {
      let cancelled = false;
      const load = async () => {
        const skillItems = normalizeSkillEvidenceItems(selectedTask, formatMessage);

        if (variant === 'task' && !taskId) {
          if (!cancelled) {
            setItems(skillItems);
          }
          return;
        }

        const api = apis?.talentSaas?.tenant?.employee?.evidence;
        if (!api || !employeeId || String(employeeId).startsWith('draft-')) {
          if (!cancelled) {
            setItems(skillItems);
          }
          return;
        }
        try {
          const params = { employeeId };
          if (variant === 'task' && taskId) {
            params.taskId = String(taskId);
          }
          const { data: resData } = await ajax(Object.assign({}, api, { params }));
          if (cancelled) {
            return;
          }
          if (resData?.code === 0) {
            const pageData = resData.data?.pageData || [];
            setItems(pageData.length ? pageData : skillItems);
          } else if (!cancelled) {
            setItems(skillItems);
          }
        } catch (e) {
          if (!cancelled) {
            setItems(skillItems);
          }
        }
      };
      load();
      return () => {
        cancelled = true;
      };
    }, [ajax, apis, employeeId, formatMessage, selectedTask, taskId, variant, reloadKey]);

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

    const openReportIssue = () => {
      if (!selectedTask) {
        return;
      }
      setReportReason('level_too_low');
      setReportComment('');
      setReportOpen(true);
    };

    const submitReportIssue = async () => {
      if (!reportReason) {
        message.warning(formatMessage({ id: 'talentProfile.reportIssueReasonRequired' }));
        return;
      }
      if (!canReportIssue) {
        message.warning(formatMessage({ id: 'talentProfile.reportIssueDraftBlocked' }));
        return;
      }
      const api = apis?.talentSaas?.tenant?.employee?.reportReadinessIssue;
      if (!api) {
        message.error(formatMessage({ id: 'talentProfile.reportIssueFailed' }));
        return;
      }
      setReportSubmitting(true);
      try {
        const { data: resData } = await ajax(
          Object.assign({}, api, {
            data: {
              employeeId: String(employeeId),
              positionId: positionId != null ? String(positionId) : undefined,
              taskId: taskId || undefined,
              taskTitle: selectedTask?.title || '',
              activityGroup: selectedTask?.activityGroup || '',
              current: selectedTask?.current,
              required: selectedTask?.required,
              readinessStatus: selectedTask?.status || selectedTask?.readinessStatus,
              confidence: selectedTask?.confidence,
              reason: reportReason,
              comment: reportComment
            }
          })
        );
        if (resData.code !== 0) {
          throw new Error(resData.msg || formatMessage({ id: 'talentProfile.reportIssueFailed' }));
        }
        message.success(formatMessage({ id: 'talentProfile.reportIssueSuccess' }));
        setReportOpen(false);
      } catch (e) {
        message.error(e.message || formatMessage({ id: 'talentProfile.reportIssueFailed' }));
      } finally {
        setReportSubmitting(false);
      }
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
              <div className={style['task-evidence-used']}>
                <div className={style['task-evidence-section-title']}>
                  {formatMessage({ id: 'talentProfile.evidenceUsed' })}
                  <span className={style['evidence-dot']} />
                  <span className={style['evidence-group-count']}>{formatMessage({ id: 'talentProfile.evidenceItemCount' }, { count: items.length })}</span>
                </div>
                <EvidenceGroups items={items} formatMessage={formatMessage} emptyText={canEditTaskEvidence ? formatMessage({ id: 'talentProfile.evidenceEmptyHint' }) : formatMessage({ id: 'talentProfile.evidenceEmpty' })} />
              </div>
              <div className={style['task-evidence-footer']}>
                {selectedTask?.confidence ? (
                  <div className={style['task-evidence-confidence']}>
                    <span className={style['task-evidence-confidence-icon']} aria-hidden />
                    <span className={style['task-evidence-confidence-text']}>
                      <span className={style['task-evidence-confidence-title']}>{formatMessage({ id: 'talentProfile.confidenceBasedOnSources' }, { level: selectedTask.confidenceLabel || selectedTask.confidence })}</span>
                    </span>
                  </div>
                ) : null}
                <div className={style['evidence-actions']}>
                  <Button className={style['look-right-btn']} block onClick={openReportIssue}>
                    {formatMessage({ id: 'talentProfile.looksWrong' })}
                  </Button>
                </div>
              </div>
            </>
          ) : null}

          <Drawer
            title={formatMessage({ id: 'talentProfile.reportIssueTitle' })}
            open={reportOpen}
            onClose={() => setReportOpen(false)}
            width={isMobile ? '100%' : 500}
            destroyOnClose
            footer={
              <Flex justify="end" gap={12} className={style['report-issue-footer']}>
                <Button className={style['look-right-btn']} onClick={() => setReportOpen(false)}>
                  {formatMessage({ id: 'talentProfile.reportIssueCancel' })}
                </Button>
                <Button type="primary" className={style['report-issue-submit']} loading={reportSubmitting} onClick={submitReportIssue}>
                  {formatMessage({ id: 'talentProfile.reportIssueSubmit' })}
                </Button>
              </Flex>
            }
            classNames={{ body: style['report-issue-drawer-body'], footer: style['report-issue-drawer-footer'] }}
          >
            <div className={style['report-issue-body']}>
              <div className={style['report-issue-section']}>
                <div className={style['report-issue-section-title']}>{formatMessage({ id: 'talentProfile.reportIssueWhatWrong' })}</div>
                <Flex vertical gap={8} className={style['report-issue-options']}>
                  {REPORT_REASON_OPTIONS.map(option => {
                    const selected = reportReason === option.value;
                    return (
                      <button key={option.value} type="button" className={classnames(style['report-issue-option'], selected && style['report-issue-option-selected'])} onClick={() => setReportReason(option.value)}>
                        <span className={classnames(style['report-issue-radio'], selected && style['report-issue-radio-checked'])} />
                        <span className={style['report-issue-option-text']}>
                          <span className={style['report-issue-option-label']}>{formatMessage({ id: option.labelKey })}</span>
                          {option.descKey ? <span className={style['report-issue-option-desc']}>{formatMessage({ id: option.descKey })}</span> : null}
                        </span>
                      </button>
                    );
                  })}
                </Flex>
              </div>
              <div className={style['report-issue-section']}>
                <div className={style['report-issue-section-title']}>{formatMessage({ id: 'talentProfile.reportIssueTellMore' })}</div>
                <div className={style['report-issue-textarea-wrap']}>
                  <Input.TextArea
                    value={reportComment}
                    onChange={e => setReportComment(String(e.target.value || '').slice(0, 1000))}
                    placeholder={formatMessage({ id: 'talentProfile.reportIssuePlaceholder' })}
                    autoSize={{ minRows: 3, maxRows: 6 }}
                    maxLength={1000}
                    variant="borderless"
                  />
                  <div className={style['report-issue-count']}>{reportComment.length}/1000</div>
                </div>
              </div>
            </div>
          </Drawer>
        </div>
      );
    }

    return <EvidenceGroups items={items} formatMessage={formatMessage} />;
  })
);

export default ProfileEvidence;
