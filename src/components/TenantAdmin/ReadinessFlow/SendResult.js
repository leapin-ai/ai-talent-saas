import { Alert, Flex } from 'antd';
import { createWithRemoteLoader } from '@kne/remote-loader';
import { useIntl } from '@kne/react-intl';
import withLocale from '../withLocale';

/** 批量发送结果：发送汇总 + 被跳过 / 推进失败的 role 明细 */
const SendResult = createWithRemoteLoader({
  modules: ['components-core:InfoPage', 'components-core:InfoPage@TableView']
})(
  withLocale(({ remoteModules, result }) => {
    const [InfoPage, TableView] = remoteModules;
    const { formatMessage } = useIntl();
    const t = (id, values) => formatMessage({ id: `tenantAdmin.readiness.${id}` }, values);
    const reasonColumns = [
      { name: 'roleName', title: t('role') },
      { name: 'reason', title: t('reason') }
    ];
    const failedAny = result.failed.length || result.advanceFailed.length;

    return (
      <Flex vertical gap={12}>
        <Alert
          type={failedAny ? 'warning' : result.sent.length ? 'success' : 'info'}
          showIcon
          message={t('sendSummary', { mails: result.sent.length, advanced: result.advanced.length, skipped: result.skipped.length, failed: result.failed.length })}
        />
        <InfoPage>
          {result.sent.length ? (
            <InfoPage.Part title={t('sent')}>
              <TableView
                rowKey="email"
                dataSource={result.sent}
                columns={[
                  { name: 'email', title: 'Email' },
                  { name: 'roles', title: t('role'), getValueOf: item => item.roles.join('、') }
                ]}
              />
            </InfoPage.Part>
          ) : null}
          {result.failed.length ? (
            <InfoPage.Part title={t('sendFailed')}>
              <TableView
                rowKey={item => item.email || item.roleName}
                dataSource={result.failed}
                columns={[
                  { name: 'target', title: 'Email / Role', getValueOf: item => item.email || item.roleName },
                  { name: 'reason', title: t('reason') }
                ]}
              />
            </InfoPage.Part>
          ) : null}
          {result.skipped.length ? (
            <InfoPage.Part title={t('skipped')}>
              <TableView rowKey="runId" dataSource={result.skipped} columns={reasonColumns} />
            </InfoPage.Part>
          ) : null}
          {result.advanceFailed.length ? (
            <InfoPage.Part title={t('advanceFailed')}>
              <TableView rowKey="runId" dataSource={result.advanceFailed} columns={reasonColumns} />
            </InfoPage.Part>
          ) : null}
        </InfoPage>
      </Flex>
    );
  })
);

export default SendResult;
