import { createWithRemoteLoader } from '@kne/remote-loader';
import { Alert, App, Avatar, Button, Flex, Tag, Tooltip, Typography } from 'antd';
import { ApiOutlined, CheckCircleFilled, CloseCircleFilled, DeleteOutlined, FormOutlined, ImportOutlined } from '@ant-design/icons';
import { useState } from 'react';
import { useIntl } from '@kne/react-intl';
import Fetch from '@kne/react-fetch';
import withLocale from './withLocale';

const SECRET_MASK = '******';

// 对应 AI 面试「第三方系统」生成 Secret Key 后一键复制的文本格式
export const parseSiteCredentials = text => {
  const pick = label => String(text || '').match(new RegExp(`${label}\\s*[:：]\\s*(\\S+)`, 'i'))?.[1];
  const url = pick('Host URL');
  const appId = pick('App ID');
  const secretKey = pick('Secret Key');
  return url && appId && secretKey ? { url, appId, secretKey } : null;
};

const CredentialFields = createWithRemoteLoader({
  modules: ['components-core:FormInfo', 'components-core:FormInfo@useFormContext']
})(
  withLocale(({ remoteModules, hasSecretKey }) => {
    const [FormInfo, useFormContext] = remoteModules;
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
        <FormInfo
          title={formatMessage({ id: 'title' })}
          extra={
            <Tooltip title={formatMessage({ id: 'pasteTip' })}>
              <Button type="link" icon={<ImportOutlined />} onClick={importFromClipboard}>
                {formatMessage({ id: 'importClipboard' })}
              </Button>
            </Tooltip>
          }
          column={1}
          list={[
            <Input name="url" label={formatMessage({ id: 'url' })} rule="REQ LEN-0-500" placeholder={formatMessage({ id: 'urlPlaceholder' })} />,
            <Input name="appId" label={formatMessage({ id: 'appId' })} rule="REQ LEN-0-200" />,
            <Password
              name="secretKey"
              type="password"
              label={formatMessage({ id: 'secretKey' })}
              rule={hasSecretKey ? 'LEN-0-200' : 'REQ LEN-0-200'}
              placeholder={hasSecretKey ? formatMessage({ id: 'secretKeyKeepPlaceholder' }) : undefined}
            />
          ]}
        />
      </div>
    );
  })
);

const ClientCard = createWithRemoteLoader({
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
          <Flex gap={16} align="center">
            <Avatar shape="square" size={56} src={client?.logoUrl} icon={!client?.name && <ApiOutlined />}>
              {client?.name ? client.name.slice(0, 1) : null}
            </Avatar>
            <Flex vertical gap={4}>
              <Flex align="center" gap={8}>
                <Typography.Text strong>{client?.name || '-'}</Typography.Text>
                <Tag color="success" bordered={false} icon={<CheckCircleFilled />}>
                  {formatMessage({ id: 'clientInfo' })}
                </Tag>
              </Flex>
              {client?.description ? (
                <Typography.Paragraph type="secondary" ellipsis={{ rows: 2 }} style={{ margin: 0 }}>
                  {client.description}
                </Typography.Paragraph>
              ) : null}
            </Flex>
          </Flex>
        )}
      />
    );
  })
);

const TalentReviewSetting = createWithRemoteLoader({
  modules: ['components-core:Global@usePreset', 'components-core:FormInfo', 'components-core:InfoPage']
})(
  withLocale(({ remoteModules, tenant, reload }) => {
    const [usePreset, FormInfo, InfoPage] = remoteModules;
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
                  title={formatMessage({ id: 'title' })}
                  extra={
                    <Flex gap={8}>
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
                  <Flex vertical gap={16}>
                    <ClientCard tenantId={tenant.id} />
                    <InfoPage.Part title={formatMessage({ id: 'url' })}>{setting.url}</InfoPage.Part>
                    <InfoPage.Part title={formatMessage({ id: 'appId' })}>{setting.appId}</InfoPage.Part>
                    <InfoPage.Part title={formatMessage({ id: 'secretKey' })}>{SECRET_MASK}</InfoPage.Part>
                    <InfoPage.Part title={formatMessage({ id: 'origin' })}>{setting.origin || '-'}</InfoPage.Part>
                  </Flex>
                </InfoPage.Part>
              </InfoPage>
            );
          }

          return (
            <Form
              type="default"
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
              <CredentialFields hasSecretKey={setting.hasSecretKey} />
              <Flex justify="center" gap={12}>
                <SubmitButton>{formatMessage({ id: 'save' })}</SubmitButton>
                {isConfigured ? <CancelButton onClick={() => setIsEdit(false)}>{formatMessage({ id: 'cancel' })}</CancelButton> : null}
              </Flex>
            </Form>
          );
        }}
      />
    );
  })
);

export default TalentReviewSetting;
