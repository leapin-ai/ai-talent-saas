import React from 'react';
import { Card, Tag, Space, Flex, Typography, Progress } from 'antd';
import { Jelly } from '@kne/react-box';
import { FaLightbulb, FaCompass } from 'react-icons/fa';
import { FaDirections } from 'react-icons/fa';
import { FaCrosshairs } from 'react-icons/fa';
import { MdStars } from 'react-icons/md';
import style from '../style.module.scss';
import '@kne/react-box/dist/index.css';

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

const CareerPath = ({ careerPath, renderProgress, getPriorityText, gotoPosition }) => {
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
                  <Text>当前岗位</Text>
                  <div>
                    <Typography.Link onClick={() => item.positionId && gotoPosition(item.positionId)}>{item.position}</Typography.Link>
                  </div>
                </Flex>
                <Flex justify="space-between">
                  <Text>任职时长</Text>
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
                    <Text>目标岗位</Text>
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
                      <Text strong>目标岗位发展路径</Text>
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
                      <Text strong>培训重点</Text>
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

const AiRecommendCard = ({ aiRecommendations, renderMatchRing }) => {
  const EmptyState = ({ text }) => (
    <Text type="secondary" style={{ display: 'block', textAlign: 'center', padding: '20px 0' }}>
      {text || '暂无数据'}
    </Text>
  );

  return (
    <Card className={style['recommend-card']}>
      <RightCardTitle color="#5386FA" title="AI 推荐" description="潜在适配岗位推荐" icon={<MdStars />} />
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
                    匹配技能
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
                    技能差距
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
        <EmptyState text="暂无推荐岗位" />
      )}
    </Card>
  );
};

const RightColumn = ({ careerPath, aiRecommendations, gotoPosition }) => {
  const EmptyState = ({ text }) => (
    <Text type="secondary" style={{ display: 'block', textAlign: 'center', padding: '20px 0' }}>
      {text || '暂无数据'}
    </Text>
  );

  const renderProgress = priority => {
    const colors = { high: '#F87171', medium: '#FFC300', low: '#4ADE80' };
    return colors[priority] || colors.medium;
  };

  const getPriorityText = priority => {
    const texts = { high: '优先级: 高', medium: '优先级: 中', low: '优先级: 低' };
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
          <span className={style['match-label']}>匹配度</span>
        </div>
      </div>
    );
  };

  return (
    <div className={style['right-column']}>
      <Card className={style['career-card']}>
        <RightCardTitle color="#8B5CF6" title="AI职业成长规划" description="个性化职业路径推荐" icon={<FaLightbulb />} gotoPosition={gotoPosition} />
        {careerPath && careerPath.length > 0 ? <CareerPath careerPath={careerPath} renderProgress={renderProgress} getPriorityText={getPriorityText} gotoPosition={gotoPosition} /> : <EmptyState text="暂无职业规划" />}
      </Card>

      <AiRecommendCard aiRecommendations={aiRecommendations} renderMatchRing={renderMatchRing} gotoPosition={gotoPosition} />
    </div>
  );
};

export default RightColumn;
