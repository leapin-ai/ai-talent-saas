import { createWithRemoteLoader } from '@kne/remote-loader';

const TargetPositionFormInner = createWithRemoteLoader({
  modules: ['components-core:FormInfo']
})(({ remoteModules }) => {
  const [FormInfo] = remoteModules;
  const { MultiField } = FormInfo;
  const { Input } = FormInfo.fields;

  return <FormInfo column={1} list={[<MultiField name="name" label="岗位名称" rule="REQ LEN-0-100" field={Input} />]} />;
});

export default TargetPositionFormInner;
