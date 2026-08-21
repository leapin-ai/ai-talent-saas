import { FileOutlined } from '@ant-design/icons';
import { useIntl } from '@kne/react-intl';
import style from './style.module.scss';

const ReviewStep = ({ FormInfo, resumeFile, parsedCount = 0, missing = [] }) => {
  const { fields } = FormInfo;
  const { Input, PhoneNumber, Select } = fields;
  const { formatMessage } = useIntl();
  const missingList = Array.isArray(missing) ? missing : [];

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
        <FormInfo
          title={formatMessage({ id: 'tenantAdmin.completeSkills' })}
          bordered
          column={1}
          list={[<Select name="skills" label={formatMessage({ id: 'tenantAdmin.completeSkills' })} mode="tags" placeholder={formatMessage({ id: 'tenantAdmin.completeAddSkill' })} />]}
        />
        <FormInfo
          title={formatMessage({ id: 'tenantAdmin.completePreferences' })}
          bordered
          column={2}
          list={[
            <Input name="options.targetRole" label={formatMessage({ id: 'tenantAdmin.completeTargetRole' })} rule="LEN-0-100" />,
            <Input name="options.workMode" label={formatMessage({ id: 'tenantAdmin.completeWorkMode' })} rule="LEN-0-100" />,
            <Input name="options.openTravel" label={formatMessage({ id: 'tenantAdmin.completeOpenTravel' })} rule="LEN-0-100" />,
            <Input name="options.openRelocation" label={formatMessage({ id: 'tenantAdmin.completeOpenRelocation' })} rule="LEN-0-100" />
          ]}
        />
      </div>
      <div className={style['review-side']}>
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
      </div>
    </div>
  );
};

export default ReviewStep;
