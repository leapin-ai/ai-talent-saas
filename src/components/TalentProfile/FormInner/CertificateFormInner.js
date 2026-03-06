import { createWithRemoteLoader } from '@kne/remote-loader';

const CertificateFormInner = createWithRemoteLoader({
  modules: ['components-core:FormInfo']
})(({ remoteModules }) => {
  const [FormInfo] = remoteModules;
  const { MultiField } = FormInfo;
  const { Input } = FormInfo.fields;

  return <FormInfo column={1} list={[<MultiField name="certificates" label="证书名称" rule="REQ LEN-0-200" field={Input} />]} />;
});

export default CertificateFormInner;
