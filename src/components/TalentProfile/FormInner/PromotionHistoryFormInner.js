import { createWithRemoteLoader } from '@kne/remote-loader';
import withLocale from '../withLocale';
import { useIntl } from '@kne/react-intl';

const PromotionHistoryFormInner = createWithRemoteLoader({
  modules: ['components-core:FormInfo']
})(
  withLocale(({ remoteModules }) => {
    const { formatMessage } = useIntl();
    const [FormInfo] = remoteModules;
    const { TableList } = FormInfo;
    const { DatePicker, Input } = FormInfo.fields;

    return (
      <TableList
        name="promotionHistory"
        title={formatMessage({ id: 'talentProfile.PromotionHistory' })}
        list={[
          <DatePicker name="time" label={formatMessage({ id: 'talentProfile.PromotionTime' })} picker="month" format="YYYY-MM" rule="REQ" />,
          <Input name="occupation" label={formatMessage({ id: 'talentProfile.PositionName' })} rule="REQ LEN-0-100" />,
          <Input name="level" label={formatMessage({ id: 'talentProfile.PromotionLevel' })} rule="LEN-0-100" />
        ]}
      />
    );
  })
);

export default PromotionHistoryFormInner;
