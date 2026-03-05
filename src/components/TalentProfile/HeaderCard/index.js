import React from 'react';
import { createWithRemoteLoader } from '@kne/remote-loader';
import { isMobile } from '@kne/system-layout';
import { Flex } from 'antd';
import { PersonalCard } from '@kne/react-box';
import { IoMdLink } from 'react-icons/io';
import dayjs from 'dayjs';
import '@kne/react-box/dist/index.css';
import style from '../style.module.scss';

const HeaderCard = createWithRemoteLoader({
  modules: ['components-core:Image.Avatar', 'components-core:Enum']
})(({ remoteModules, title, profileData }) => {
  const [Avatar, Enum] = remoteModules;
  const mobile = isMobile();
  return (
    <PersonalCard
      mode={mobile ? 'vertical' : 'horizontal'}
      avatar={props => (
        <div className={style['header-avatar']}>
          <Avatar {...props} id={profileData.avatar} />
        </div>
      )}
      name={profileData.name}
      title={title || profileData.position}
      description={
        <Flex vertical>
          {profileData.linkedin && (
            <Flex gap={8}>
              <span className="anticon">
                <IoMdLink />
              </span>
              <span>{profileData.linkedin}</span>
            </Flex>
          )}
          {profileData.description || '暂无个人简介'}
        </Flex>
      }
      phone={profileData.phone}
      email={profileData.email}
      moreInfo={[
        { label: '部门', content: profileData.department },
        { label: '地点', content: profileData.location },
        { label: '语言', content: profileData.languages },
        { label: '学历', content: profileData.degree ? <Enum moduleName="degreeEnum" name={profileData.degree} /> : null },
        { label: '毕业院校', content: profileData.college },
        { label: '专业', content: profileData.major },
        { label: '年龄', content: profileData.birthday ? dayjs().diff(profileData.birthday, 'year') : null },
        { label: '性别', content: profileData.gender ? <Enum moduleName="gender" name={profileData.gender} /> : null },
        { label: '婚姻状况', content: profileData.marital ? <Enum moduleName="marital" name={profileData.marital} /> : null }
      ].filter(({ content }) => !!content)}
      status="online"
    />
  );
});

export default HeaderCard;
