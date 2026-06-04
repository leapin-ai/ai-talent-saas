import React from 'react';
import { Card, Tag, Space, Flex, Typography, Progress } from 'antd';
import { Jelly } from '@kne/react-box';
import { FaLightbulb, FaCompass } from 'react-icons/fa';
import { FaDirections } from 'react-icons/fa';
import { FaCrosshairs } from 'react-icons/fa';
import { MdStars } from 'react-icons/md';
import style from '../style.module.scss';
import '@kne/react-box/dist/index.css';
import withLocale from '../withLocale';
import { useIntl } from '@kne/react-intl';

const { Title, Text } = Typography;

const RightCardTitle = ({ color, title, description, icon }) => {
  return (
    <Flex gap={16} align="center" className={style['right-card-header']}>
      <Jelly color={color} size="48px">
        <span className="anticon" style={{ fontSize: '24px' }}>
          {icon}
        </span>
      </Jelly>
      <Flex vertical gap={4}>
        <Title level={4}>{title}</Title>
        <Text type="secondary" className={style['right-card-subtitle']}>
          {description}
        </Text>
      </Flex>
    </Flex>
  );
};

const CareerPath = ({ careerPath, renderProgress, getPriorityText, gotoPosition, formatMessage }) => {
  return (
    <Flex vertical gap={8}>
      {careerPath.map((item, index) => {
        return (
          <Card key={index} className={style['career-item']}>
            <Text strong className={style['career-period']}>
              {item.period}
            </Text>
            {item.isCurrent && (
              <Flex vertical gap={24}>
                <Flex vertical gap={4} className={style['current-position']}>
                  <Text>{formatMessage({ id: 'talentProfile.CurrentPosition' })}</Text>
                  <div>
                    <Typography.Link onClick={() => item.positionId && gotoPosition(item.positionId)}>{item.position}</Typography.Link>
                  </div>
                </Flex>
                <Flex justify="space-between">
                  <Text>{formatMessage({ id: 'talentProfile.ServiceDuration' })}</Text>
                  <Text strong>{item.duration}</Text>
                </Flex>
              </Flex>
            )}
            {!item.isCurrent && (
              <Flex vertical gap={24}>
                <Flex vertical gap={4} className={style['current-position']}>
                  <Flex gap={4}>
                    <span className="anticon">
                      <FaCrosshairs />
                    </span>
                    <Text>{formatMessage({ id: 'talentProfile.TargetPositionLabel' })}</Text>
                  </Flex>
                  <div>
                    <Typography.Link onClick={() => item.positionId && gotoPosition(item.positionId)}>{item.position}</Typography.Link>
                  </div>
                </Flex>
                {item.paths && item.paths.length && (
                  <div className={style['career-paths']}>
                    <Flex gap={4}>
                      <span className="anticon">
                        <FaDirections />
                      </span>
                      <Text strong>{formatMessage({ id: 'talentProfile.DevelopmentPath' })}</Text>
                    </Flex>
                    <ul>
                      {item.paths.map((path, i) => (
                        <li key={i}>{path}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {item.trainings && (
                  <div className={style.trainings}>
                    <Flex gap={4}>
                      <span className="anticon">
                        <FaCompass />
                      </span>
                      <Text strong>{formatMessage({ id: 'talentProfile.TrainingFocus' })}</Text>
                    </Flex>
                    {item.trainings.map((training, i) => (
                      <div key={i}>
                        <Flex justify="space-between">
                          <Text>{training.name}</Text>
                          <Text style={{ color: renderProgress(training.priority) }}>{getPriorityText(training.priority)}</Text>
                        </Flex>
                        <Progress
                          percent={(value => {
                            if (value === 'low') {
                              return 10;
                            }
                            if (value === 'medium') {
                              return 50;
                            }
                            return 100;
                          })(training.priority)}
                          showInfo={false}
                        />
                      </div>
                    ))}
                  </div>
                )}
              </Flex>
            )}
          </Card>
        );
      })}
    </Flex>
  );
};

const AiRecommendCard = ({ aiRecommendations, renderMatchRing, formatMessage }) => {
  const EmptyState = ({ text }) => (
    <Text type="secondary" style={{ display: 'block', textAlign: 'center', padding: '20px 0' }}>
      {text || formatMessage({ id: 'talentProfile.NoData' })}
    </Text>
  );

  return (
    <Card className={style['recommend-card']}>
      <RightCardTitle color="#5386FA" title={formatMessage({ id: 'talentProfile.AIRecommend' })} description={formatMessage({ id: 'talentProfile.PotentialPosition' })} icon={<MdStars />} />
      {aiRecommendations && aiRecommendations.length > 0 ? (
        <Space direction="vertical" className={style['recommend-list']}>
          {aiRecommendations.map((item, index) => (
            <div key={index} className={style['recommend-item']}>
              <Flex gap={20} align="center">
                {renderMatchRing(item.matchRate)}
                <div className={style['recommend-content']}>
                  <Text strong>{item.position}</Text>
                </div>
              </Flex>
              {item.skills && item.skills.length > 0 && (
                <div className={style['skill-gaps']}>
                  <Text type="secondary" className={style['skill-gaps-label']}>
                    {formatMessage({ id: 'talentProfile.MatchSkills' })}
                  </Text>
                  <Space wrap>
                    {item.skills.map((skill, i) => (
                      <Tag key={i} className={style['match-tag']}>
                        {skill}
                      </Tag>
                    ))}
                  </Space>
                </div>
              )}
              {item.gaps && item.gaps.length > 0 && (
                <div className={style['skill-gaps']}>
                  <Text type="secondary" className={style['skill-gaps-label']}>
                    {formatMessage({ id: 'talentProfile.SkillGap' })}
                  </Text>
                  <Space wrap>
                    {item.gaps.map((gap, i) => (
                      <Tag key={i} className={style['gap-tag']}>
                        {gap}
                      </Tag>
                    ))}
                  </Space>
                </div>
              )}
            </div>
          ))}
        </Space>
      ) : (
        <EmptyState text={formatMessage({ id: 'talentProfile.NoRecommendPosition' })} />
      )}
    </Card>
  );
};

const RightColumn = withLocale(({ careerPath, aiRecommendations, gotoPosition }) => {
  const { formatMessage } = useIntl();
  const EmptyState = ({ text }) => (
    <Text type="secondary" style={{ display: 'block', textAlign: 'center', padding: '20px 0' }}>
      {text || formatMessage({ id: 'talentProfile.NoData' })}
    </Text>
  );

  const renderProgress = priority => {
    const colors = { high: '#F87171', medium: '#FFC300', low: '#4ADE80' };
    return colors[priority] || colors.medium;
  };

  const getPriorityText = priority => {
    const texts = { high: formatMessage({ id: 'talentProfile.PriorityHigh' }), medium: formatMessage({ id: 'talentProfile.PriorityMedium' }), low: formatMessage({ id: 'talentProfile.PriorityLow' }) };
    return texts[priority] || texts.medium;
  };

  const renderMatchRing = matchRate => {
    const radius = 28;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference - (matchRate / 100) * circumference;
    const color = matchRate >= 80 ? '#4f46e5' : '#818cf8';

    return (
      <div className={style['match-ring']}>
        <svg className={style['ring-svg']} viewBox="0 0 64 64">
          <circle cx="32" cy="32" r={radius} fill="none" stroke="#f1f5f9" strokeWidth="4" />
          <circle cx="32" cy="32" r={radius} fill="none" stroke={color} strokeWidth="4" strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={offset} style={{ transform: 'rotate(-90deg)', transformOrigin: 'center' }} />
        </svg>
        <div className={style['match-value']}>
          <span className={style['match-number']}>{matchRate}%</span>
          <span className={style['match-label']}>{formatMessage({ id: 'talentProfile.MatchDegree' })}</span>
        </div>
      </div>
    );
  };

  return (
    <div className={style['right-column']}>
      <Card className={style['career-card']}>
        <RightCardTitle color="#8B5CF6" title={formatMessage({ id: 'talentProfile.AICareerPlan' })} description={formatMessage({ id: 'talentProfile.CareerPathRecommend' })} icon={<FaLightbulb />} gotoPosition={gotoPosition} />
        {careerPath && careerPath.length > 0 ? (
          <CareerPath careerPath={careerPath} renderProgress={renderProgress} getPriorityText={getPriorityText} gotoPosition={gotoPosition} formatMessage={formatMessage} />
        ) : (
          <EmptyState text={formatMessage({ id: 'talentProfile.NoCareerPlan' })} />
        )}
      </Card>

      <AiRecommendCard aiRecommendations={aiRecommendations} renderMatchRing={renderMatchRing} gotoPosition={gotoPosition} formatMessage={formatMessage} />
    </div>
  );
});

export default RightColumn;
