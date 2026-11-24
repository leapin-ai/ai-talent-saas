import { createWithRemoteLoader } from '@kne/remote-loader';
import { Alert, App, Avatar, Button, Divider, Flex, Tag, Typography } from 'antd';
import { ApiOutlined, CheckCircleFilled, CloseCircleFilled, DeleteOutlined, FormOutlined, ImportOutlined } from '@ant-design/icons';
import { useState } from 'react';
import { useIntl } from '@kne/react-intl';
import Fetch from '@kne/react-fetch';
import withLocale from './withLocale';
import style from './style.module.scss';

const SECRET_MASK = '******';

// 对应 AI 面试「第三方系统」生成 Secret Key 后一键复制的文本格式
export const parseSiteCredentials = text => {
  const pick = label => String(text || '').match(new RegExp(`${label}\\s*[:：]\\s*(\\S+)`, 'i'))?.[1];
  const url = pick('Host URL');
  const appId = pick('App ID');
  const secretKey = pick('Secret Key');
  return url && appId && secretKey ? { url, appId, secretKey } : null;
};

const StatusTag = withLocale(({ linked }) => {
  const { formatMessage } = useIntl();
  return linked ? (
    <Tag color="success" bordered={false} icon={<CheckCircleFilled />}>
      {formatMessage({ id: 'linked' })}
    </Tag>
  ) : (
    <Tag bordered={false}>{formatMessage({ id: 'notConfigured' })}</Tag>
  );
});

const PartTitle = withLocale(({ linked }) => {
  const { formatMessage } = useIntl();
  return (
    <span className={style['part-title']}>
      {formatMessage({ id: 'title' })}
      <StatusTag linked={linked} />
    </span>
  );
});

const CredentialForm = createWithRemoteLoader({
  modules: ['components-core:FormInfo', 'components-core:FormInfo@useFormContext', 'components-core:InfoPage']
})(
  withLocale(({ remoteModules, hasSecretKey, linked, footer }) => {
    const [FormInfo, useFormContext, InfoPage] = remoteModules;
    const { Input, Password } = FormInfo.fields;
    const { openApi } = useFormContext();
    const { message } = App.useApp();
    const { formatMessage } = useIntl();

    const fill = credentials => {
      openApi.setFields(Object.entries(credentials).map(([name, value]) => ({ name, value })));
      message.success(formatMessage({ id: 'parsed' }));
    };

    const importFromClipboard = async () => {
      let text = '';
      try {
        text = await navigator.clipboard.readText();
      } catch (e) {
        message.error(formatMessage({ id: 'clipboardFailed' }));
        return;
      }
      const credentials = parseSiteCredentials(text);
      if (!credentials) {
        message.warning(formatMessage({ id: 'clipboardEmpty' }));
        return;
      }
      fill(credentials);
    };

    return (
      <div
        onPaste={event => {
          const credentials = parseSiteCredentials(event.clipboardData.getData('text'));
          if (!credentials) {
            return;
          }
          event.preventDefault();
          fill(credentials);
        }}
      >
        <InfoPage>
          <InfoPage.Part title={<PartTitle linked={linked} />}>
            <Flex vertical gap={20}>
              <Typography.Text type="secondary">{formatMessage({ id: 'description' })}</Typography.Text>
              <div className={style['paste-zone']} tabIndex={0}>
                <span className={style['paste-icon']}>
                  <ImportOutlined />
                </span>
                <div className={style['paste-body']}>
                  <div className={style['paste-title']}>{formatMessage({ id: 'pasteTitle' })}</div>
                  <div className={style['paste-hint']}>{formatMessage({ id: 'pasteHint' })}</div>
                </div>
                <Button icon={<ImportOutlined />} onClick={importFromClipboard}>
                  {formatMessage({ id: 'importClipboard' })}
                </Button>
              </div>
              <Divider plain orientation="left" style={{ margin: 0 }}>
                <Typography.Text type="secondary">{formatMessage({ id: 'manualFill' })}</Typography.Text>
              </Divider>
              <FormInfo
                column={1}
                list={[
                  <Input name="url" label={formatMessage({ id: 'url' })} rule="REQ LEN-0-500" block placeholder={formatMessage({ id: 'urlPlaceholder' })} />,
                  <Input name="appId" label={formatMessage({ id: 'appId' })} rule="REQ LEN-0-200" block />,
                  <Password
                    name="secretKey"
                    type="password"
                    label={formatMessage({ id: 'secretKey' })}
                    rule={hasSecretKey ? 'LEN-0-200' : 'REQ LEN-0-200'}
                    block
                    placeholder={hasSecretKey ? formatMessage({ id: 'secretKeyKeepPlaceholder' }) : undefined}
                  />
                ]}
              />
              {footer}
            </Flex>
          </InfoPage.Part>
        </InfoPage>
      </div>
    );
  })
);

