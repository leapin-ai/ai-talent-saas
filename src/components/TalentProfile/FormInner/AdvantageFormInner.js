import { createWithRemoteLoader } from '@kne/remote-loader';
import withLocale from '../withLocale';
import { useIntl } from '@kne/react-intl';

const AdvantageFormInner = createWithRemoteLoader({
  modules: ['components-core:FormInfo']
})(
  withLocale(({ remoteModules }) => {
    const { formatMessage } = useIntl();
    const [FormInfo] = remoteModules;
    const { List } = FormInfo;
    const { Input, TextArea } = FormInfo.fields;

    return (
      <List
        title={formatMessage({ id: 'talentProfile.Advantages' })}
        name="advantage"
        column={1}
        list={[<Input name="name" label={formatMessage({ id: 'talentProfile.AdvantageName' })} rule="REQ LEN-0-100" />, <TextArea name="description" label={formatMessage({ id: 'talentProfile.Description' })} rule="LEN-0-500" block />]}
      />
    );
  })
);

export default AdvantageFormInner;
