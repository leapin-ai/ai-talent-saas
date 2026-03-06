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

const { Text } = Typography;

const LeftColumn = createWithRemoteLoader({
  modules: ['components-core:FormInfo@useFormModal']
})(({ remoteModules, saveProfile, profileData, advantages, certificates, promotionHistory, gotoPosition }) => {
  const [useFormModal] = remoteModules;
  const formModal = useFormModal();

  const EmptyState = ({ text }) => (
    <Text type="secondary" style={{ display: 'block', textAlign: 'center', padding: '20px 0' }}>
      {text || '暂无数据'}
    </Text>
  );

  return (
    <div className={style['left-column']}>
      <AdvantagesCard saveProfile={saveProfile} advantages={advantages} />

      <Card className={style['duration-card']}>
        <div>
          <Flex justify="space-between" className={style['card-title']}>
            <Space>
              <span className="anticon">
                <IoTimerOutline style={{ color: '#FFC300' }} />
              </span>
              <Text>任职时长</Text>
            </Space>
          </Flex>
          <Text className={style['duration-value']}>
            {profileData.serviceYears} <span className={style['duration-unit']}>年</span>
          </Text>
        </div>
        <Divider />
        <div>
          <Flex justify="space-between" className={style['card-title']}>
            <Space>
              <span className="anticon">
                <IoTimeOutline style={{ color: '#4ADE80' }} />
              </span>
              <Text>总工作年限</Text>
            </Space>
          </Flex>
          <Text className={style['duration-value']}>
            {profileData.totalWorkYears} <span className={style['duration-unit']}>年</span>
          </Text>
        </div>
      </Card>

      <Card className={style['certificates-card']}>
        <Flex justify="space-between" className={style['card-title']}>
          <Space>
            <span className="anticon">
              <MdOutlineDiamond style={{ color: '#FFC300' }} />
            </span>
            证书与执照
          </Space>
          <Button
            type="text"
            className={style['edit-btn']}
            icon={<MdOutlineEdit />}
            onClick={() => {
              formModal({
                title: '编辑证书与执照',
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
        </Flex>
        {certificates.length > 0 ? (
          <Space wrap>
            {certificates.map((cert, index) => (
              <Tag key={index}>{cert}</Tag>
            ))}
          </Space>
        ) : (
          <EmptyState text="暂无证书信息" />
        )}
      </Card>

      <Card className={style['promotion-card']}>
        <Flex justify="space-between" className={style['card-title']}>
          <Space>
            <span className="anticon">
              <FaAward style={{ color: '#111827C7' }} />
            </span>
            晋升历史
          </Space>
          <Button
            type="text"
            className={style['edit-btn']}
            icon={<MdOutlineEdit />}
            onClick={() => {
              formModal({
                title: '编辑晋升历史',
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
        </Flex>
        {promotionHistory.length > 0 ? (
          <Timeline
            className={style['timeline']}
            items={promotionHistory.map((item, index) => ({
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
          <EmptyState text="暂无晋升历史" />
        )}
      </Card>
    </div>
  );
});

export default LeftColumn;
