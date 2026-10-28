import { Flex, Typography } from 'antd';
import dayjs from 'dayjs';
import { createWithRemoteLoader } from '@kne/remote-loader';
import { useIntl } from '@kne/react-intl';
import withLocale from './withLocale';

const MAX_NAMES = 5;

const ShareReportFormInner = createWithRemoteLoader({
  modules: ['components-core:FormInfo']
})(
  withLocale(({ remoteModules, kind, names = [] }) => {
    const [FormInfo] = remoteModules;
    const { useFormContext, MultiField } = FormInfo;
    const { RadioGroup, Input, DatePicker } = FormInfo.fields;
    const { formData } = useFormContext();
    const { formatMessage } = useIntl();
    const isEmployee = kind === 'employee';
    const showEmails = !isEmployee || formData?.mode === 'specified';
    const namesText = names.slice(0, MAX_NAMES).join('、') + (names.length > MAX_NAMES ? '…' : '');

    return (
      <Flex vertical gap={12}>
        <Typography.Text type="secondary">{formatMessage({ id: isEmployee ? 'shareReport.selectedEmployees' : 'shareReport.selectedPositions' }, { count: names.length, names: namesText })}</Typography.Text>
        <FormInfo
          column={1}
          list={[
            isEmployee ? (
              <RadioGroup
                name="mode"
                label={formatMessage({ id: 'shareReport.mode' })}
                rule="REQ"
                options={[
                  { value: 'self', label: formatMessage({ id: 'shareReport.modeSelf' }) },
                  { value: 'specified', label: formatMessage({ id: 'shareReport.modeSpecified' }) }
                ]}
              />
            ) : null,
            isEmployee && !showEmails ? (
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                {formatMessage({ id: 'shareReport.modeSelfHint' })}
              </Typography.Text>
            ) : null,
            showEmails ? <MultiField name="emails" label={formatMessage({ id: 'shareReport.emails' })} rule="REQ EMAIL" field={Input} placeholder={formatMessage({ id: 'shareReport.emailsPlaceholder' })} /> : null,
            <DatePicker name="deadline" label={formatMessage({ id: 'shareReport.deadline' })} rule="REQ" disabledDate={current => current && current.isBefore(dayjs().startOf('day'))} />
          ].filter(Boolean)}
        />
      </Flex>
    );
  })
);

export default ShareReportFormInner;
