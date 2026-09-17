import { useIntl } from '@kne/react-intl';
import TargetPositionFormInner from '@components/TalentProfile/FormInner/TargetPositionFormInner';
import MobilityPreferenceFormInner from '@components/TalentProfile/FormInner/MobilityPreferenceFormInner';
import style from './style.module.scss';

const ReviewStep = ({ FormInfo, positionListApi, contactReadonly = false }) => {
  const { fields } = FormInfo;
  const { Input, PhoneNumber } = fields;
  const { formatMessage } = useIntl();

  return (
    <div className={style['review-layout']}>
      <div className={style['review-main']}>
        <FormInfo
          title={formatMessage({ id: 'tenantAdmin.completeContact' })}
          bordered
          column={2}
          list={[
            <Input name="name" label={formatMessage({ id: 'tenantAdmin.completeFullName' })} rule="REQ LEN-0-100" disabled={contactReadonly} />,
            <PhoneNumber name="phone" label={formatMessage({ id: 'tenantAdmin.completePhone' })} format="string" disabled={contactReadonly} />,
            <Input name="email" label={formatMessage({ id: 'tenantAdmin.completeEmail' })} rule="EMAIL LEN-0-100" disabled={contactReadonly} />
          ]}
        />
        <TargetPositionFormInner fieldName="intentionPosition" title={formatMessage({ id: 'tenantAdmin.completeTargetRole' })} bordered required={false} mode={positionListApi ? 'select' : 'input'} positionListApi={positionListApi} />
        <MobilityPreferenceFormInner title={formatMessage({ id: 'tenantAdmin.completePreferences' })} bordered required={false} />
      </div>
    </div>
  );
};

export default ReviewStep;