const ClientSummary = createWithRemoteLoader({
  modules: ['components-core:Global@usePreset']
})(
  withLocale(({ remoteModules, tenantId }) => {
    const [usePreset] = remoteModules;
    const { apis } = usePreset();
    const { formatMessage } = useIntl();
    return (
      <Fetch
        {...Object.assign({}, apis.talentSaas.tenantAdmin.talentReviewSetting.client, {
          params: { tenantId }
        })}
        error={error => <Alert type="error" showIcon icon={<CloseCircleFilled />} message={formatMessage({ id: 'clientInfo' })} description={typeof error === 'string' ? error : error?.message} />}
        render={({ data: client }) => (
          <div className={style.client}>
            <Avatar shape="square" size={48} src={client?.logoUrl} icon={!client?.name && <ApiOutlined />}>
              {client?.name ? client.name.slice(0, 1) : null}
            </Avatar>
            <div>
              <div className={style['client-name']}>{client?.name || '-'}</div>
              {client?.description ? (
                <Typography.Paragraph className={style['client-desc']} ellipsis={{ rows: 2 }}>
                  {client.description}
                </Typography.Paragraph>
              ) : null}
            </div>
          </div>
        )}
      />
    );
  })
);

const TalentReviewSetting = createWithRemoteLoader({
  modules: ['components-core:Global@usePreset', 'components-core:FormInfo', 'components-core:InfoPage', 'components-core:InfoPage@Descriptions']
})(
  withLocale(({ remoteModules, tenant, reload }) => {
    const [usePreset, FormInfo, InfoPage, Descriptions] = remoteModules;
    const { apis, ajax } = usePreset();
    const { Form, SubmitButton, CancelButton } = FormInfo;
    const { message, modal } = App.useApp();
    const { formatMessage } = useIntl();
    const [isEdit, setIsEdit] = useState(false);

    return (
      <Fetch
        {...Object.assign({}, apis.talentSaas.tenantAdmin.talentReviewSetting.detail, {
          params: { tenantId: tenant.id }
        })}
        render={({ data, refresh: reloadDetail }) => {
          const setting = Object.assign({ url: '', appId: '', hasSecretKey: false }, data);
          const isConfigured = !!(setting.url && setting.appId && setting.hasSecretKey);
          const onSaved = async () => {
            await reloadDetail();
            reload && reload();
          };

          if (isConfigured && !isEdit) {
            return (
              <InfoPage>
                <InfoPage.Part
                  title={<PartTitle linked />}
                  extra={
                    <Flex gap={4}>
                      <Button type="link" icon={<FormOutlined />} onClick={() => setIsEdit(true)}>
                        {formatMessage({ id: 'edit' })}
                      </Button>
                      <Button
                        type="link"
                        danger
                        icon={<DeleteOutlined />}
                        onClick={() => {
                          modal.confirm({
                            title: formatMessage({ id: 'unbind' }),
                            content: formatMessage({ id: 'unbindConfirm' }),
                            okButtonProps: { danger: true },
                            onOk: async () => {
                              const { data: resData } = await ajax(
                                Object.assign({}, apis.talentSaas.tenantAdmin.talentReviewSetting.cancel, {
                                  data: { tenantId: tenant.id }
                                })
                              );
                              if (resData.code !== 0) {
                                return;
                              }
                              message.success(formatMessage({ id: 'unbindSuccess' }));
                              await onSaved();
                            }
                          });
                        }}
                      >
                        {formatMessage({ id: 'unbind' })}
                      </Button>
                    </Flex>
                  }
                >
                  <ClientSummary tenantId={tenant.id} />
                </InfoPage.Part>
                <InfoPage.Part title={formatMessage({ id: 'connection' })}>
                  <Descriptions
                    dataSource={[
                      [{ label: formatMessage({ id: 'url' }), content: setting.url }],
                      [
                        { label: formatMessage({ id: 'appId' }), content: setting.appId },
                        { label: formatMessage({ id: 'secretKey' }), content: SECRET_MASK }
                      ],
                      [{ label: formatMessage({ id: 'origin' }), content: setting.origin || '-' }]
                    ]}
                  />
                </InfoPage.Part>
              </InfoPage>
            );
          }

          return (
            <Form
              data={{ url: setting.url, appId: setting.appId, secretKey: '' }}
              onSubmit={async formData => {
                const payload = { tenantId: tenant.id, url: formData.url, appId: formData.appId };
                const nextSecret = formData.secretKey ? String(formData.secretKey).trim() : '';
                if (nextSecret) {
                  payload.secretKey = nextSecret;
                }
                const { data: resData } = await ajax(
                  Object.assign({}, apis.talentSaas.tenantAdmin.talentReviewSetting.save, {
                    data: payload
                  })
                );
                if (resData.code !== 0) {
                  return false;
                }
                message.success(formatMessage({ id: 'saveSuccess' }));
                setIsEdit(false);
                await onSaved();
              }}
            >
              <CredentialForm
                hasSecretKey={setting.hasSecretKey}
                linked={isConfigured}
                footer={
                  <Flex gap={12}>
                    <SubmitButton>{formatMessage({ id: 'saveAndVerify' })}</SubmitButton>
                    {isConfigured ? <CancelButton onClick={() => setIsEdit(false)}>{formatMessage({ id: 'cancel' })}</CancelButton> : null}
                  </Flex>
                }
              />
            </Form>
          );
        }}
      />
    );
  })
);

export default TalentReviewSetting;
