import { createWithRemoteLoader } from '@kne/remote-loader';
import withLocale from '../withLocale';
import { useIntl } from '@kne/react-intl';

const InterestFormInner = createWithRemoteLoader({
  modules: ['components-core:FormInfo']
})(
  withLocale(({ remoteModules }) => {
    const { formatMessage } = useIntl();
    const [FormInfo] = remoteModules;
    const { MultiField } = FormInfo;
    const { Input } = FormInfo.fields;

    return <FormInfo column={1} list={[<MultiField name="name" label={formatMessage({ id: 'talentProfile.Hobbies' })} rule="REQ LEN-0-100" field={Input} />]} />;
  })
);

export default InterestFormInner;
