import React from 'react';
import { Card, Input, Button, Flex, Space, Typography } from 'antd';
import { FaPlus } from 'react-icons/fa';
import { MdDeleteOutline, MdCardMembership } from 'react-icons/md';
import style from '../style.module.scss';

const { Title } = Typography;

const CertificateCard = ({ items, onAdd, onRemove, onItemChange }) => {
  return (
    <Card className={style['section-card']} style={{ minHeight: '300px' }}>
      <Flex align="center" gap={8} className={style['card-header']}>
        <MdCardMembership className={style['card-icon-yellow']} />
        <Title level={4}>证书与执照</Title>
      </Flex>
      <Space direction="vertical" className={style['tag-list']}>
        {items.map((item, index) => (
          <Flex key={index} align="center" gap={8}>
            <Input placeholder="请输入证书名称" value={item} onChange={e => onItemChange(index, e.target.value)} />
            <Button type="text" danger icon={<MdDeleteOutline />} onClick={() => onRemove(index)} />
          </Flex>
        ))}
        <Button type="dashed" icon={<FaPlus />} onClick={onAdd} className={style['add-button']}>
          添加
        </Button>
      </Space>

      {items.length === 0 && (
        <Flex vertical align="center" justify="center" className={style['empty-state']}>
          <MdCardMembership className={style['empty-icon']} />
          <Typography.Text type="secondary">暂无证书记录</Typography.Text>
        </Flex>
      )}
    </Card>
  );
};

export default CertificateCard;
