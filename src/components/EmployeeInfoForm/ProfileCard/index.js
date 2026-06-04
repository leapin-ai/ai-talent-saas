import React from 'react';
import { createWithRemoteLoader } from '@kne/remote-loader';
import { Card } from 'antd';
import { FaCamera, FaUser, FaPhone, FaEnvelope, FaLinkedin, FaMapMarkerAlt, FaGlobe } from 'react-icons/fa';
import style from '../style.module.scss';
import withLocale from '../withLocale';
import { useIntl } from '@kne/react-intl';

const ProfileCard = createWithRemoteLoader({
  modules: ['components-core:FormInfo']
})(
  withLocale(({ remoteModules, avatarUrl }) => {
    const [FormInfo] = remoteModules;
    const { Input, Avatar, SuperSelect, AddressSelect } = FormInfo.fields;
    const { formatMessage } = useIntl();

    const languageOptions = [
      { label: formatMessage({ id: 'employeeInfoForm.languageChinese' }), value: 'zh-CN' },
      { label: 'English', value: 'en-US' },
      { label: '日本語', value: 'ja-JP' },
      { label: '한국어', value: 'ko-KR' },
      { label: 'Français', value: 'fr-FR' },
      { label: 'Deutsch', value: 'de-DE' },
      { label: 'Español', value: 'es-ES' }
    ];

    return (
      <Card className={style['profile-card']}>
        <div className={style['avatar-section']}>
          <Avatar name="avatar" src={avatarUrl} size={128} rule="REQ" />
          <div className={style['avatar-button']}>
            <FaCamera />
          </div>
        </div>
        <FormInfo
          className={style['form-info']}
          column={1}
          list={[
            <Input name="name" label={formatMessage({ id: 'employeeInfoForm.name' })} rule="REQ" prefix={<FaUser />} />,
            <Input name="phone" label={formatMessage({ id: 'employeeInfoForm.phone' })} rule="PHONE" prefix={<FaPhone />} />,
            <Input name="email" label={formatMessage({ id: 'employeeInfoForm.email' })} rule="EMAIL" prefix={<FaEnvelope />} />,
            <Input name="linkedin" label={formatMessage({ id: 'employeeInfoForm.linkedin' })} prefix={<FaLinkedin />} />,
            <AddressSelect name="location" label={formatMessage({ id: 'employeeInfoForm.location' })} single prefix={<FaMapMarkerAlt />} />,
            <SuperSelect name="languages" label={formatMessage({ id: 'employeeInfoForm.language' })} options={languageOptions} single prefix={<FaGlobe />} />
          ]}
        />
      </Card>
    );
  })
);

export default ProfileCard;
