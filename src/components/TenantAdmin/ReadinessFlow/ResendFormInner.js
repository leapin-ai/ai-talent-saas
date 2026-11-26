import { Alert, Flex } from 'antd';
import dayjs from 'dayjs';
import { createWithRemoteLoader } from '@kne/remote-loader';
import { useIntl } from '@kne/react-intl';
import withLocale from '../withLocale';

/** 已过期邀请重发：先设置新的有效期 */
const ResendFormInner = createWithRemoteLoader({
  modules: ['components-core:FormInfo']
})(
  withLocale(({ remoteModules, expiresAt }) => {
    const [FormInfo] = remoteModules;
    const { DatePicker } = FormInfo.fields;
    const { formatMessage } = useIntl();
    const t = (id, values) => formatMessage({ id: `tenantAdmin.readiness.${id}` }, values);
    return (
      <Flex vertical gap={12}>
        <Alert type="warning" showIcon message={t('resendExpiredTip', { time: dayjs(expiresAt).format('YYYY-MM-DD HH:mm') })} />
        <FormInfo column={1} list={[<DatePicker name="deadline" label={t('resendDeadline')} rule="REQ" disabledDate={current => current && current.isBefore(dayjs().startOf('day'))} />]} />
      </Flex>
    );
  })
);

export default ResendFormInner;
