import React from 'react';
import { createWithRemoteLoader } from '@kne/remote-loader';
import style from './style.module.scss';
import ProfileCard from './ProfileCard';
import MobilityCard from './MobilityCard';
import withLocale from './withLocale';
import { useIntl } from '@kne/react-intl';

const EmployeeInfoForm = createWithRemoteLoader({
  modules: ['components-core:FormInfo']
})(
  withLocale(({ remoteModules }) => {
    const [FormInfo] = remoteModules;
    const { Form, TableList } = FormInfo;
    const { Input } = FormInfo.fields;
    const { formatMessage } = useIntl();

    const avatarUrl =
      'https://lh3.googleusercontent.com/aida-public/AB6AXuC_AorCAIKZoI2DcahfuT4hT9GDUUaBpTlWUJr3Odohda9NuDi2rGCxWiHwow-OsNiPPrLtCIrMVU4Qgmrdt9H7-60ACubvKLb5EdJ8va-qaAPLMj_uaNUQ1Yolk_J-nfhIheltcXrRHkspotSFm3X6xjh9wKyM_NQYE_P3ACK6aNkJsUEoBca-5ursPSnyHnwZmAxZGHS2FUvH8E1piSMezqWm6H1XxWyU2Zm_G83zLtokX2mz2IOXE-TMwR6YKhDEbySePufNnvrE';

    const onFinish = values => {
      console.log(formatMessage({ id: 'employeeInfoForm.submitForm' }), values);
    };

    return (
      <Form onSubmit={onFinish} className={style['employee-info-form']} bordered>
        <div className={style.container}>
          <div className={style.grid}>
            <div className={style['left-column']}>
              <ProfileCard avatarUrl={avatarUrl} />
            </div>

            <div className={style['middle-column']}>
              <TableList
                reverseOrder={true}
                bordered
                name="targetPositions"
                title={formatMessage({ id: 'employeeInfoForm.targetPosition' })}
                list={[<Input name="position" label={formatMessage({ id: 'employeeInfoForm.targetPosition' })} placeholder={formatMessage({ id: 'employeeInfoForm.targetPositionPlaceholder' })} />]}
              />

              <TableList
                reverseOrder={true}
                bordered
                name="skills"
                title={formatMessage({ id: 'employeeInfoForm.skill' })}
                list={[<Input name="skill" label={formatMessage({ id: 'employeeInfoForm.skill' })} placeholder={formatMessage({ id: 'employeeInfoForm.skillPlaceholder' })} />]}
              />

              <TableList
                reverseOrder={true}
                bordered
                name="interests"
                title={formatMessage({ id: 'employeeInfoForm.interest' })}
                list={[<Input name="interest" label={formatMessage({ id: 'employeeInfoForm.interest' })} placeholder={formatMessage({ id: 'employeeInfoForm.interestPlaceholder' })} />]}
              />
            </div>

            <div className={style['right-column']}>
              <MobilityCard />

              <TableList
                reverseOrder={true}
                bordered
                name="certificates"
                title={formatMessage({ id: 'employeeInfoForm.certificateTitle' })}
                list={[<Input name="certificate" label={formatMessage({ id: 'employeeInfoForm.certificateName' })} placeholder={formatMessage({ id: 'employeeInfoForm.certificatePlaceholder' })} />]}
              />
            </div>
          </div>
        </div>
      </Form>
    );
  })
);

export { default as ProfileCard } from './ProfileCard';
export { default as TagInputCard } from './TagInputCard';
export { default as MobilityCard } from './MobilityCard';
export { default as CertificateCard } from './CertificateCard';

export default EmployeeInfoForm;
