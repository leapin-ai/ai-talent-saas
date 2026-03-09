import React, { useEffect, useState } from 'react';
import { createWithRemoteLoader } from '@kne/remote-loader';
import { isMobile } from '@kne/system-layout';
import { Flex, Button } from 'antd';
import useResize from '@kne/use-resize';
import { PersonalCard } from '@kne/react-box';
import { IoMdLink } from 'react-icons/io';
import dayjs from 'dayjs';
import '@kne/react-box/dist/index.css';
import style from '../style.module.scss';
import { MdOutlineEdit } from 'react-icons/md';
import { EmployeeFormInner } from '@components/Employee';

const HeaderCard = createWithRemoteLoader({
  modules: ['components-core:Image.Avatar', 'components-core:Enum', 'components-core:Common@AddressEnum', 'components-core:FormInfo@useFormModal']
})(({ remoteModules, title, profileData, originData, saveEmployee, apis }) => {
  const [Avatar, Enum, AddressEnum, useFormModal] = remoteModules;
  const [width, setWidth] = useState(window.innerWidth - 302);
  const formModal = useFormModal();
  const mobile = isMobile();
  const ref = useResize(el => {
    setWidth(el.clientWidth);
  });
  useEffect(() => {
    ref.current && setWidth(ref.current.clientWidth);
  }, [ref]);
  return (
    <div ref={ref}>
      <PersonalCard
        mode={mobile || width < 768 ? 'vertical' : 'horizontal'}
        avatar={props => (
          <div className={style['header-avatar']}>
            <Avatar {...props} id={profileData.avatar} />
          </div>
        )}
        name={profileData.name}
        badge={
          <Button
            type="text"
            size="small"
            className={style['edit-btn']}
            icon={<MdOutlineEdit />}
            onClick={() => {
              const tenantOrg = originData.orgEnums.find(item => item.value === originData.options?.tenantOrgId);
              const position = originData.positionEnums.find(item => item.value === originData.options?.position);
              formModal({
                title: '编辑个人信息',
                size: 'small',
                formProps: {
                  data: Object.assign({}, originData, {
                    options: Object.assign({}, originData.options, {
                      position: position ? { name: position.description, id: position.value } : null,
                      tenantOrgId: tenantOrg ? { name: tenantOrg.description, id: tenantOrg.value } : null
                    })
                  }),
                  onSubmit: async formData => {
                    return saveEmployee(formData);
                  }
                },
                children: <EmployeeFormInner apis={apis} action="edit" />
              });
            }}
          />
        }
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
          { label: '地点', content: profileData.location ? <AddressEnum name={profileData.location} /> : null },
          { label: '语言', content: profileData.languages },
          { label: '学历', content: profileData.degree ? <Enum moduleName="degreeEnum" name={profileData.degree} /> : null },
          { label: '毕业院校', content: profileData.college },
          { label: '专业', content: profileData.major },
          { label: '年龄', content: profileData.birthday ? dayjs().diff(profileData.birthday, 'year') : null },
          { label: '性别', content: profileData.gender ? <Enum moduleName="gender" name={profileData.gender} /> : null },
          { label: '婚姻状况', content: profileData.marital ? <Enum moduleName="marital" name={profileData.marital} /> : null }
        ].filter(({ content }) => !!content)}
      />
    </div>
  );
});

export default HeaderCard;
