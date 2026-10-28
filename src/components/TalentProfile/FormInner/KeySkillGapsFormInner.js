import { createWithRemoteLoader } from '@kne/remote-loader';
import withLocale from '../withLocale';
import { useIntl } from '@kne/react-intl';

const CATEGORY_KEYS = ['tool', 'action', 'knowledge'];

const KeySkillGapsFormInner = createWithRemoteLoader({
  modules: ['components-core:FormInfo']
})(
  withLocale(({ remoteModules }) => {
    const { formatMessage } = useIntl();
    const [FormInfo] = remoteModules;
    const { List } = FormInfo;
    const { Input, InputNumber, Select } = FormInfo.fields;

    return (
      <List
        name="keySkillGaps"
        title={formatMessage({ id: 'talentProfile.keySkillChanges' })}
        block
        addText={formatMessage({ id: 'talentProfile.editAddKeySkill' })}
        itemTitle={({ index }) => formatMessage({ id: 'talentProfile.editKeySkillItem' }, { index: index + 1 })}
        list={[
          <InputNumber name="rank" label={formatMessage({ id: 'talentProfile.editGapRank' })} min={1} />,
          <Select name="category" label={formatMessage({ id: 'talentProfile.editKeySkillCategory' })} options={CATEGORY_KEYS.map(value => ({ value, label: formatMessage({ id: `talentProfile.keySkillCategory.${value}` }) }))} />,
          <Select name="skillNow" label={formatMessage({ id: 'talentProfile.keySkillNow' })} mode="tags" placeholder={formatMessage({ id: 'talentProfile.editKeySkillNowPlaceholder' })} block />,
          <Input name="skillFuture" label={formatMessage({ id: 'talentProfile.keySkillFuture' })} rule="REQ LEN-1-200" block />,
          <Input name="primaryTask" label={formatMessage({ id: 'talentProfile.editKeySkillPrimaryTask' })} />,
          <InputNumber name="score" label={formatMessage({ id: 'talentProfile.editKeySkillScore' })} min={0} />,
          <Select name="alsoOnTasks" label={formatMessage({ id: 'talentProfile.editKeySkillAlsoOnTasks' })} mode="tags" block />
        ]}
      />
    );
  })
);

export default KeySkillGapsFormInner;
