import { useIntl } from '@kne/react-intl';
import TargetPositionFormInner from '@components/TalentProfile/FormInner/TargetPositionFormInner';
import MobilityPreferenceFormInner from '@components/TalentProfile/FormInner/MobilityPreferenceFormInner';
import style from './style.module.scss';

const ReviewStep = ({ FormInfo, positionListApi }) => {
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
            <Input name="name" label={formatMessage({ id: 'tenantAdmin.completeFullName' })} rule="REQ LEN-0-100" />,
            <PhoneNumber name="phone" label={formatMessage({ id: 'tenantAdmin.completePhone' })} format="string" />,
            <Input name="email" label={formatMessage({ id: 'tenantAdmin.completeEmail' })} rule="EMAIL LEN-0-100" />,
            <Input name="linkedin" label={formatMessage({ id: 'tenantAdmin.completePublicProfile' })} rule="LEN-0-200" />
          ]}
        />
        {/* <SkillFormInner namePrefix="skills" title={formatMessage({ id: 'tenantAdmin.completeSkills' })} bordered /> */}
        <TargetPositionFormInner fieldName="intentionPosition" title={formatMessage({ id: 'tenantAdmin.completeTargetRole' })} bordered required={false} mode="select" positionListApi={positionListApi} />
        <MobilityPreferenceFormInner title={formatMessage({ id: 'tenantAdmin.completePreferences' })} bordered required={false} />
      </div>
      {/* <div className={style['review-side']}>
        <div className={style['side-card']}>
          <div className={style['side-card-title']}>{formatMessage({ id: 'tenantAdmin.completeSource' })}</div>
          <div className={style['source-file']}>
            <div className={style['source-file-icon']}>
              <FileOutlined />
            </div>
            <div>
              <div className={style['source-file-name']}>{resumeFile?.filename || resumeFile?.originalName || '-'}</div>
              <div className={style['source-file-meta']}>{formatMessage({ id: 'tenantAdmin.completeFieldsParsed' }, { count: parsedCount })}</div>
            </div>
          </div>
        </div>
        {missingList.length > 0 ? (
          <div className={style['side-card']}>
            <div className={style['side-card-title']}>{formatMessage({ id: 'tenantAdmin.completeStillMissing' })}</div>
            <ul className={style['missing-list']}>
              {missingList.map(item => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        ) : null}
      </div> */}
    </div>
  );
};

export default ReviewStep;
