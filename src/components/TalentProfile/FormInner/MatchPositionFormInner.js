import { createWithRemoteLoader } from '@kne/remote-loader';
import withLocale from '../withLocale';
import { useIntl } from '@kne/react-intl';

const MatchPositionFormInner = createWithRemoteLoader({
  modules: ['components-core:FormInfo']
})(
  withLocale(({ remoteModules }) => {
    const { formatMessage } = useIntl();
    const [FormInfo] = remoteModules;
    const { MultiField } = FormInfo;
    const { Input, InputNumber } = FormInfo.fields;

    return (
      <FormInfo
        column={1}
        list={[
          <Input name="position" label={formatMessage({ id: 'talentProfile.TargetPositionLabel' })} rule="REQ LEN-1-200" />,
          <InputNumber name="matchRate" label={formatMessage({ id: 'talentProfile.MatchDegree' })} rule="REQ" min={0} max={100} />,
          <MultiField name="skills" label={formatMessage({ id: 'talentProfile.MatchSkills' })} rule="LEN-0-200" field={Input} />,
          <MultiField name="gaps" label={formatMessage({ id: 'talentProfile.SkillGap' })} rule="LEN-0-200" field={Input} />
        ]}
      />
    );
  })
);

export default MatchPositionFormInner;
