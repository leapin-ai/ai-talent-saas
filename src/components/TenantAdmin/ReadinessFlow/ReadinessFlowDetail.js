import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Badge, Button, Flex, Progress, Skeleton, Space, Tag, Tooltip, Typography, message } from 'antd';
import { ArrowLeftOutlined, CheckCircleFilled, CloseCircleFilled, ExclamationCircleFilled, InfoCircleFilled, ReloadOutlined, SyncOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { createWithRemoteLoader } from '@kne/remote-loader';
import { useIntl } from '@kne/react-intl';
import withLocale from '../withLocale';
import StageDataView from './StageDataView';
import { StageResultLoader } from './StageResult';
import { ManagerInviteOverview, MilestoneFlow, PersonFlowPanel, PersonOverview, StageActions } from './StageFlow';
import useSendReadiness from './useSendReadiness';
import useConfirmReadiness from './useConfirmReadiness';
import ProjectPreviewView from './ProjectPreviewView';
import EditQuestionnaireFormInner from './EditQuestionnaireFormInner';
import EnterAnswersForm, { DEFAULT_ANSWERS_JSON, loadAnswersDefaultJson, normalizeAnswersPayload } from './EnterAnswersForm';
import { buildMilestones, buildStageRows, progressOf } from './stageModel';
import { LANGUAGE_LABEL, STATUS_COLOR, notifyError, useReadinessCall } from './common';
import classnames from 'classnames';
import Section from './Section';
import style from './style.module.scss';

const POLL_INTERVAL = 5000;

const NOTICE_ICON = { success: CheckCircleFilled, error: CloseCircleFilled, warning: ExclamationCircleFilled, info: InfoCircleFilled };

/**
 * 概要区（岗位、关键指标、下一步）与流程区（里程碑 + 选中里程碑的阶段）。
 * 流程区里点某个里程碑，下方展示该里程碑包含的阶段。
 */
const RoleFlowParts = ({ tools, t, run, persons, personFlows, doneCount, stageRows, roleActive, banner, managerInvites = [], personInvites = [], inviteActions }) => {
  const { milestones, activeKey } = buildMilestones({ t, scope: 'role', stageRows });
  const percent = run.stage === 'done' ? 100 : progressOf(stageRows);
  const meta = [
    LANGUAGE_LABEL[run.language] || run.language,
    t(run.hasStaffQuestionnaire ? 'withStaffQuestionnaire' : 'withoutStaffQuestionnaire'),
    run.createdAt ? t('createdOn', { time: dayjs(run.createdAt).format('YYYY-MM-DD HH:mm') }) : null
  ].filter(Boolean);
  const NoticeIcon = NOTICE_ICON[banner?.type];
  const pendingCount = persons.length - doneCount;
  // 已发出过经理问卷（至少一条非 pending）才在阶段结果上方展示邀请卡片
  const managerSent = managerInvites.some(item => ['sent', 'answered', 'failed'].includes(item.status));

  return (
    <>
      <Section>
        <div className={style.header}>
          <div className={style.headline}>
            <Flex gap={10} align="center" wrap="wrap">
              <Typography.Title level={4} className={style.title}>
                {run.roleName}
              </Typography.Title>
              <Tag bordered={false} color={STATUS_COLOR[run.status]}>
                {t(`status.${run.status}`)}
              </Tag>
            </Flex>
            <div className={style.meta}>{meta.join(' · ')}</div>
          </div>
          {tools}
        </div>
        <div className={style.summaryBar}>
          <div className={style.summaryItem}>
            <span className={style.summaryLabel}>{t('overallProgress')}</span>
            <Progress className={style.summaryProgress} percent={percent} showInfo={false} size="small" status={run.status === 'done' ? 'success' : 'normal'} />
            <span className={style.summaryValue}>{percent}%</span>
          </div>
          <div className={style.summaryItem}>
            <span className={style.summaryLabel}>{t('currentStage')}</span>
            <span className={style.summaryValue}>{run.stage === 'done' ? t('stage.done') : roleActive?.label || t(`stage.${run.stage}`)}</span>
            {roleActive ? <Badge status={roleActive.status.type} text={<span className={style.summaryHint}>{roleActive.status.text}</span>} /> : null}
          </div>
          {run.hasStaffQuestionnaire ? (
            <div className={style.summaryItem}>
              <span className={style.summaryLabel}>{t('participantsDone')}</span>
              <span className={style.summaryValue}>
                {doneCount}
                <span className={style.summaryTotal}> / {persons.length}</span>
              </span>
              {pendingCount > 0 ? <span className={style.summaryHint}>{t('personsPending', { count: pendingCount })}</span> : null}
            </div>
          ) : null}
          {banner?.action?.length ? (
            <div className={style.summaryActions}>
              <StageActions primary={banner.action} />
            </div>
          ) : null}
        </div>
        {banner && (banner.type === 'error' || banner.description) ? (
          <div className={classnames(style.notice, style[`notice-${banner.type}`])}>
            {NoticeIcon ? <NoticeIcon className={style.noticeIcon} /> : null}
            <div className={style.noticeText}>
              <span className={style.noticeMessage}>{banner.message}</span>
              {banner.description ? <span className={style.noticeDescription}>{banner.description}</span> : null}
            </div>
          </div>
        ) : null}
      </Section>
      <Section>
        <MilestoneFlow
          t={t}
          title={t('roleFlow')}
          milestones={milestones}
          activeKey={activeKey}
          renderBeforeResult={selected => (selected.key === 'group:manager' && managerSent ? <ManagerInviteOverview t={t} invites={managerInvites} inviteActions={inviteActions} /> : null)}
          renderExtra={selected => (selected.key === 'await_persons' && persons.length ? <PersonOverview t={t} persons={persons} personFlows={personFlows} invites={personInvites} inviteActions={inviteActions} /> : null)}
        />
      </Section>
    </>
  );
};

/** 详情骨架：对齐概要区 + 流程区大致结构，避免首屏只转圈 */
const DetailSkeleton = () => (
  <div className={style.page}>
    <Section>
      <div className={style.header}>
        <div className={style.headline}>
          <Skeleton active title={{ width: 220 }} paragraph={false} />
          <Skeleton active title={false} paragraph={{ rows: 1, width: ['60%'] }} style={{ marginTop: 8 }} />
        </div>
        <Skeleton.Button active size="default" style={{ width: 88 }} />
      </div>
      <div className={style.summaryBar}>
        <Skeleton active title={false} paragraph={{ rows: 2, width: ['100%', '80%'] }} />
      </div>
    </Section>
    <Section>
      <Skeleton active title={{ width: 120 }} paragraph={{ rows: 6 }} />
    </Section>
  </div>
);

/** 平台 Admin →「就绪度流程」tab 的详情：传 adminTenantId + runId，用 onBack 返回列表（仅超级管理员可进入，操作不再单独做权限码） */
const ReadinessFlowDetail = createWithRemoteLoader({
  modules: ['components-core:Global@usePreset', 'components-core:TablePage@Table', 'components-core:FormInfo@useFormModal', 'components-core:Modal@useModal', 'components-core:Modal@useConfirmModal']
})(
  withLocale(({ remoteModules, adminTenantId, runId: id, onBack }) => {
    const [usePreset, Table, useFormModal, useModal, useConfirmModal] = remoteModules;
    const { apis, ajax } = usePreset();
    const { formatMessage } = useIntl();
    const call = useReadinessCall(ajax, { tenantId: adminTenantId });
    const api = apis.talentSaas.tenantAdmin.readiness;
    const loadResult = useCallback(id => call(api.stageDetail, { id }), [call, api.stageDetail]);
    const formModal = useFormModal();
    const modal = useModal();
    const confirmModal = useConfirmModal();
    const [detail, setDetail] = useState(null);
    const [busy, setBusy] = useState(false);
    const t = useCallback((key, values) => formatMessage({ id: `tenantAdmin.readiness.${key}`, defaultMessage: key }, values), [formatMessage]);
    const idRef = useRef(id);
    idRef.current = id;

    const load = useCallback(
      async silent => {
        try {
          setDetail(await call(api.detail, { id: idRef.current }));
        } catch (e) {
          if (!silent) {
            notifyError(e);
            // URL 上的 runId 已不存在（或无权）时回列表，避免刷新后一直停在骨架屏
            const msg = String(e?.message || '');
            if (onBack && /不存在|not\s*found|404/i.test(msg)) {
              onBack();
            }
          }
        }
      },
      [api.detail, call, onBack]
    );

    useEffect(() => {
      load();
    }, [load, id]);

    const polling = detail?.run?.status === 'running';
    useEffect(() => {
      if (!polling) {
        return undefined;
      }
      const timer = setInterval(() => load(true), POLL_INTERVAL);
      return () => clearInterval(timer);
    }, [polling, load]);

    const act = useCallback(
      async (apiItem, data, successKey) => {
        setBusy(true);
        try {
          const result = await call(apiItem, Object.assign({ runId: String(idRef.current) }, data));
          if (successKey) {
            message.success(t(successKey));
          }
          await load(true);
          return result;
        } catch (e) {
          notifyError(e);
          return null;
        } finally {
          setBusy(false);
        }
      },
      [call, load, t]
    );

    const openSend = useSendReadiness({ useFormModal, useModal, call, api, onDone: () => load(true) });
    const openConfirm = useConfirmReadiness({ useFormModal, call, api, onDone: () => load(true) });

    /** 删除邀请：只删邀请记录（staff / reassess 连带参与人）；对应阶段已过的不能删 */
    const deleteInvite = item => {
      if (!item.deletable) {
        message.warning(t('deleteInvitesBlocked'));
        return;
      }
      return confirmModal({
        title: t('deleteInvites'),
        message: t('deleteInvitesConfirm', { count: 1 }),
        danger: true,
        onConfirm: async () => {
          const result = await act(api.deleteInvite, { inviteIds: [String(item.id)] }, 'deleteInvitesSuccess');
          if (result?.skipped?.length) {
            message.warning(t('deleteInvitesSkipped', { names: result.skipped.map(row => row.name || row.inviteId).join('、') }));
          }
        }
      });
    };

    const actions = useMemo(
      () => ({
        openData: (title, versions) =>
          modal({
            title,
            size: 'large',
            footer: null,
            children: <StageDataView versions={[...versions].sort((a, b) => b.version - a.version)} call={call} api={api} />
          }),
        openPreview: ({ kind, personId, title }) =>
          modal({
            title: `${t('previewProject')} · ${title}`,
            size: 'large',
            noPadding: true,
            footer: null,
            children: <ProjectPreviewView call={call} api={api} params={{ runId: String(idRef.current), kind, personId }} />
          }),
        confirm: ({ kind, personId }) => openConfirm({ runId: String(idRef.current), kind, personId, language: detail?.language }),
        editQuestionnaire: async ({ kind, personId }) => {
          const runId = String(idRef.current);
          let payload;
          try {
            payload = await call(api.questionnaireEdit, { runId, kind, personId });
          } catch (e) {
            notifyError(e);
            return;
          }
          const formApi = formModal({
            title: t('editQuestionnaire'),
            size: 'large',
            saveText: t('saveQuestionnaire'),
            formProps: {
              data: { schema: payload?.schema || { blocks: [] } },
              onSubmit: async formData => {
                if (!payload?.editable) {
                  message.warning(t('editQuestionnaireNotEditable'));
                  return false;
                }
                if (!formData?.schema?.blocks?.length) {
                  message.error(t('editQuestionnaireEmpty'));
                  return false;
                }
                try {
                  await call(api.questionnaireUpdate, { runId, kind, personId, schema: formData.schema });
                  message.success(t('editQuestionnaireSuccess'));
                  formApi.close();
                  load(true);
                } catch (e) {
                  notifyError(e);
                  return false;
                }
              }
            },
            children: <EditQuestionnaireFormInner rejected={!!payload?.rejected} rejectComment={payload?.rejectComment || ''} rejectedByEmail={payload?.rejectedByEmail || ''} editable={!!payload?.editable} />
          });
        },
        fetchResult: async () => {
          const result = await act(api.syncAnswers, {});
          if (!result) {
            return;
          }
          if (result.saved) {
            message.success(t('fetchResultSaved', { count: result.saved, video: result.video || 0 }));
          } else if (result.video) {
            message.success(t('fetchResultVideoAttached', { video: result.video }));
          } else if (result.transcribing) {
            message.info(t('fetchResultTranscribing', { count: result.transcribing }));
          } else {
            message.info(t('fetchResultNone', { checked: result.checked || 0 }));
          }
          if (result.failed?.length) {
            message.warning(t('fetchResultSkipped', { count: result.failed.length }));
          }
        },
        advanceAnswers: data => act(api.advanceAnswers, data, 'advanceSuccess'),
        reanswer: ({ kind, personId }) =>
          confirmModal({
            title: t('reanswer'),
            message: t('reanswerConfirm'),
            danger: true,
            onConfirm: () => act(api.reanswer, { kind, personId }, 'reanswerSuccess')
          }),
        skipReassessConfirm: ({ personId }) =>
          confirmModal({
            title: t('skipToAssessUpdate'),
            message: t('skipToAssessUpdateConfirm'),
            onConfirm: () => act(api.skipReassessConfirm, { personId }, 'skipToAssessUpdateSuccess')
          }),
        openSend: kind => openSend([detail.run], kind),
        openAnswers: async ({ kind, personId }) => {
          const answersJson = await loadAnswersDefaultJson({
            call,
            api,
            runId: String(idRef.current),
            kind,
            personId,
            stageData: detail?.stageData
          });
          const formApi = formModal({
            title: t('enterAnswers'),
            size: 'default',
            formProps: {
              data: { answers: answersJson || DEFAULT_ANSWERS_JSON },
              onSubmit: async formData => {
                const payload = normalizeAnswersPayload(formData.answers);
                if (!payload) {
                  message.error(t('answersJsonInvalid'));
                  return false;
                }
                const result = await act(api.submitAnswers, { kind, personId, ...payload }, 'answersSuccess');
                if (!result) {
                  return false;
                }
                formApi.close();
              }
            },
            children: <EnterAnswersForm />
          });
        },
        trigger: () => act(api.triggerReport, {}, 'triggerSuccess'),
        retry: ({ scope, personId, stage }) => act(api.retry, { scope, personId, stage }, 'retrySuccess'),
        rollback: ({ scope, personId, stage, confirmText }) =>
          confirmModal({
            title: t('rollbackHere'),
            message: confirmText,
            danger: true,
            onConfirm: () => act(api.rollback, { scope, personId, stage }, 'rollbackSuccess')
          })
      }),
      [act, api, call, confirmModal, detail, formModal, load, modal, openConfirm, openSend, t]
    );

    // 加载中只用骨架屏，不放「返回列表」（避免空壳页上单独一个返回按钮）
    if (!detail) {
      return <DetailSkeleton />;
    }
    const { run, persons, stageData, invites, confirmMails = [], flow, allPersonsDone } = detail;
    const canTrigger = !persons.length || allPersonsDone;
    const stageProps = { t, run, rows: stageData, invites, canTrigger, actions };
    const currentInvites = invites.filter(item => item.isCurrent);
    const doneCount = persons.filter(item => item.stage === 'done').length;

    // 「下一步」横幅：岗位流程的当前阶段 + 需要人处理的参与人
    const activeOf = rows => rows.find(item => item.state === 'failed') || rows.find(item => item.state === 'running') || rows.find(item => item.state === 'current');
    const roleRows = buildStageRows({ ...stageProps, scope: 'role', stages: flow.roleStages, currentStage: run.stage });
    const roleActive = activeOf(roleRows);
    const personFlows = new Map(
      persons.map(person => {
        const rows = buildStageRows({ ...stageProps, scope: 'person', stages: flow.personStages, currentStage: person.stage, person });
        return [String(person.id), { active: activeOf(rows), ...buildMilestones({ t, scope: 'person', stageRows: rows }) }];
      })
    );
    const personActive = new Map([...personFlows].map(([key, value]) => [key, value.active]));
    const personTodos = persons.filter(person => personActive.get(String(person.id))?.primary.length);
    const answersActive = run.stage === 'manager_answers' || persons.some(person => ['answers', 'reassess_answers'].includes(person.stage));

    const flowCanceled = run.status === 'canceled';
    const banner = (() => {
      if (flowCanceled) {
        return { type: 'info', message: t('flowCanceled') };
      }
      const personsLine = personTodos.length
        ? t('personsTodo', {
            count: personTodos.length,
            names: personTodos
              .slice(0, 3)
              .map(person => `${person.name}（${personActive.get(String(person.id)).label}）`)
              .join('、')
              .concat(personTodos.length > 3 ? ' …' : '')
          })
        : '';
      if (run.stage === 'done') {
        return { type: 'success', message: t('flowDone') };
      }
      if (!roleActive) {
        return null;
      }
      if (roleActive.state === 'failed') {
        return { type: 'error', message: t('flowFailed', { stage: roleActive.label }), action: roleActive.primary };
      }
      if (roleActive.state === 'running') {
        return { type: 'info', message: t('flowRunning', { stage: roleActive.label }), description: personsLine };
      }
      const lines = [];
      if (run.stage === 'await_persons') {
        lines.push(t('personsProgress', { done: doneCount, total: persons.length }));
        if (!canTrigger) {
          lines.push(t('triggerHint'));
        }
      }
      if (personsLine) {
        lines.push(personsLine);
      }
      return { type: roleActive.primary.length || personTodos.length ? 'warning' : 'info', message: t('nextStep', { stage: roleActive.label }), description: lines.join(' '), action: roleActive.primary };
    })();

    return (
      <StageResultLoader.Provider value={loadResult}>
        <div className={style.page}>
          {onBack ? (
            <Flex>
              <Button type="text" className={style.back} icon={<ArrowLeftOutlined />} onClick={onBack}>
                {t('backToList')}
              </Button>
            </Flex>
          ) : null}
          <RoleFlowParts
            tools={
              <Space size={8}>
                {!flowCanceled && answersActive ? (
                  <Button icon={<SyncOutlined />} loading={busy} onClick={() => act(api.syncAnswers, {}, 'syncSuccess')}>
                    {t('syncAnswers')}
                  </Button>
                ) : null}
                {flowCanceled || run.stage === 'done' || run.status === 'done' ? null : (
                  <>
                    <Button icon={<ReloadOutlined />} onClick={() => load(true)}>
                      {t('refresh')}
                    </Button>
                    <Button
                      danger
                      loading={busy}
                      onClick={() =>
                        confirmModal({
                          title: t('cancelFlow'),
                          message: t('cancelFlowConfirm', { name: run.roleName || '' }),
                          danger: true,
                          onConfirm: async () => {
                            setBusy(true);
                            try {
                              await call(api.cancel, { id: String(idRef.current) });
                              message.success(t('cancelFlowSuccess'));
                              await load(true);
                            } catch (e) {
                              notifyError(e);
                            } finally {
                              setBusy(false);
                            }
                          }
                        })
                      }
                    >
                      {t('cancelFlow')}
                    </Button>
                  </>
                )}
              </Space>
            }
            roleActive={roleActive}
            t={t}
            run={run}
            persons={persons}
            personFlows={personFlows}
            doneCount={doneCount}
            stageRows={roleRows}
            banner={banner}
            managerInvites={currentInvites.filter(item => item.kind === 'manager')}
            personInvites={currentInvites.filter(item => item.kind === 'staff' || item.kind === 'reassess')}
            inviteActions={
              flowCanceled
                ? {
                    copyLink: item => {
                      navigator.clipboard?.writeText(item.url);
                      message.success(t('copied'));
                    }
                  }
                : {
                    copyLink: item => {
                      navigator.clipboard?.writeText(item.url);
                      message.success(t('copied'));
                    },
                    resend: item => act(api.resendInvite, { inviteIds: [String(item.id)] }, 'resendSuccess')
                  }
            }
          />
          {run.hasStaffQuestionnaire ? (
            <Section>
              <PersonFlowPanel
                t={t}
                title={`${t('participants')} (${persons.length})`}
                extra={
                  <Button size="small" icon={<ReloadOutlined />} onClick={() => load(true)}>
                    {t('refresh')}
                  </Button>
                }
                persons={persons}
                personFlows={personFlows}
                invites={currentInvites.filter(item => item.kind === 'staff' || item.kind === 'reassess')}
                inviteActions={
                  flowCanceled
                    ? {
                        copyLink: item => {
                          navigator.clipboard?.writeText(item.url);
                          message.success(t('copied'));
                        }
                      }
                    : {
                        copyLink: item => {
                          navigator.clipboard?.writeText(item.url);
                          message.success(t('copied'));
                        },
                        resend: item => act(api.resendInvite, { inviteIds: [String(item.id)] }, 'resendSuccess')
                      }
                }
              />
            </Section>
          ) : null}
          <Section flush title={`${t('invites')} (${currentInvites.length})`}>
            <Table
              rowKey="id"
              controllerOpen={false}
              dataSource={currentInvites}
              columns={[
                {
                  name: 'recipients',
                  title: t('recipients'),
                  width: 280,
                  getValueOf: item => (
                    <Flex vertical gap={2}>
                      <Typography.Text>{item.name || item.email}</Typography.Text>
                      {item.name && item.name !== item.email ? (
                        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                          {item.email}
                        </Typography.Text>
                      ) : null}
                    </Flex>
                  )
                },
                { name: 'kind', title: t('kindLabel'), width: 160, getValueOf: item => `${t(`kind.${item.kind}`)}${item.questionnaireVersion ? ` · v${item.questionnaireVersion}` : ''}` },
                {
                  name: 'status',
                  title: t('statusLabel'),
                  width: 110,
                  renderType: 'status',
                  getValueOf: item => {
                    const collecting = item.status === 'answered' && item.collectionComplete === false;
                    // 邮件发送失败可重发，用 warning，勿用 error 以免像阶段失败；只答问卷未齐访谈时不算已回答
                    return {
                      type: item.status === 'failed' ? 'warning' : collecting ? 'processing' : item.status === 'answered' ? 'success' : item.status === 'sent' ? 'processing' : 'default',
                      text: collecting ? t('inviteStatus.collecting') : t(`inviteStatus.${item.status}`)
                    };
                  }
                },
                { name: 'expiresAt', title: t('expiresAt'), width: 160, getValueOf: item => (item.expiresAt ? dayjs(item.expiresAt).format('YYYY-MM-DD HH:mm') : null) },
                {
                  name: 'options',
                  title: t('actions'),
                  width: 200,
                  fixed: 'right',
                  renderType: 'options',
                  getValueOf: item => {
                    const options = [];
                    if (item.url) {
                      options.push({
                        children: t('copyLink'),
                        onClick: () => {
                          navigator.clipboard?.writeText(item.url);
                          message.success(t('copied'));
                        }
                      });
                    }
                    if (['sent', 'failed'].includes(item.status)) {
                      options.push({ children: t('resend'), onClick: () => act(api.resendInvite, { inviteIds: [String(item.id)] }, 'resendSuccess') });
                    }
                    // 对应阶段已过的邀请不能删除（后端同样校验）
                    if (item.deletable) {
                      options.push({ children: t('deleteInvite'), danger: true, onClick: () => deleteInvite(item) });
                    }
                    return options;
                  }
                }
              ]}
            />
          </Section>
          {confirmMails.length ? (
            <Section flush title={`${t('confirmMails')} (${confirmMails.length})`}>
              <Table
                rowKey="id"
                controllerOpen={false}
                dataSource={[...confirmMails].reverse()}
                columns={[
                  {
                    name: 'kind',
                    title: t('kindLabel'),
                    width: 300,
                    getValueOf: item => {
                      const legacy = String(item.kind || '').replace('confirm:', '');
                      const targetKinds = [...new Set((item.result?.targets || []).map(target => target.kind).filter(Boolean))];
                      const kindKey = item.result?.kind || (legacy === 'batch' && targetKinds.length === 1 ? targetKinds[0] : legacy);
                      const kindLabel = kindKey === 'batch' && targetKinds.length ? targetKinds.map(kind => t(`kind.${kind}`)).join('、') : t(`kind.${kindKey}`);
                      const who = persons.find(person => String(person.id) === String(item.result?.personId || item.result?.targets?.[0]?.personId))?.name || run.roleName;
                      return `${kindLabel} · ${who}`;
                    }
                  },
                  { name: 'recipients', title: t('recipients'), ellipsis: true, getValueOf: item => (item.recipients || []).join('、') },
                  {
                    name: 'result',
                    title: t('sendResultLabel'),
                    width: 160,
                    renderType: 'status',
                    getValueOf: item => ({
                      type: item.result?.failed?.length ? 'warning' : 'success',
                      text: `${t('sentCount', { count: item.result?.sent?.length || 0 })}${item.result?.failed?.length ? ` / ${t('failedCount', { count: item.result.failed.length })}` : ''}`
                    })
                  },
                  { name: 'createdAt', title: t('sentAt'), width: 160, getValueOf: item => dayjs(item.createdAt).format('YYYY-MM-DD HH:mm') },
                  {
                    name: 'confirmed',
                    title: t('confirmStatus'),
                    width: 200,
                    render: (_value, { dataSource: item }) => {
                      if (item.confirmed) {
                        return (
                          <Tag bordered={false} color="success">
                            {`${t('confirmed')} · ${dayjs(item.confirmedAt).format('MM-DD HH:mm')}`}
                          </Tag>
                        );
                      }
                      if (item.rejected) {
                        const tip = [item.rejectedByEmail ? t('rejectCommentFrom', { email: item.rejectedByEmail }) : null, item.rejectComment || t('rejectCommentEmpty')].filter(Boolean).join('\n');
                        return (
                          <Tooltip title={<span style={{ whiteSpace: 'pre-wrap' }}>{tip}</span>}>
                            <Tag bordered={false} color="warning">
                              {t('mailRejected')}
                            </Tag>
                          </Tooltip>
                        );
                      }
                      return (
                        <Tag bordered={false} color="default">
                          {t('notConfirmed')}
                        </Tag>
                      );
                    }
                  }
                ]}
              />
            </Section>
          ) : null}
        </div>
      </StageResultLoader.Provider>
    );
  })
);

export default ReadinessFlowDetail;
