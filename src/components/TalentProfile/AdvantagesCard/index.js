import React from 'react';
import { IoMdTrendingUp } from 'react-icons/io';
import { MdOutlineEdit } from 'react-icons/md';
import { Card, Typography, Space, Flex, Button } from 'antd';
import classnames from 'classnames';
import style from '../style.module.scss';

const { Text } = Typography;

const AdvantagesCard = ({ advantages }) => {
  const EmptyState = ({ text }) => (
    <Text type="secondary" style={{ display: 'block', textAlign: 'center', padding: '20px 0' }}>
      {text || '暂无数据'}
    </Text>
  );

  return (
    <Card className={style['advantages-card']}>
      <Flex justify="space-between" className={style['card-title']}>
        <Space>
          <IoMdTrendingUp />
          <span>优势</span>
        </Space>
        <Button type="text" icon={<MdOutlineEdit />} />
      </Flex>
      {advantages && advantages.length > 0 ? (
        advantages.map((advantage, index) => (
          <div key={index} className={classnames(style['advantage-item'], style[`advantage-${advantage.color}`])}>
            <Space className={style['advantage-header']}>
              <Text strong>{advantage.title}</Text>
            </Space>
            <ul className={style['advantage-list']}>
              {advantage.description && <li>{advantage.description}</li>}
              {advantage.items && advantage.items.map((item, i) => <li key={i}>{item}</li>)}
            </ul>
          </div>
        ))
      ) : (
        <EmptyState text="暂无优势信息" />
      )}
    </Card>
  );
};

export default AdvantagesCard;
