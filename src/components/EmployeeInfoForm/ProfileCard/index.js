import React from 'react';
import { Card } from 'antd';
import { createWithRemoteLoader } from '@kne/remote-loader';
import { FaCamera, FaUser, FaPhone, FaEnvelope, FaLinkedin, FaMapMarkerAlt, FaGlobe } from 'react-icons/fa';
import style from '../style.module.scss';

const ProfileCard = createWithRemoteLoader({
  modules: ['components-core:FormInfo']
})(({ remoteModules, avatarUrl }) => {
  const [FormInfo] = remoteModules;
  const { Input, Avatar, SuperSelect, AddressSelect } = FormInfo.fields;

  const languageOptions = [
    { label: '中文', value: 'zh-CN' },
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
          <Input name="name" label="姓名" rule="REQ" prefix={<FaUser />} />,
          <Input name="phone" label="联系电话" rule="PHONE" prefix={<FaPhone />} />,
          <Input name="email" label="邮箱" rule="EMAIL" prefix={<FaEnvelope />} />,
          <Input name="linkedin" label="公开档案链接" prefix={<FaLinkedin />} />,
          <AddressSelect name="location" label="所在地" single prefix={<FaMapMarkerAlt />} />,
          <SuperSelect name="languages" label="语言" options={languageOptions} single prefix={<FaGlobe />} />
        ]}
      />
    </Card>
  );
});

export default ProfileCard;
