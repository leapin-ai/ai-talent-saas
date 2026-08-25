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
import withLocale from '../withLocale';
import { useIntl } from '@kne/react-intl';

const HeaderCard = createWithRemoteLoader({
  modules: ['components-core:Image.Avatar', 'components-core:Enum', 'components-core:Common@AddressEnum', 'components-core:FormInfo@useFormModal']
})(
  withLocale(({ remoteModules, title, profileData, originData, saveEmployee, apis, readOnly }) => {
    const { formatMessage } = useIntl();
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
            readOnly ? null : (
              <Button
                type="text"
                size="small"
                className={style['edit-btn']}
                icon={<MdOutlineEdit />}
                onClick={() => {
                  const position = (originData.positionEnums || []).find(item => item.value === originData.options?.position);
                  const orgIdFromPosition = position?.tenantOrgId;
                  const orgIds = orgIdFromPosition ? [orgIdFromPosition] : Array.isArray(originData.tenantOrgIds) ? originData.tenantOrgIds : [];
                  const org = orgIds.length ? (originData.orgEnums || []).find(item => String(item.value) === String(orgIds[0])) : null;
                  formModal({
                    title: formatMessage({ id: 'talentProfile.EditPersonalInfo' }),
                    size: 'small',
                    formProps: {
                      data: Object.assign({}, originData, {
                        tenantOrgIds: org ? { name: org.description, id: org.value } : null,
                        options: Object.assign({}, originData.options, {
                          position: position ? { name: position.description, id: position.value } : null
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
            )
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
              {profileData.description || formatMessage({ id: 'talentProfile.NoPersonalIntro' })}
            </Flex>
          }
          phone={profileData.phone}
          email={profileData.email}
          moreInfo={[
            { label: formatMessage({ id: 'talentProfile.Department' }), content: profileData.department },
            { label: formatMessage({ id: 'talentProfile.Location' }), content: profileData.location ? <AddressEnum name={profileData.location} /> : null },
            { label: formatMessage({ id: 'talentProfile.Language' }), content: profileData.languages },
            { label: formatMessage({ id: 'talentProfile.Education' }), content: profileData.degree ? <Enum moduleName="degreeEnum" name={profileData.degree} /> : null },
            { label: formatMessage({ id: 'talentProfile.School' }), content: profileData.college },
            { label: formatMessage({ id: 'talentProfile.Major' }), content: profileData.major },
            { label: formatMessage({ id: 'talentProfile.Age' }), content: profileData.birthday ? dayjs().diff(profileData.birthday, 'year') : null },
            { label: formatMessage({ id: 'talentProfile.Gender' }), content: profileData.gender ? <Enum moduleName="gender" name={profileData.gender} /> : null },
            { label: formatMessage({ id: 'talentProfile.MaritalStatus' }), content: profileData.marital ? <Enum moduleName="marital" name={profileData.marital} /> : null }
          ].filter(({ content }) => !!content)}
        />
      </div>
    );
  })
);

export default HeaderCard;
