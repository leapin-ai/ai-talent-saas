import { useCallback, useMemo, useState } from 'react';
import { App, Button, Flex, Input, Space, Typography } from 'antd';
import { createWithRemoteLoader } from '@kne/remote-loader';
import { useIntl } from '@kne/react-intl';
import { useParams } from 'react-router-dom';
import withLocale from '../withLocale';

const STATUS_LABEL_IDS = {
  invited: 'position.talentInviteStatusInvited',
  opened: 'position.talentInviteStatusOpened',
  filling: 'position.talentInviteStatusFilling',
  interviewing: 'position.talentInviteStatusInterviewing',
  done: 'position.talentInviteStatusDone'
};

const TYPE_LABEL_IDS = {
  employee: 'position.talentInviteEmployee',
  manager: 'position.talentInviteManager'
};

const pickResultPayload = interview => {
  if (!interview || typeof interview !== 'object') {
    return interview;
  }
  if (interview.report != null) {
    return {
      id: interview.id,
      name: interview.name || interview.user?.name,
      status: interview.status || interview.interviewStatus,
      report: interview.report,
      score: interview.score ?? interview.totalScore,
      updatedAt: interview.updatedAt || interview.updated_at
    };
  }
  return interview;
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
  modules: ['components-core:Global@usePreset', 'components-core:TablePage', 'components-core:Filter']
})(
  withLocale(({ remoteModules, children }) => {
    const [usePreset, TablePage, Filter] = remoteModules;
    const { apis, ajax } = usePreset();
    const { formatMessage } = useIntl();
    const { message, modal } = App.useApp();
    const { id: positionId } = useParams();
    const { InputFilterItem, SuperSelectFilterItem } = Filter.fields;
    const [reloadKey, setReloadKey] = useState(0);
    const [loadingId, setLoadingId] = useState(null);
    const [actionType, setActionType] = useState('');

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
            throw new Error(resData.msg || formatMessage({ id: 'position.talentInviteResultFailed' }));
          }
          const payload = pickResultPayload(resData.data?.interview);
          modal.info({
            title: formatMessage({ id: 'position.talentInviteResultTitle' }, { name: item.name || '' }),
            width: 720,
            content: (
              <pre
                style={{
                  margin: 0,
                  maxHeight: 480,
                  overflow: 'auto',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                  fontSize: 12,
                  lineHeight: 1.5
                }}
              >
                {JSON.stringify(payload, null, 2)}
              </pre>
            )
          });
          setReloadKey(key => key + 1);
        } catch (e) {
          message.error(e.message || formatMessage({ id: 'position.talentInviteResultFailed' }));
        } finally {
          setLoadingId(null);
          setActionType('');
        }
      },
      [ajax, apis, formatMessage, message, modal]
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
                  data: { id: String(item.id) }
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
          title: formatMessage({ id: 'position.talentInviteProject' })
        },
        {
          name: 'status',
          title: formatMessage({ id: 'position.talentInviteStatus' }),
          getValueOf: item => formatMessage({ id: STATUS_LABEL_IDS[item.status] || 'position.talentInviteStatusInvited' })
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
            const actions = [
              {
                children: formatMessage({ id: 'position.talentInviteGetLink' }),
                loading: loadingId === item.id && actionType === 'link',
                onClick: () => fetchInviteLink(item)
              }
            ];
            if (item.status === 'done') {
              actions.push({
                children: formatMessage({ id: 'position.talentInviteViewResult' }),
                loading: loadingId === item.id && actionType === 'result',
                onClick: () => fetchInterviewResult(item)
              });
              return actions;
            }
            actions.push({
              children: formatMessage({ id: 'position.talentInviteResend' }),
              loading: loadingId === item.id && actionType === 'resend',
              onClick: () => resendInvite(item)
            });
            return actions;
          }
        }
      ],
      [actionType, fetchInterviewResult, fetchInviteLink, formatMessage, loadingId, resendInvite]
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

    const title = formatMessage({ id: 'position.talentInviteRecordsTitle' });
    const content = !listApi ? null : (
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
                  { label: formatMessage({ id: 'position.talentInviteStatusDone' }), value: 'done' }
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
    );

    if (typeof children === 'function') {
      return children({ title, children: content });
    }
    return content;
  })
);

export default InviteRecords;
