import React from 'react';
import { Flex, Typography, Button } from 'antd';
import style from '../style.module.scss';
import TalentCard from '../TalentCard';

const { Title } = Typography;

const TalentGrid = ({ talents, onViewProfile, onMoreProfile }) => {
  return (
    <section className={style['section-grid']}>
      <Flex justify="space-between" align="center" className={style['section-header']}>
        <Title level={3}>推荐候选人</Title>
      </Flex>

      <div className={style['talent-grid']}>
        {talents.map(talent => (
          <TalentCard key={talent.id} talent={talent} onViewProfile={onViewProfile} />
        ))}
      </div>

      <Flex justify="center" className={style['load-more']}>
        <Button onClick={onMoreProfile}>查看更多人才</Button>
      </Flex>
    </section>
  );
};

export default TalentGrid;
