import { createWithRemoteLoader } from '@kne/remote-loader';
import withLocale from '../withLocale';
import { useIntl } from '@kne/react-intl';

const CertificateFormInner = createWithRemoteLoader({
  modules: ['components-core:FormInfo']
})(
  withLocale(({ remoteModules }) => {
    const { formatMessage } = useIntl();
    const [FormInfo] = remoteModules;
    const { MultiField } = FormInfo;
    const { Input } = FormInfo.fields;

    return <FormInfo column={1} list={[<MultiField name="certificates" label={formatMessage({ id: 'talentProfile.CertificateName' })} rule="REQ LEN-0-200" field={Input} />]} />;
  })
);

export default CertificateFormInner;
