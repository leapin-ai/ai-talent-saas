import { createWithRemoteLoader } from '@kne/remote-loader';
import { App, Button, Flex } from 'antd';
import { FormOutlined } from '@ant-design/icons';
import { useState } from 'react';
import { useIntl } from '@kne/react-intl';
import Fetch from '@kne/react-fetch';
import withLocale from './withLocale';
import FeatureBindingPanel from './FeatureBindingPanel';

const SECRET_MASK = '******';

const AIInterviewSetting = createWithRemoteLoader({
  modules: ['components-core:Global@usePreset', 'components-core:FormInfo', 'components-core:InfoPage', 'components-core:Table@TablePage']
})(
  withLocale(({ remoteModules, tenant, reload }) => {
    const [usePreset, FormInfo, InfoPage, TablePage] = remoteModules;
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
            version: data?.version || '',
            apiUrl: data?.apiUrl || '',
            appId: data?.appId || '',
            hasSecretKey: !!data?.hasSecretKey,
            featureBindings: Array.isArray(data?.featureBindings) ? data.featureBindings : []
          };
          return (
            <AIInterviewSettingContent
              FormInfo={FormInfo}
              InfoPage={InfoPage}
              TablePage={TablePage}
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

const AIInterviewSettingContent = ({ FormInfo, InfoPage, TablePage, Input, Password, Form, SubmitButton, CancelButton, ajax, apis, message, formatMessage, tenantId, setting, onSaved }) => {
  const [isEdit, setIsEdit] = useState(false);
  const isConfigured = !!(setting.cdnUrl || setting.version || setting.apiUrl || setting.appId || setting.hasSecretKey);
  const isReadyForBinding = !!(setting.apiUrl && setting.appId && setting.hasSecretKey);

  const submit = async formData => {
    const payload = {
      tenantId,
      cdnUrl: formData.cdnUrl,
      version: formData.version,
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
      <Flex vertical gap={24}>
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
            <InfoPage.Part title={formatMessage({ id: 'version' })}>{setting.version || '-'}</InfoPage.Part>
            <InfoPage.Part title={formatMessage({ id: 'apiUrl' })}>{setting.apiUrl || '-'}</InfoPage.Part>
            <InfoPage.Part title={formatMessage({ id: 'appId' })}>{setting.appId || '-'}</InfoPage.Part>
            <InfoPage.Part title={formatMessage({ id: 'secretKey' })}>{setting.hasSecretKey ? SECRET_MASK : '-'}</InfoPage.Part>
          </InfoPage.Part>
        </InfoPage>
        {isReadyForBinding ? <FeatureBindingPanel FormInfo={FormInfo} TablePage={TablePage} tenantId={tenantId} featureBindings={setting.featureBindings} apis={apis} ajax={ajax} formatMessage={formatMessage} onReload={onSaved} /> : null}
      </Flex>
    );
  }

  return (
    <Form
      key={`${setting.cdnUrl}|${setting.version}|${setting.apiUrl}|${setting.appId}|${setting.hasSecretKey}|edit`}
      type="default"
      data={{
        cdnUrl: setting.cdnUrl,
        version: setting.version,
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
          <Input name="version" label={formatMessage({ id: 'version' })} rule="REQ LEN-0-50" placeholder={formatMessage({ id: 'versionPlaceholder' })} />,
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
