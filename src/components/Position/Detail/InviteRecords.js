import { useCallback, useMemo, useState } from 'react';
import { App, Button, Flex, Input, Space, Typography } from 'antd';
import { createWithRemoteLoader } from '@kne/remote-loader';
import { useIntl } from '@kne/react-intl';
import { useParams } from 'react-router-dom';
import { applyAiInterviewRemote } from '../../../preset';
import { TENANT_ADMIN_PERMISSIONS } from '@components/TenantAdmin/constants';
import withLocale from '../withLocale';
import InviteAssessmentResultModal from './InviteAssessmentResultModal';

const STATUS_LABEL_IDS = {
  invited: 'position.talentInviteStatusInvited',
  opened: 'position.talentInviteStatusOpened',
  filling: 'position.talentInviteStatusFilling',
  interviewing: 'position.talentInviteStatusInterviewing',
  done: 'position.talentInviteStatusDone',
  ended: 'position.talentInviteStatusEnded',
  canceled: 'position.talentInviteStatusCanceled'
};

const TYPE_LABEL_IDS = {
  employee: 'position.talentInviteEmployee',
  manager: 'position.talentInviteManager'
};

const copyText = async text => {
  if (navigator?.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.left = '-9999px';
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand('copy');
  document.body.removeChild(textarea);
};

const InviteRecords = createWithRemoteLoader({
  modules: ['components-core:Global@usePreset', 'components-core:TablePage', 'components-core:Filter', 'components-core:Permissions@usePermissionsPass']
})(
  withLocale(({ remoteModules, children }) => {
    const [usePreset, TablePage, Filter, usePermissionsPass] = remoteModules;
    const { apis, ajax } = usePreset();
    const { formatMessage, locale } = useIntl();
    const { message, modal } = App.useApp();
    const { id: positionId } = useParams();
    const { InputFilterItem, SuperSelectFilterItem } = Filter.fields;
    const canManageInvite = usePermissionsPass({ request: TENANT_ADMIN_PERMISSIONS.positionInviteRecords });
    const canStartAnalysis = usePermissionsPass({ request: TENANT_ADMIN_PERMISSIONS.positionAnalysis });
    const [reloadKey, setReloadKey] = useState(0);
    const [loadingId, setLoadingId] = useState(null);
    const [actionType, setActionType] = useState('');
    const [resultOpen, setResultOpen] = useState(false);
    const [resultInvite, setResultInvite] = useState(null);
    const [resultInterview, setResultInterview] = useState(null);
    const [resultRemoteKey, setResultRemoteKey] = useState('');
    const [resultApiHost, setResultApiHost] = useState('');

    const fetchInterviewResult = useCallback(
      async item => {
        if (!item?.id) {
          return;
        }
        setLoadingId(item.id);
        setActionType('result');
        try {
          const { data: resData } = await ajax(
            Object.assign({}, apis.talentSaas.tenant.talentCollectInvite.interviewResult, {
              params: { id: String(item.id) }
            })
          );
          if (resData.code !== 0) {
            // ajax errorHandler 已提示（如「面试记录不存在」），勿再 toast
            return;
          }
          const invite = resData.data?.invite || item;
          const interview = resData.data?.interview;
          if (!interview) {
            throw new Error(formatMessage({ id: 'position.talentInviteResultFailed' }));
          }
          // 与面试房间一致：先写入租户 CDN/version，再挂载 InterviewResultSession
          const cdnUrl = resData.data?.cdnUrl;
          const version = resData.data?.version;
          const apiHost = resData.data?.apiUrl || resData.data?.ajaxBaseUrl || '';
          if (!applyAiInterviewRemote({ cdnUrl, version })) {
            throw new Error(formatMessage({ id: 'position.talentInviteResultRemoteFailed' }));
          }
          if (!apiHost) {
            throw new Error(formatMessage({ id: 'position.talentInviteResultRemoteFailed' }));
          }
          setResultInvite(invite);
          setResultInterview(interview);
          setResultApiHost(apiHost);
          setResultRemoteKey(`${cdnUrl}|${version}|${apiHost}|${interview?.id || item.id}`);
          setResultOpen(true);
        } catch (e) {
          // 网络/业务码错误已由 ajax errorHandler 弹出
          if (e?.isAxiosError || e?.config || e?.response) {
            return;
          }
          message.error(e.message || formatMessage({ id: 'position.talentInviteResultFailed' }));
        } finally {
          setLoadingId(null);
          setActionType('');
        }
      },
      [ajax, apis, formatMessage, message]
    );

    const fetchInviteLink = useCallback(
      async item => {
        if (!item?.id) {
          return;
        }
        setLoadingId(item.id);
        setActionType('link');
        try {
          const { data: resData } = await ajax(
            Object.assign({}, apis.talentSaas.tenant.talentCollectInvite.link, {
              params: { id: String(item.id) }
            })
          );
          if (resData.code !== 0) {
            throw new Error(resData.msg || formatMessage({ id: 'position.talentInviteLinkFailed' }));
          }
          const inviteUrl = resData.data?.inviteUrl || '';
          if (!inviteUrl) {
            throw new Error(formatMessage({ id: 'position.talentInviteLinkFailed' }));
          }
          modal.info({
            title: formatMessage({ id: 'position.talentInviteLinkTitle' }, { name: item.name || '' }),
            width: 640,
            footer: null,
            closable: true,
            maskClosable: true,
            content: (
              <Flex vertical gap={12} style={{ marginTop: 4 }}>
                <Typography.Text type="secondary">{formatMessage({ id: 'position.talentInviteLinkHint' })}</Typography.Text>
                <Space.Compact style={{ width: '100%' }}>
                  <Input value={inviteUrl} readOnly onFocus={e => e.target.select()} />
                  <Button
                    type="primary"
                    onClick={async () => {
                      try {
                        await copyText(inviteUrl);
                        message.success(formatMessage({ id: 'position.talentInviteLinkCopied' }));
                      } catch (e) {
                        message.error(formatMessage({ id: 'position.talentInviteLinkFailed' }));
                      }
                    }}
                  >
                    {formatMessage({ id: 'position.talentInviteLinkCopy' })}
                  </Button>
                </Space.Compact>
              </Flex>
            )
          });
        } catch (e) {
          message.error(e.message || formatMessage({ id: 'position.talentInviteLinkFailed' }));
        } finally {
          setLoadingId(null);
          setActionType('');
        }
      },
      [ajax, apis, formatMessage, message, modal]
    );

    const resendInvite = useCallback(
      item => {
        if (!item?.id) {
          return;
        }
        modal.confirm({
          title: formatMessage({ id: 'position.talentInviteResendConfirm' }, { name: item.name || '' }),
          onOk: async () => {
            setLoadingId(item.id);
            setActionType('resend');
            try {
              const { data: resData } = await ajax(
                Object.assign({}, apis.talentSaas.tenant.talentCollectInvite.resend, {
                  data: {
                    id: String(item.id),
                    language: locale === 'zh-CN' ? 'zh-CN' : 'en-US'
                  }
                })
              );
              if (resData.code !== 0) {
                throw new Error(resData.msg || formatMessage({ id: 'position.talentInviteResendFailed' }));
              }
              message.success(formatMessage({ id: 'position.talentInviteResendSuccess' }));
              setReloadKey(key => key + 1);
            } catch (e) {
              message.error(e.message || formatMessage({ id: 'position.talentInviteResendFailed' }));
              throw e;
            } finally {
              setLoadingId(null);
              setActionType('');
            }
          }
        });
      },
      [ajax, apis, formatMessage, locale, message, modal]
    );

    const startInviteAnalysis = useCallback(
      (item, { reanalyze = false } = {}) => {
        if (!item?.id) {
          return;
        }
        const isManager = item.inviteType === 'manager';
        const confirmId = reanalyze
          ? isManager
            ? 'position.talentInviteReanalyzeConfirmManager'
            : 'position.talentInviteReanalyzeConfirm'
          : isManager
            ? 'position.talentInviteStartAnalysisConfirmManager'
            : 'position.talentInviteStartAnalysisConfirm';
        modal.confirm({
          title: formatMessage({ id: confirmId }, { name: item.name || '' }),
          onOk: async () => {
            setLoadingId(item.id);
            setActionType('analysis');
            try {
              const { data: resData } = await ajax(
                Object.assign({}, apis.talentSaas.tenant.talentCollectInvite.startAnalysis, {
                  data: { id: String(item.id) }
                })
              );
              if (resData.code !== 0) {
                throw new Error(resData.msg || formatMessage({ id: 'position.talentInviteStartAnalysisFailed' }));
              }
              const asrStatus = resData.data?.asrStatus;
              if (asrStatus === 'running') {
                message.success(formatMessage({ id: 'position.talentInviteStartAnalysisAsrQueued' }));
              } else {
                const analysisKind = resData.data?.analysisKind;
                message.success(
                  formatMessage({
                    id: reanalyze
                      ? analysisKind === 'position-analysis-review' || isManager
                        ? 'position.talentInviteReanalyzeSuccessManager'
                        : 'position.talentInviteReanalyzeSuccess'
                      : analysisKind === 'position-analysis-review' || isManager
                        ? 'position.talentInviteStartAnalysisSuccessManager'
                        : 'position.talentInviteStartAnalysisSuccess'
                  })
                );
              }
              setReloadKey(key => key + 1);
            } catch (e) {
              message.error(e.message || formatMessage({ id: 'position.talentInviteStartAnalysisFailed' }));
              throw e;
            } finally {
              setLoadingId(null);
              setActionType('');
            }
          }
        });
      },
      [ajax, apis, formatMessage, message, modal]
    );

    const cancelInvite = useCallback(
      item => {
        if (!item?.id) {
          return;
        }
        modal.confirm({
          title: formatMessage({ id: 'position.talentInviteCancelConfirm' }, { name: item.name || '' }),
          onOk: async () => {
            setLoadingId(item.id);
            setActionType('cancel');
            try {
              const { data: resData } = await ajax(
                Object.assign({}, apis.talentSaas.tenant.talentCollectInvite.cancel, {
                  data: { id: String(item.id) }
                })
              );
              if (resData.code !== 0) {
                throw new Error(resData.msg || formatMessage({ id: 'position.talentInviteCancelFailed' }));
              }
              message.success(formatMessage({ id: 'position.talentInviteCancelSuccess' }));
              setReloadKey(key => key + 1);
            } catch (e) {
              message.error(e.message || formatMessage({ id: 'position.talentInviteCancelFailed' }));
              throw e;
            } finally {
              setLoadingId(null);
              setActionType('');
            }
          }
        });
      },
      [ajax, apis, formatMessage, message, modal]
    );

    const columns = useMemo(
      () => [
        {
          name: 'name',
          title: formatMessage({ id: 'position.talentInviteName' }),
          renderType: 'main'
        },
        {
          name: 'inviteType',
          title: formatMessage({ id: 'position.talentInviteType' }),
          getValueOf: item => formatMessage({ id: TYPE_LABEL_IDS[item.inviteType] || 'position.talentInviteEmployee' })
        },
        {
          name: 'email',
          title: formatMessage({ id: 'position.talentInviteEmail' })
        },
        {
          name: 'phone',
          title: formatMessage({ id: 'position.talentInvitePhone' })
        },
        {
          name: 'projectName',
          title: formatMessage({ id: 'position.talentInviteProjectName' }),
          getValueOf: item => item.projectName || item.projectId || '—'
        },
        {
          name: 'status',
          title: formatMessage({ id: 'position.talentInviteStatus' }),
          getValueOf: item => {
            const base = formatMessage({ id: STATUS_LABEL_IDS[item.status] || 'position.talentInviteStatusInvited' });
            const asr = item.interviewData?.videoAsrStatus;
            if (asr === 'running' || asr === 'pending') {
              return `${base} · ${formatMessage({ id: 'position.talentInviteVideoAsrRunning' })}`;
            }
            if (asr === 'failed') {
              return `${base} · ${formatMessage({ id: 'position.talentInviteVideoAsrFailed' })}`;
            }
            if (asr === 'succeeded') {
              return `${base} · ${formatMessage({ id: 'position.talentInviteVideoAsrSucceeded' })}`;
            }
            return base;
          }
        },
        {
          name: 'deadline',
          title: formatMessage({ id: 'position.talentInviteDeadline' }),
          renderType: 'date',
          format: 'YYYY-MM-DD HH:mm'
        },
        {
          name: 'createdAt',
          title: formatMessage({ id: 'position.talentInviteCreatedAt' }),
          renderType: 'date',
          format: 'YYYY-MM-DD HH:mm'
        },
        {
          name: 'options',
          title: formatMessage({ id: 'position.talentInviteActions' }),
          fixed: 'right',
          renderType: 'options',
          getValueOf: item => {
            if (item.status === 'canceled') {
              return [];
            }
            const actions = [];
            if (canManageInvite && item.status !== 'ended') {
              actions.push({
                children: formatMessage({ id: 'position.talentInviteGetLink' }),
                loading: loadingId === item.id && actionType === 'link',
                onClick: () => fetchInviteLink(item)
              });
            }
            if (item.status === 'done' || item.status === 'ended') {
              if (canManageInvite) {
                actions.push({
                  children: formatMessage({ id: 'position.talentInviteViewResult' }),
                  loading: loadingId === item.id && actionType === 'result',
                  onClick: () => fetchInterviewResult(item)
                });
              }
              if (canStartAnalysis) {
                if (item.status === 'done') {
                  actions.push({
                    children: formatMessage({
                      id: item.inviteType === 'manager' ? 'position.talentInviteStartAnalysisManager' : 'position.talentInviteStartAnalysis'
                    }),
                    loading: loadingId === item.id && actionType === 'analysis',
                    onClick: () => startInviteAnalysis(item)
                  });
                } else {
                  actions.push({
                    children: formatMessage({
                      id: item.inviteType === 'manager' ? 'position.talentInviteReanalyzeManager' : 'position.talentInviteReanalyze'
                    }),
                    loading: loadingId === item.id && actionType === 'analysis',
                    onClick: () => startInviteAnalysis(item, { reanalyze: true })
                  });
                }
              }
            } else if (canManageInvite && item.status !== 'ended') {
              actions.push({
                children: formatMessage({ id: 'position.talentInviteResend' }),
                loading: loadingId === item.id && actionType === 'resend',
                onClick: () => resendInvite(item)
              });
            }
            if (canManageInvite && item.status !== 'ended') {
              actions.push({
                children: formatMessage({ id: 'position.talentInviteCancel' }),
                danger: true,
                loading: loadingId === item.id && actionType === 'cancel',
                onClick: () => cancelInvite(item)
              });
            }
            return actions;
          }
        }
      ],
      [actionType, canManageInvite, canStartAnalysis, cancelInvite, fetchInterviewResult, fetchInviteLink, formatMessage, loadingId, resendInvite, startInviteAnalysis]
    );

    const listApi = useMemo(() => {
      if (!positionId || !apis?.talentSaas?.tenant?.talentCollectInvite?.list) {
        return null;
      }
      return Object.assign({}, apis.talentSaas.tenant.talentCollectInvite.list, {
        params: {
          positionId: String(positionId),
          perPage: 20
        }
      });
    }, [apis, positionId]);

    const closeResultModal = useCallback(() => {
      setResultOpen(false);
      setResultInvite(null);
      setResultInterview(null);
    }, []);

    const title = formatMessage({ id: 'position.talentInviteRecordsTitle' });
    const content = !listApi ? null : (
      <>
        <TablePage
          key={`${positionId}-${reloadKey}`}
          {...listApi}
          name="position-invite-records"
          rowKey="id"
          columns={columns}
          pagination={{
            paramsType: 'params',
            pageSize: 20
          }}
          filter={{
            list: [
              {
                type: InputFilterItem,
                props: {
                  name: 'keyword',
                  label: formatMessage({ id: 'position.talentInviteKeyword' })
                }
              },
              {
                type: SuperSelectFilterItem,
                props: {
                  name: 'status',
                  label: formatMessage({ id: 'position.talentInviteStatus' }),
                  single: true,
                  options: [
                    { label: formatMessage({ id: 'position.talentInviteStatusInvited' }), value: 'invited' },
                    { label: formatMessage({ id: 'position.talentInviteStatusOpened' }), value: 'opened' },
                    { label: formatMessage({ id: 'position.talentInviteStatusFilling' }), value: 'filling' },
                    { label: formatMessage({ id: 'position.talentInviteStatusInterviewing' }), value: 'interviewing' },
                    { label: formatMessage({ id: 'position.talentInviteStatusDone' }), value: 'done' },
                    { label: formatMessage({ id: 'position.talentInviteStatusEnded' }), value: 'ended' },
                    { label: formatMessage({ id: 'position.talentInviteStatusCanceled' }), value: 'canceled' }
                  ]
                }
              },
              {
                type: SuperSelectFilterItem,
                props: {
                  name: 'inviteType',
                  label: formatMessage({ id: 'position.talentInviteType' }),
                  single: true,
                  options: [
                    { label: formatMessage({ id: 'position.talentInviteEmployee' }), value: 'employee' },
                    { label: formatMessage({ id: 'position.talentInviteManager' }), value: 'manager' }
                  ]
                }
              }
            ],
            mapFilterValue: value => ({
              positionId: String(positionId),
              filter: Object.assign({}, Filter.getFilterValue(value))
            })
          }}
        />
        <InviteAssessmentResultModal open={resultOpen} onClose={closeResultModal} invite={resultInvite} interview={resultInterview} remoteKey={resultRemoteKey} apiHost={resultApiHost} />
      </>
    );

    if (typeof children === 'function') {
      return children({ title, children: content });
    }
    return content;
  })
);

export default InviteRecords;
