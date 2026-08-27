import { useState } from 'react';
import { App, Button, Flex, Typography } from 'antd';
import { FormOutlined } from '@ant-design/icons';
import { createWithRemoteLoader } from '@kne/remote-loader';
import Fetch from '@kne/react-fetch';
import { DEFAULT_HOME_PATH, normalizeHomePath } from '@components/TenantAdmin/constants';

const HomeSetting = createWithRemoteLoader({
  modules: ['components-core:Global@usePreset', 'components-core:FormInfo', 'components-core:InfoPage']
})(({ remoteModules, tenant, reload }) => {
  const [usePreset, FormInfo, InfoPage] = remoteModules;
  const { apis, ajax } = usePreset();
  const { Form, SubmitButton, CancelButton } = FormInfo;
  const { Input } = FormInfo.fields;
  const { message } = App.useApp();
  const [isEdit, setIsEdit] = useState(false);

  if (!tenant?.id) {
    return null;
  }

  return (
    <Fetch
      {...Object.assign({}, apis.talentSaas.tenantAdmin.homeSetting.detail, {
        params: { tenantId: tenant.id }
      })}
      render={({ data, reload: reloadDetail }) => {
        const homePath = normalizeHomePath(data?.homePath);
        if (isEdit) {
          return (
            <Form
              type="default"
              data={{ homePath }}
              onSubmit={async formData => {
                const { data: resData } = await ajax(
                  Object.assign({}, apis.talentSaas.tenantAdmin.homeSetting.save, {
                    data: {
                      tenantId: tenant.id,
                      homePath: normalizeHomePath(formData.homePath)
                    }
                  })
                );
                if (resData.code !== 0) {
                  return false;
                }
                message.success('保存成功');
                setIsEdit(false);
                await reloadDetail();
                reload && reload();
              }}
            >
              <FormInfo title="首页路径" list={[<Input name="homePath" label="默认路径" rule="REQ LEN-1-200" block placeholder={DEFAULT_HOME_PATH} key="homePath" />]} />
              <Typography.Paragraph type="secondary">访问站点根路径 / 时，将跳转到 /tenant + 该路径，默认为 /home（即 /tenant/home）</Typography.Paragraph>
              <Flex justify="center" gap={12}>
                <SubmitButton>保存</SubmitButton>
                <CancelButton
                  onClick={() => {
                    setIsEdit(false);
                  }}
                >
                  取消
                </CancelButton>
              </Flex>
            </Form>
          );
        }

        return (
          <InfoPage>
            <InfoPage.Part
              title="首页路径"
              extra={
                <Button
                  type="link"
                  icon={<FormOutlined />}
                  onClick={() => {
                    setIsEdit(true);
                  }}
                >
                  编辑
                </Button>
              }
            >
              <Typography.Paragraph>默认路径：{homePath}</Typography.Paragraph>
              <Typography.Paragraph type="secondary">访问站点根路径 / 时，将跳转到 /tenant + 该路径，默认为 /home（即 /tenant/home）</Typography.Paragraph>
            </InfoPage.Part>
          </InfoPage>
        );
      }}
    />
  );
});

export default HomeSetting;
