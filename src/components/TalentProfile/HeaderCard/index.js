import React, { useState } from 'react';
import { createWithRemoteLoader } from '@kne/remote-loader';
import { Button, Drawer } from 'antd';
import { useIsMobile } from '@kne/responsive-utils';
import { Card } from '@kne/react-box';
import '@kne/react-box/dist/index.css';
import style from '../style.module.scss';
import { MdOutlineEdit } from 'react-icons/md';
import { EmployeeFormInner } from '@components/Employee';
import withLocale from '../withLocale';
import { useIntl } from '@kne/react-intl';
import ProfileEvidence from '../ProfileEvidence';
import iconPhone from '../assets/icon-phone.svg';
import iconEmail from '../assets/icon-email.svg';
import iconLinkedin from '../assets/icon-linkedin.svg';

const ContactItem = ({ icon, children }) => {
  if (!children) {
    return null;
  }
  return (
    <span className={style['ph-contact']}>
      <img className={style['ph-contact-icon']} src={icon} alt="" width={18} height={18} />
      <span>{children}</span>
    </span>
  );
};

const CompletionRing = ({ value, formatMessage }) => {
  const pct = Math.min(100, Math.max(0, Math.round(Number(value) || 0)));
  const size = 100;
  const stroke = 8;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - pct / 100);

  return (
    <div className={style['ph-ring']} aria-label={formatMessage({ id: 'talentProfile.completionAria' }, { percent: pct })}>
      <svg className={style['ph-ring-svg']} width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#E8EAF6" strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#5B6CFF" strokeWidth={stroke} strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={offset} transform={`rotate(-90 ${size / 2} ${size / 2})`} />
      </svg>
      <div className={style['ph-ring-label']}>
        <div className={style['ph-ring-value']}>
          <span className={style['ph-ring-num']}>{pct}</span>
          <span className={style['ph-ring-pct']}>%</span>
        </div>
        <div className={style['ph-ring-caption']}>{formatMessage({ id: 'talentProfile.completionCaption' })}</div>
      </div>
    </div>
  );
};

const openEditModal = ({ formModal, formatMessage, originData, saveEmployee, apis }) => {
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
};

const HeaderCard = createWithRemoteLoader({
  modules: ['components-core:Image.Avatar', 'components-core:FormInfo@useFormModal']
})(
  withLocale(({ remoteModules, profileData, originData, saveEmployee, apis, readOnly, percent, checklist, employeeId, onPositionClick }) => {
    const { formatMessage } = useIntl();
    const [Avatar, useFormModal] = remoteModules;
    const [sourcesOpen, setSourcesOpen] = useState(false);
    const formModal = useFormModal();
    const mobile = useIsMobile();
    const pct = Math.min(100, Math.max(0, Math.round(Number(percent) || 0)));

    const positionNode = profileData.position ? (
      onPositionClick ? (
        <button type="button" className={style['ph-position-btn']} onClick={onPositionClick}>
          {profileData.position}
        </button>
      ) : (
        <span>{profileData.position}</span>
      )
    ) : null;

    return (
      <>
        <Card className={style['profile-header-card']} theme="talentInfo" hover={false} border>
          <div className={style['ph-banner']}>
            <div className={style['ph-main']}>
              <div className={style['ph-avatar']}>
                <Avatar id={profileData.avatar} size={60} gender={originData?.gender || 'M'} />
              </div>
              <div className={style['ph-info']}>
                <div className={style['ph-identity']}>
                  <div className={style['ph-name-row']}>
                    <span className={style['ph-name']}>{profileData.name}</span>
                    {!readOnly ? <Button type="text" size="small" className={style['edit-btn']} icon={<MdOutlineEdit />} onClick={() => openEditModal({ formModal, formatMessage, originData, saveEmployee, apis })} /> : null}
                  </div>
                  {(positionNode || profileData.department) && (
                    <div className={style['ph-role']}>
                      {positionNode}
                      {positionNode && profileData.department ? <span className={style['ph-role-sep']}>|</span> : null}
                      {profileData.department ? <span>{profileData.department}</span> : null}
                    </div>
                  )}
                </div>
                <div className={style['ph-contact-row']}>
                  <ContactItem icon={iconPhone}>{profileData.phone}</ContactItem>
                  <ContactItem icon={iconEmail}>{profileData.email}</ContactItem>
                  <ContactItem icon={iconLinkedin}>{profileData.linkedin}</ContactItem>
                </div>
              </div>
            </div>
            <div className={style['ph-aside']}>
              <CompletionRing value={pct} formatMessage={formatMessage} />
              <div className={style['ph-aside-copy']}>
                <div className={style['ph-aside-text']}>
                  <div className={style['ph-aside-title']}>{formatMessage({ id: 'talentProfile.profileDataDetails' })}</div>
                  <div className={style['ph-aside-desc']}>{formatMessage({ id: 'talentProfile.completionHint' })}</div>
                </div>
                <button type="button" className={style['ph-aside-btn']} onClick={() => setSourcesOpen(true)}>
                  {formatMessage({ id: 'talentProfile.viewSources' })}
                </button>
              </div>
            </div>
          </div>
        </Card>
        <Drawer title={formatMessage({ id: 'talentProfile.viewSources' })} open={sourcesOpen} onClose={() => setSourcesOpen(false)} width={mobile ? '100%' : 420} destroyOnClose>
          <ProfileEvidence employeeId={employeeId} percent={percent} checklist={checklist} variant="sources" />
        </Drawer>
      </>
    );
  })
);

export default HeaderCard;
