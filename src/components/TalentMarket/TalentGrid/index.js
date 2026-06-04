import React from 'react';
import { Flex, Typography, Button } from 'antd';
import style from '../style.module.scss';
import TalentCard from '../TalentCard';
import withLocale from '../withLocale';
import { useIntl } from '@kne/react-intl';

const { Title } = Typography;

const TalentGrid = withLocale(({ talents, onViewProfile, onMoreProfile }) => {
  const { formatMessage } = useIntl();
  return (
    <section className={style['section-grid']}>
      <Flex justify="space-between" align="center" className={style['section-header']}>
        <Title level={3}>{formatMessage({ id: 'talentMarket.Recommend' })}</Title>
      </Flex>

      <div className={style['talent-grid']}>
        {talents.map(talent => (
          <TalentCard key={talent.id} talent={talent} onViewProfile={onViewProfile} />
        ))}
      </div>

      <Flex justify="center" className={style['load-more']}>
        <Button onClick={onMoreProfile}>{formatMessage({ id: 'talentMarket.ViewMoreTalents' })}</Button>
      </Flex>
    </section>
  );
});

export default TalentGrid;
