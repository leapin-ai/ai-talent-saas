import { createWithRemoteLoader } from '@kne/remote-loader';
import withLocale from '../withLocale';
import { useIntl } from '@kne/react-intl';

const GrowthPlanFormInner = createWithRemoteLoader({
  modules: ['components-core:FormInfo']
})(
  withLocale(({ remoteModules }) => {
    const { formatMessage } = useIntl();
    const [FormInfo] = remoteModules;
    const { List, MultiField } = FormInfo;
    const { Input, Select } = FormInfo.fields;
    const priorityOptions = [
      { label: formatMessage({ id: 'talentProfile.PriorityHigh' }), value: 'high' },
      { label: formatMessage({ id: 'talentProfile.PriorityMedium' }), value: 'medium' },
      { label: formatMessage({ id: 'talentProfile.PriorityLow' }), value: 'low' }
    ];

    const termFields = prefix => [
      <Input key={`${prefix}.position`} name={`${prefix}.position`} label={formatMessage({ id: 'talentProfile.TargetPositionLabel' })} rule="LEN-0-200" />,
      <MultiField key={`${prefix}.paths`} name={`${prefix}.paths`} label={formatMessage({ id: 'talentProfile.DevelopmentPath' })} rule="LEN-0-400" field={Input} />,
      <List
        key={`${prefix}.trainings`}
        name={`${prefix}.trainings`}
        title={formatMessage({ id: 'talentProfile.TrainingFocus' })}
        block
        addText={formatMessage({ id: 'talentProfile.editAddTraining' })}
        itemTitle={({ index }) => formatMessage({ id: 'talentProfile.editTrainingItem' }, { index: index + 1 })}
        list={[
          <Input name="name" label={formatMessage({ id: 'talentProfile.editTrainingName' })} rule="REQ LEN-1-200" />,
          <Select name="priority" label={formatMessage({ id: 'talentProfile.editTrainingPriority' })} options={priorityOptions} />
        ]}
      />
    ];

    return (
      <>
        <FormInfo title={formatMessage({ id: 'talentProfile.ShortTerm' })} column={1} list={termFields('shortTerm')} />
        <FormInfo title={formatMessage({ id: 'talentProfile.LongTerm' })} column={1} list={termFields('longTerm')} />
      </>
    );
  })
);

export default GrowthPlanFormInner;
