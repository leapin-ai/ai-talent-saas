import { createWithRemoteLoader } from '@kne/remote-loader';
import withLocale from '../withLocale';
import { useIntl } from '@kne/react-intl';

const SkillFormInner = createWithRemoteLoader({
  modules: ['components-core:FormInfo']
})(
  withLocale(({ remoteModules }) => {
    const { formatMessage } = useIntl();
    const [FormInfo] = remoteModules;
    const { MultiField } = FormInfo;
    const { Input } = FormInfo.fields;

    return (
      <FormInfo
        column={1}
        list={[
          <MultiField name="cert_mapped" label={formatMessage({ id: 'talentProfile.LicenseRelated' })} minLength={0} rule="LEN-0-200" field={Input} />,
          <MultiField name="interest_strength" label={formatMessage({ id: 'talentProfile.InterestRelated' })} minLength={0} rule="LEN-0-200" field={Input} />,
          <MultiField name="work_related" label={formatMessage({ id: 'talentProfile.WorkRelated' })} minLength={0} rule="LEN-0-200" field={Input} />
        ]}
      />
    );
  })
);

export default SkillFormInner;
