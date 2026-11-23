import { Alert, Flex } from 'antd';
import dayjs from 'dayjs';
import { createWithRemoteLoader } from '@kne/remote-loader';
import { useIntl } from '@kne/react-intl';
import withLocale from '../withLocale';

/** 表单值 → 确认问卷接口入参 */
export const buildConfirmBody = ({ kind, personId }, formData) => ({
  kind,
  personId,
  deadline: formData.deadline ? dayjs(formData.deadline).format('YYYY-MM-DD') : undefined,
  digitalId: formData.digitalId
});

/** 邮件模式入参：可一次带多份 targets，共用一封邮件与一个入口链接 */
export const buildConfirmMailBody = (targets, formData, { singleRecipient = false } = {}) => {
  const emails = singleRecipient ? [formData.email].filter(Boolean) : formData.emails || [];
  return {
    targets: (targets || []).map(item => ({
      runId: String(item.runId),
      kind: item.kind,
      personId: item.personId || undefined
    })),
    recipients: emails.map(email => ({ email: String(email || '').trim() })).filter(item => item.email),
    language: formData.language,
    digitalId: formData.digitalId
  };
};

/** 确认问卷弹窗表单：管理员直接确认（须填截止日期）或把确认链接发给有关人；经理问卷邮件收件人最多一人 */
const ConfirmFormInner = createWithRemoteLoader({
  modules: ['components-core:FormInfo']
})(
  withLocale(({ remoteModules, digitals = [], batchCount = 1, singleRecipient = false }) => {
    const [FormInfo] = remoteModules;
    const { useFormContext, MultiField } = FormInfo;
    const { RadioGroup, Input, DatePicker, Select } = FormInfo.fields;
    const { formData } = useFormContext();
    const { formatMessage } = useIntl();
    const t = (id, values) => formatMessage({ id: `tenantAdmin.readiness.${id}` }, values);
    const isMail = formData?.mode === 'mail';
    const mailTip = isMail ? (singleRecipient ? (batchCount > 1 ? 'confirmMailBatchTipManager' : 'confirmMailTipManager') : batchCount > 1 ? 'confirmMailBatchTip' : 'confirmMailTip') : 'confirmDirectTip';

    return (
      <Flex vertical gap={12}>
        <FormInfo
          column={1}
          list={[
            <RadioGroup
              name="mode"
              label={t('confirmMode')}
              rule="REQ"
              options={[
                { value: 'direct', label: t('confirmModeDirect') },
                { value: 'mail', label: t('confirmModeMail') }
              ]}
            />
          ]}
        />
        <Alert type="info" showIcon message={t(mailTip, { count: batchCount })} />
        <FormInfo
          column={1}
          list={[
            <Select
              name="digitalId"
              label={t('confirmDigital')}
              rule="REQ"
              placeholder={t('confirmDigitalPlaceholder')}
              options={digitals.map(item => ({ label: `${item.name || item.id}${item.language ? `（${item.language}）` : ''}`, value: String(item.id) }))}
            />,
            isMail ? (
              singleRecipient ? (
                <Input name="email" label={t('recipients')} rule="REQ EMAIL" placeholder={t('recipientsPlaceholder')} />
              ) : (
                <MultiField name="emails" label={t('recipients')} rule="REQ EMAIL" field={Input} placeholder={t('recipientsPlaceholder')} />
              )
            ) : (
              <DatePicker name="deadline" label={t('questionnaireDeadline')} rule="REQ" disabledDate={current => current && current.isBefore(dayjs().startOf('day'))} />
            ),
            isMail ? (
              <RadioGroup
                name="language"
                label={t('confirmMailLanguage')}
                options={[
                  { label: '中文', value: 'zh-CN' },
                  { label: 'English', value: 'en-US' },
                  { label: t('confirmMailLanguageAuto'), value: 'auto' }
                ]}
              />
            ) : null
          ].filter(Boolean)}
        />
      </Flex>
    );
  })
);

export default ConfirmFormInner;
