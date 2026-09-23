import { createWithRemoteLoader } from '@kne/remote-loader';
import withLocale from '../withLocale';
import { useIntl } from '@kne/react-intl';

const ReadinessFormInner = createWithRemoteLoader({
  modules: ['components-core:FormInfo']
})(
  withLocale(({ remoteModules }) => {
    const { formatMessage } = useIntl();
    const [FormInfo] = remoteModules;
    const { List } = FormInfo;
    const { Input, TextArea, InputNumber } = FormInfo.fields;

    return (
      <>
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
        <List
          name="priorityGaps"
          title={formatMessage({ id: 'talentProfile.priorityGaps' })}
          block
          addText={formatMessage({ id: 'talentProfile.editAddGap' })}
          itemTitle={({ index }) => formatMessage({ id: 'talentProfile.editGapItem' }, { index: index + 1 })}
          list={[
            <InputNumber name="rank" label={formatMessage({ id: 'talentProfile.editGapRank' })} min={1} />,
            <Input name="title" label={formatMessage({ id: 'talentProfile.editGapTitle' })} rule="REQ LEN-1-400" />,
            <TextArea name="description" label={formatMessage({ id: 'talentProfile.editGapDesc' })} block />,
            <InputNumber name="current" label={formatMessage({ id: 'talentProfile.editGapCurrent' })} min={0} max={5} />,
            <InputNumber name="required" label={formatMessage({ id: 'talentProfile.editGapRequired' })} min={0} max={5} />
          ]}
        />
      </>
    );
  })
);

export default ReadinessFormInner;
