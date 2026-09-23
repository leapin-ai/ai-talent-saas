import { createWithRemoteLoader } from '@kne/remote-loader';
import withLocale from '../withLocale';
import { useIntl } from '@kne/react-intl';

const TaskReadinessFormInner = createWithRemoteLoader({
  modules: ['components-core:FormInfo']
})(
  withLocale(({ remoteModules, itemCount }) => {
    const { formatMessage } = useIntl();
    const [FormInfo] = remoteModules;
    const { List } = FormInfo;
    const { Input, InputNumber, Select } = FormInfo.fields;
    const count = Number(itemCount) > 0 ? Number(itemCount) : undefined;
    const confidenceOptions = [
      { label: formatMessage({ id: 'talentProfile.confidenceHigh' }), value: 'high' },
      { label: formatMessage({ id: 'talentProfile.confidenceMedium' }), value: 'medium' },
      { label: formatMessage({ id: 'talentProfile.confidenceLow' }), value: 'low' }
    ];
    const statusOptions = [
      { label: formatMessage({ id: 'talentProfile.statusCritical' }), value: 'critical' },
      { label: formatMessage({ id: 'talentProfile.statusGap' }), value: 'gap' },
      { label: formatMessage({ id: 'talentProfile.statusOnTarget' }), value: 'onTarget' },
      { label: formatMessage({ id: 'talentProfile.statusAbove' }), value: 'above' }
    ];

    return (
      <List
        name="tasks"
        title={formatMessage({ id: 'talentProfile.futureTaskReadiness' })}
        block
        minLength={count}
        maxLength={count}
        itemTitle={({ index, data }) => data?.title || formatMessage({ id: 'talentProfile.editTaskItem' }, { index: index + 1 })}
        list={[
          <Input name="title" label={formatMessage({ id: 'talentProfile.task' })} disabled />,
          <InputNumber name="current" label={formatMessage({ id: 'talentProfile.editGapCurrent' })} rule="REQ" min={0} max={5} />,
          <InputNumber name="required" label={formatMessage({ id: 'talentProfile.editGapRequired' })} rule="REQ" min={0} max={5} />,
          <Select name="status" label={formatMessage({ id: 'talentProfile.status' })} options={statusOptions} />,
          <Select name="confidence" label={formatMessage({ id: 'talentProfile.confidence' })} options={confidenceOptions} />
        ]}
      />
    );
  })
);

export default TaskReadinessFormInner;
