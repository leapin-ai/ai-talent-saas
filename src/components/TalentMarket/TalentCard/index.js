import React from 'react';
import { Card, Tag, Flex, Typography, Button } from 'antd';
import { createWithRemoteLoader } from '@kne/remote-loader';
import classnames from 'classnames';
import style from '../style.module.scss';

const { Title, Text } = Typography;

const TalentCard = createWithRemoteLoader({
  modules: ['components-core:Image.Avatar']
})(({ remoteModules, talent, onViewProfile }) => {
  const isEmployed = talent.status === 'employed';
  const [Avatar] = remoteModules;
  return (
    <Card
      hoverable
      className={style['talent-card']}
      onClick={() => {
        onViewProfile(talent);
      }}
    >
      <Tag
        className={classnames(style['talent-card-status'], {
          [style['employed']]: isEmployed
        })}
      >
        {isEmployed ? '在职' : '已离职'}
      </Tag>
      <Flex vertical gap={16} flex={1} justify="space-between" style={{ height: '100%' }}>
        <Flex vertical gap={16} flex={1}>
          <Flex align="center" gap={12}>
            <Flex flex="none">
              <Avatar size={56} id={talent.avatar} />
            </Flex>
            <div>
              <Title level={5} className={style['talent-name']}>
                {talent.name}
              </Title>
              <Text type="secondary" className={style['talent-position']}>
                {talent.position}
              </Text>
            </div>
          </Flex>

          <div>
            <Text className={style['section-label']}>核心技能</Text>
            <Flex gap={4} wrap>
              {(talent.skills || []).slice(0, 3).map((skill, index) => (
                <Tag key={index} className={style['skill-tag']}>
                  {skill}
                </Tag>
              ))}
              {talent.skills?.length > 3 && <Tag className={style['more-tag']}>+{talent.skills.length - 3}</Tag>}
            </Flex>
          </div>

          <div>
            <Text className={style['section-label']}>优势</Text>
            <ul className={style['advantages-list']}>
              {(talent.advantages || []).map((advantage, index) => (
                <li key={index}>
                  <span className={classnames(style.dot, style[`dot-${index}`])} />
                  {advantage}
                </li>
              ))}
            </ul>
          </div>
        </Flex>
        <Button type="primary" block onClick={() => onViewProfile(talent)}>
          查看完整档案
        </Button>
      </Flex>
    </Card>
  );
});

export default TalentCard;
