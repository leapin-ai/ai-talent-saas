import React from 'react';
import { Card, Input, Button, Flex, Space, Typography } from 'antd';
import { FaPlus } from 'react-icons/fa';
import { MdDeleteOutline } from 'react-icons/md';
import style from '../style.module.scss';

const { Title } = Typography;

const TagInputCard = ({ title, icon, items, onAdd, onRemove, onItemChange, placeholder, buttonClassName }) => {
  return (
    <Card className={style['section-card']}>
      <Flex align="center" gap={8} className={style['card-header']}>
        {icon && <span>{icon}</span>}
        <Title level={4}>{title}</Title>
      </Flex>
      <Space direction="vertical" className={style['tag-list']}>
        {items.map((item, index) => (
          <Flex key={index} align="center" gap={8}>
            <Input placeholder={placeholder} value={item} onChange={e => onItemChange(index, e.target.value)} />
            <Button type="text" danger icon={<MdDeleteOutline />} onClick={() => onRemove(index)} />
          </Flex>
        ))}
        <Button type="dashed" icon={<FaPlus />} onClick={onAdd} className={buttonClassName || style['add-button']}>
          添加
        </Button>
      </Space>
    </Card>
  );
};

export default TagInputCard;
