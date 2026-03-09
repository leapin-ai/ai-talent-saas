import { createWithRemoteLoader } from '@kne/remote-loader';

const SkillFormInner = createWithRemoteLoader({
  modules: ['components-core:FormInfo']
})(({ remoteModules }) => {
  const [FormInfo] = remoteModules;
  const { MultiField } = FormInfo;
  const { Input } = FormInfo.fields;

  return (
    <FormInfo
      column={1}
      list={[
        <MultiField name="cert_mapped" label="执照相关" rule="LEN-0-200" field={Input} />,
        <MultiField name="interest_strength" label="兴趣相关" rule="LEN-0-200" field={Input} />,
        <MultiField name="work_related" label="工作相关" rule="LEN-0-200" field={Input} />
      ]}
    />
  );
});

export default SkillFormInner;
