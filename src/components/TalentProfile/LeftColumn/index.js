import React from 'react';
import { createWithRemoteLoader } from '@kne/remote-loader';
import { Card, Typography, Space, Timeline, Flex, Divider, Tag, Button } from 'antd';
import { IoTimerOutline, IoTimeOutline } from 'react-icons/io5';
import { FaAward } from 'react-icons/fa';
import { MdOutlineDiamond, MdOutlineEdit } from 'react-icons/md';
import classnames from 'classnames';
import style from '../style.module.scss';
import AdvantagesCard from '../AdvantagesCard';
import { CertificateFormInner, PromotionHistoryFormInner } from '../FormInner';
import dayjs from 'dayjs';
import withLocale from '../withLocale';
import { useIntl } from '@kne/react-intl';

const { Text } = Typography;

const LeftColumn = createWithRemoteLoader({
  modules: ['components-core:FormInfo@useFormModal']
})(
  withLocale(({ remoteModules, saveProfile, profileData, advantages, certificates, promotionHistory, gotoPosition, readOnly }) => {
    const { formatMessage } = useIntl();
    const [useFormModal] = remoteModules;
    const formModal = useFormModal();

    const EmptyState = ({ text }) => (
      <Text type="secondary" style={{ display: 'block', textAlign: 'center', padding: '20px 0' }}>
        {text || formatMessage({ id: 'talentProfile.NoData' })}
      </Text>
    );

    return (
      <div className={style['left-column']}>
        <AdvantagesCard readOnly={readOnly} saveProfile={saveProfile} advantages={advantages} />

        <Card className={style['duration-card']}>
          <div>
            <Flex justify="space-between" className={style['card-title']}>
              <Space>
                <span className="anticon">
                  <IoTimerOutline style={{ color: '#FFC300' }} />
                </span>
                <Text>{formatMessage({ id: 'talentProfile.ServiceDuration' })}</Text>
              </Space>
            </Flex>
            <Text className={style['duration-value']}>
              {profileData.serviceYears} <span className={style['duration-unit']}>{formatMessage({ id: 'talentProfile.YearUnit' })}</span>
            </Text>
          </div>
          <Divider />
          <div>
            <Flex justify="space-between" className={style['card-title']}>
              <Space>
                <span className="anticon">
                  <IoTimeOutline style={{ color: '#4ADE80' }} />
                </span>
                <Text>{formatMessage({ id: 'talentProfile.TotalWorkYears' })}</Text>
              </Space>
            </Flex>
            <Text className={style['duration-value']}>
              {profileData.totalWorkYears} <span className={style['duration-unit']}>{formatMessage({ id: 'talentProfile.YearUnit' })}</span>
            </Text>
          </div>
        </Card>

        <Card className={style['certificates-card']}>
          <Flex justify="space-between" className={style['card-title']}>
            <Space>
              <span className="anticon">
                <MdOutlineDiamond style={{ color: '#FFC300' }} />
              </span>
              {formatMessage({ id: 'talentProfile.Certificates' })}
            </Space>
            {!readOnly && (
              <Button
                type="text"
                className={style['edit-btn']}
                icon={<MdOutlineEdit />}
                onClick={() => {
                  formModal({
                    title: formatMessage({ id: 'talentProfile.EditCertificates' }),
                    size: 'small',
                    formProps: {
                      data: {
                        certificates
                      },
                      onSubmit: formData => {
                        return saveProfile({
                          options: {
                            certificates_licenses: formData.certificates
                          }
                        });
                      }
                    },
                    children: <CertificateFormInner />
                  });
                }}
              />
            )}
          </Flex>
          {certificates.length > 0 ? (
            <Space wrap>
              {certificates.map((cert, index) => (
                <Tag key={index}>{cert}</Tag>
              ))}
            </Space>
          ) : (
            <EmptyState text={formatMessage({ id: 'talentProfile.NoCertificates' })} />
          )}
        </Card>

        <Card className={style['promotion-card']}>
          <Flex justify="space-between" className={style['card-title']}>
            <Space>
              <span className="anticon">
                <FaAward style={{ color: '#111827C7' }} />
              </span>
              {formatMessage({ id: 'talentProfile.PromotionHistory' })}
            </Space>
            {!readOnly && (
              <Button
                type="text"
                className={style['edit-btn']}
                icon={<MdOutlineEdit />}
                onClick={() => {
                  formModal({
                    title: formatMessage({ id: 'talentProfile.EditPromotionHistory' }),
                    formProps: {
                      data: {
                        promotionHistory: (promotionHistory || []).map(item => ({
                          time: item.period,
                          occupation: item.position,
                          level: item.level
                        }))
                      },
                      onSubmit: formData => {
                        return saveProfile({
                          promotionHistory: (formData.promotionHistory || []).map(item =>
                            Object.assign({}, item, {
                              time: dayjs(item.time).format('YYYY-MM')
                            })
                          )
                        });
                      }
                    },
                    children: <PromotionHistoryFormInner />
                  });
                }}
              />
            )}
          </Flex>
          {promotionHistory.length > 0 ? (
            <Timeline
              className={style['timeline']}
              items={[...promotionHistory]
                .sort((a, b) => dayjs(b.period).valueOf() - dayjs(a.period).valueOf())
                .map((item, index) => ({
                  dot: <span className={classnames(style['timeline-dot'], index === 0 && style['timeline-dot-active'])} />,
                  children: (
                    <div key={index} className={style['promotion-item']}>
                      <Text className={classnames(style['promotion-period'], index === 0 && style['promotion-period-active'])}>{item.period}</Text>
                      <div>
                        <Typography.Text strong onClick={() => item.positionId && gotoPosition(item.positionId)}>
                          {item.position}
                          {item.level ? `(${item.level})` : ''}
                        </Typography.Text>
                        <br />
                        <Text type="secondary">{item.department}</Text>
                      </div>
                    </div>
                  )
                }))}
            />
          ) : (
            <EmptyState text={formatMessage({ id: 'talentProfile.NoPromotionHistory' })} />
          )}
        </Card>
      </div>
    );
  })
);

export default LeftColumn;
