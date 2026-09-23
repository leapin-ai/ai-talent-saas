import { createWithRemoteLoader } from '@kne/remote-loader';
import withLocale from '../withLocale';
import { useIntl } from '@kne/react-intl';

const ReadinessFormInner = createWithRemoteLoader({
  modules: ['components-core:FormInfo']
})(
  withLocale(({ remoteModules }) => {
    const { formatMessage } = useIntl();
    const [FormInfo] = remoteModules;
    const { InputNumber, TextArea } = FormInfo.fields;

    return (
      <FormInfo
        column={1}
        list={[
          <InputNumber name="readiness" label={formatMessage({ id: 'talentProfile.editReadinessPercent' })} rule="REQ" min={0} max={100} />,
          <TextArea name="summary" label={formatMessage({ id: 'talentProfile.editReadinessSummary' })} rule="LEN-0-2000" block />,
          <InputNumber name="metrics.criticalGaps" label={formatMessage({ id: 'talentProfile.criticalGaps' })} min={0} />,
          <InputNumber name="metrics.atOrAbove" label={formatMessage({ id: 'talentProfile.atOrAbove' })} min={0} />,
          <InputNumber name="metrics.monthsToClose" label={formatMessage({ id: 'talentProfile.toClose' })} min={0} />
        ]}
      />
    );
  })
);

export default ReadinessFormInner;
