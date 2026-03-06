import { createWithRemoteLoader } from '@kne/remote-loader';

const MobilityPreferenceFormInner = createWithRemoteLoader({
  modules: ['components-core:FormInfo']
})(({ remoteModules }) => {
  const [FormInfo] = remoteModules;
  const { RadioGroup } = FormInfo.fields;

  return (
    <FormInfo
      column={1}
      list={[
        <RadioGroup
          name="workPreference.work_mode_preference"
          label="工作模式偏好"
          options={[
            { label: '混合办公', value: 'Hybrid Work' },
            { label: '远程办公', value: 'Remote' },
            { label: '办公室办公', value: 'On-site' }
          ]}
          rule="REQ"
        />,
        <RadioGroup
          name="workPreference.business_travel_willingness"
          label="出差意愿"
          options={[
            { label: '接受', value: 'Open' },
            { label: '有限接受', value: 'Limited' },
            { label: '暂不考虑', value: 'Not Open' }
          ]}
          rule="REQ"
        />,
        <RadioGroup
          name="workPreference.relocation_willingness"
          label="外派意愿"
          options={[
            { label: '接受', value: 'Open' },
            { label: '有限接受', value: 'Limited' },
            { label: '暂不考虑', value: 'Not Open' }
          ]}
          rule="REQ"
        />
      ]}
    />
  );
});

export default MobilityPreferenceFormInner;
