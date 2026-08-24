import { createWithRemoteLoader } from '@kne/remote-loader';
import withLocale from '../withLocale';
import { useIntl } from '@kne/react-intl';

const MobilityPreferenceFormInner = createWithRemoteLoader({
  modules: ['components-core:FormInfo']
})(
  withLocale(({ remoteModules, title, bordered, required = true }) => {
    const { formatMessage } = useIntl();
    const [FormInfo] = remoteModules;
    const { RadioGroup } = FormInfo.fields;
    const rule = required ? 'REQ' : undefined;

    return (
      <FormInfo
        title={title}
        bordered={bordered}
        column={1}
        list={[
          <RadioGroup
            name="workPreference.work_mode_preference"
            label={formatMessage({ id: 'talentProfile.WorkModePreference' })}
            options={[
              { label: formatMessage({ id: 'talentProfile.HybridWork' }), value: 'Hybrid Work' },
              { label: formatMessage({ id: 'talentProfile.RemoteWork' }), value: 'Remote' },
              { label: formatMessage({ id: 'talentProfile.OnSiteWork' }), value: 'On-site' }
            ]}
            rule={rule}
          />,
          <RadioGroup
            name="workPreference.business_travel_willingness"
            label={formatMessage({ id: 'talentProfile.BusinessTravel' })}
            options={[
              { label: formatMessage({ id: 'talentProfile.Accept' }), value: 'Open' },
              { label: formatMessage({ id: 'talentProfile.LimitedAccept' }), value: 'Limited' },
              { label: formatMessage({ id: 'talentProfile.NotConsider' }), value: 'Not Open' }
            ]}
            rule={rule}
          />,
          <RadioGroup
            name="workPreference.relocation_willingness"
            label={formatMessage({ id: 'talentProfile.RelocationWillingness' })}
            options={[
              { label: formatMessage({ id: 'talentProfile.Accept' }), value: 'Open' },
              { label: formatMessage({ id: 'talentProfile.LimitedAccept' }), value: 'Limited' },
              { label: formatMessage({ id: 'talentProfile.NotConsider' }), value: 'Not Open' }
            ]}
            rule={rule}
          />
        ]}
      />
    );
  })
);

export default MobilityPreferenceFormInner;
