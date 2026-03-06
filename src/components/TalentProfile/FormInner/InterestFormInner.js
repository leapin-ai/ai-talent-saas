import { createWithRemoteLoader } from '@kne/remote-loader';

const InterestFormInner = createWithRemoteLoader({
  modules: ['components-core:FormInfo']
})(({ remoteModules }) => {
  const [FormInfo] = remoteModules;
  const { MultiField } = FormInfo;
  const { Input } = FormInfo.fields;

  return <FormInfo column={1} list={[<MultiField name="name" label="兴趣爱好" rule="REQ LEN-0-100" field={Input} />]} />;
});

export default InterestFormInner;
