import { createWithRemoteLoader } from '@kne/remote-loader';
import withLocale from '../withLocale';
import { useIntl } from '@kne/react-intl';
import PayDetails from '@kne/pay-details';
import { isMobile } from '@kne/system-layout';
import '@kne/pay-details/dist/index.css';
import { PAY_SALARY } from './index';

const BaseFormInner = createWithRemoteLoader({
  modules: ['components-core:FormInfo', 'components-admin:Editor']
})(
  withLocale(({ remoteModules, ...props }) => {
    const [FormInfo, Editor] = remoteModules;
    const { Input, Select, AddressSelect, FunctionSelect } = FormInfo.fields;
    const { formatMessage } = useIntl();
    const mobile = isMobile();
    return (
      <FormInfo
        {...props}
        column={1}
        list={[
          <Input name="name" label={formatMessage({ id: 'position.name' })} rule="REQ LEN-0-200" />,
          <Select
            name="language"
            label={formatMessage({ id: 'position.language' })}
            rule="REQ"
            options={[
              { label: formatMessage({ id: 'language.zh-CN' }), value: 'zh-CN' },
              { label: formatMessage({ id: 'language.en-US' }), value: 'en-US' }
            ]}
          />,
          <Select
            name="locationType"
            label={formatMessage({ id: 'position.locationType' })}
            rule="REQ"
            options={[
              { label: formatMessage({ id: 'locationType.on-site' }), value: 'on-site' },
              { label: formatMessage({ id: 'locationType.remote' }), value: 'remote' }
            ]}
          />,
          <AddressSelect
            name="location"
            label="城市"
            display={context => {
              const { formData } = context;
              return formData.locationType === 'on-site';
            }}
            isPopup={!mobile}
          />,
          <FunctionSelect name="capacity" label="职能" single isPopup={false} />,
          <PayDetails name="salary" label="薪资" defaultValue={{ currency: 'CNY' }} rule="PAY_SALARY" />,
          <Editor name="description" label={formatMessage({ id: 'position.description' })} block rule="LEN-0-1000" />,
          <Editor name="requirement" label={formatMessage({ id: 'position.requirement' })} block rule="LEN-0-1000" />
        ]}
      />
    );
  })
);

export default BaseFormInner;
