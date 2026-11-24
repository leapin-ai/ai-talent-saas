import { useState } from 'react';
import { App, Button, Flex, Typography } from 'antd';
import { FormOutlined } from '@ant-design/icons';
import { createWithRemoteLoader } from '@kne/remote-loader';
import Fetch from '@kne/react-fetch';
import { DEFAULT_HOME_PATH, normalizeHomePath } from '@components/TenantAdmin/constants';

const TENANT_PREFIX = '/tenant';
const HINT = `访问站点根路径 / 时自动跳转到该页面，未设置时为 ${TENANT_PREFIX}${DEFAULT_HOME_PATH}`;

const HomeSetting = createWithRemoteLoader({
  modules: ['components-core:Global@usePreset', 'components-core:FormInfo', 'components-core:InfoPage', 'components-core:InfoPage@Descriptions']
})(({ remoteModules, tenant, reload }) => {
  const [usePreset, FormInfo, InfoPage, Descriptions] = remoteModules;
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
              <InfoPage>
                <InfoPage.Part title="默认首页">
                  <Flex vertical gap={20}>
                    <Typography.Text type="secondary">{HINT}</Typography.Text>
                    <FormInfo column={1} list={[<Input name="homePath" label="首页路径" rule="REQ LEN-1-200" block addonBefore={TENANT_PREFIX} placeholder={DEFAULT_HOME_PATH} key="homePath" />]} />
                    <Flex gap={12}>
                      <SubmitButton>保存</SubmitButton>
                      <CancelButton onClick={() => setIsEdit(false)}>取消</CancelButton>
                    </Flex>
                  </Flex>
                </InfoPage.Part>
              </InfoPage>
            </Form>
          );
        }

        return (
          <InfoPage>
            <InfoPage.Part
              title="默认首页"
              extra={
                <Button type="link" icon={<FormOutlined />} onClick={() => setIsEdit(true)}>
                  编辑
                </Button>
              }
            >
              <Flex vertical gap={16}>
                <Typography.Text type="secondary">{HINT}</Typography.Text>
                <Descriptions
                  dataSource={[
                    [
                      {
                        label: '首页路径',
                        content: (
                          <Typography.Text copyable={{ text: `${TENANT_PREFIX}${homePath}` }}>
                            {TENANT_PREFIX}
                            {homePath}
                          </Typography.Text>
                        )
                      }
                    ]
                  ]}
                />
              </Flex>
            </InfoPage.Part>
          </InfoPage>
        );
      }}
    />
  );
});

export default HomeSetting;
