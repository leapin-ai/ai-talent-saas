import { createWithRemoteLoader } from '@kne/remote-loader';

const AdvantageFormInner = createWithRemoteLoader({
  modules: ['components-core:FormInfo']
})(({ remoteModules }) => {
  const [FormInfo] = remoteModules;
  const { List } = FormInfo;
  const { Input, TextArea } = FormInfo.fields;

  return <List title="优势" name="advantage" column={1} list={[<Input name="name" label="优势名称" rule="REQ LEN-0-100" />, <TextArea name="description" label="描述" rule="LEN-0-500" block />]} />;
});

export default AdvantageFormInner;
