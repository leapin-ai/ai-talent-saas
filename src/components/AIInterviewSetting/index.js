import { createWithRemoteLoader } from '@kne/remote-loader';
import { App, Button, Flex } from 'antd';
import { FormOutlined } from '@ant-design/icons';
import { useState } from 'react';
import { useIntl } from '@kne/react-intl';
import Fetch from '@kne/react-fetch';
import withLocale from './withLocale';

const SECRET_MASK = '******';

const AIInterviewSetting = createWithRemoteLoader({
  modules: ['components-core:Global@usePreset', 'components-core:FormInfo', 'components-core:InfoPage']
})(
  withLocale(({ remoteModules, tenant, reload }) => {
    const [usePreset, FormInfo, InfoPage] = remoteModules;
    const { apis, ajax } = usePreset();
    const { Form, SubmitButton, CancelButton } = FormInfo;
    const { Input, Password } = FormInfo.fields;
    const { message } = App.useApp();
    const { formatMessage } = useIntl();

    return (
      <Fetch
        {...Object.assign({}, apis.talentSaas.tenantAdmin.aiInterview.detail, {
          params: { tenantId: tenant.id }
        })}
        render={({ data, reload: reloadDetail }) => {
          const setting = {
            cdnUrl: data?.cdnUrl || '',
            apiUrl: data?.apiUrl || '',
            appId: data?.appId || '',
            hasSecretKey: !!data?.hasSecretKey
          };
          return (
            <AIInterviewSettingContent
              FormInfo={FormInfo}
              InfoPage={InfoPage}
              Input={Input}
              Password={Password}
              Form={Form}
              SubmitButton={SubmitButton}
              CancelButton={CancelButton}
              ajax={ajax}
              apis={apis}
              message={message}
              formatMessage={formatMessage}
              tenantId={tenant.id}
              setting={setting}
              onSaved={async () => {
                await reloadDetail();
                reload && reload();
              }}
            />
          );
        }}
      />
    );
  })
);

const AIInterviewSettingContent = ({ FormInfo, InfoPage, Input, Password, Form, SubmitButton, CancelButton, ajax, apis, message, formatMessage, tenantId, setting, onSaved }) => {
  const [isEdit, setIsEdit] = useState(false);
  const isConfigured = !!(setting.cdnUrl || setting.apiUrl || setting.appId || setting.hasSecretKey);

  const submit = async formData => {
    const payload = {
      tenantId,
      cdnUrl: formData.cdnUrl,
      apiUrl: formData.apiUrl,
      appId: formData.appId
    };
    const nextSecret = formData.secretKey ? String(formData.secretKey).trim() : '';
    if (nextSecret) {
      payload.secretKey = nextSecret;
    }
    const { data: resData } = await ajax(
      Object.assign({}, apis.talentSaas.tenantAdmin.aiInterview.save, {
        data: payload
      })
    );
    if (resData.code !== 0) {
      return false;
    }
    message.success(formatMessage({ id: 'saveSuccess' }));
    setIsEdit(false);
    await onSaved();
  };

  if (isConfigured && !isEdit) {
    return (
      <InfoPage>
        <InfoPage.Part
          title={formatMessage({ id: 'title' })}
          extra={
            <Button
              type="link"
              icon={<FormOutlined />}
              onClick={() => {
                setIsEdit(true);
              }}
            >
              {formatMessage({ id: 'edit' })}
            </Button>
          }
        >
          <InfoPage.Part title={formatMessage({ id: 'cdnUrl' })}>{setting.cdnUrl || '-'}</InfoPage.Part>
          <InfoPage.Part title={formatMessage({ id: 'apiUrl' })}>{setting.apiUrl || '-'}</InfoPage.Part>
          <InfoPage.Part title={formatMessage({ id: 'appId' })}>{setting.appId || '-'}</InfoPage.Part>
          <InfoPage.Part title={formatMessage({ id: 'secretKey' })}>{setting.hasSecretKey ? SECRET_MASK : '-'}</InfoPage.Part>
        </InfoPage.Part>
      </InfoPage>
    );
  }

  return (
    <Form
      key={`${setting.cdnUrl}|${setting.apiUrl}|${setting.appId}|${setting.hasSecretKey}|edit`}
      type="default"
      data={{
        cdnUrl: setting.cdnUrl,
        apiUrl: setting.apiUrl,
        appId: setting.appId,
        secretKey: ''
      }}
      rules={{
        SECRET_REQ: value => ({
          result: setting.hasSecretKey || !!(value && String(value).trim()),
          errMsg: formatMessage({ id: 'secretKeyRequired' })
        })
      }}
      onSubmit={submit}
    >
      <FormInfo
        title={formatMessage({ id: 'title' })}
        column={1}
        list={[
          <Input name="cdnUrl" label={formatMessage({ id: 'cdnUrl' })} rule="REQ LEN-0-500" placeholder={formatMessage({ id: 'cdnUrlPlaceholder' })} />,
          <Input name="apiUrl" label={formatMessage({ id: 'apiUrl' })} rule="REQ LEN-0-500" placeholder={formatMessage({ id: 'apiUrlPlaceholder' })} />,
          <Input name="appId" label={formatMessage({ id: 'appId' })} rule="REQ LEN-0-200" />,
          <Password name="secretKey" type="password" label={formatMessage({ id: 'secretKey' })} rule="SECRET_REQ LEN-0-200" placeholder={setting.hasSecretKey ? formatMessage({ id: 'secretKeyKeepPlaceholder' }) : undefined} />
        ]}
      />
      <Flex justify="center" gap={12}>
        <SubmitButton>{formatMessage({ id: 'save' })}</SubmitButton>
        {isConfigured ? (
          <CancelButton
            onClick={() => {
              setIsEdit(false);
            }}
          >
            {formatMessage({ id: 'cancel' })}
          </CancelButton>
        ) : null}
      </Flex>
    </Form>
  );
};

export default AIInterviewSetting;
