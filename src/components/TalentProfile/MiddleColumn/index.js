import React from 'react';
import { createWithRemoteLoader } from '@kne/remote-loader';
import { Card, Tag, Space, Flex, Typography, Rate, Timeline, Button } from 'antd';
import { LuWorkflow } from 'react-icons/lu';
import { FaClipboardList, FaPlaneArrival, FaExchangeAlt, FaHeadSideVirus, FaBriefcase } from 'react-icons/fa';
import { PiFlowerLight } from 'react-icons/pi';
import { MdPersonSearch, MdOutlineEdit, MdAdd, MdOutlineDeleteOutline } from 'react-icons/md';
import SkillRadarChart from '../SkillRadarChart';
import style from '../style.module.scss';
import classnames from 'classnames';
import { TargetPositionFormInner, MobilityPreferenceFormInner, InterestFormInner, PerformanceReviewFormInner } from '../FormInner';

const { Text, Paragraph } = Typography;

const MiddleColumn = createWithRemoteLoader({
  modules: ['components-core:FormInfo@useFormModal', 'components-core:ConfirmButton']
})(({ remoteModules, createPerformance, removePerformance, savePerformance, saveProfile, skillTags, targetPositions, mobilityPreferences, interests, performanceReviews, skillRadarData, gotoPosition }) => {
  const [useFormModal, ConfirmButton] = remoteModules;
  const formModal = useFormModal();
  const EmptyState = ({ text }) => (
    <Text type="secondary" style={{ display: 'block', textAlign: 'center', padding: '20px 0' }}>
      {text || '暂无数据'}
    </Text>
  );

  const translateMobilityValue = value => {
    const translations = {
      'Hybrid Work': '混合办公',
      Remote: '远程办公',
      'On-site': '现场办公',
      Open: '接受',
      'Not Open': '暂不考虑',
      Limited: '有限接受'
    };
    return translations[value] || value || '-';
  };

  const getMobilityLevel = value => {
    if (value === 'Open') return 0;
    if (value === 'Limited') return 1;
    if (value === 'Not Open') return 2;
    return 0;
  };

  // 添加绩效评价
  const handleAddPerformance = () => {
    formModal({
      title: '添加绩效评价',
      size: 'small',
      formProps: {
        onSubmit: async formData => {
          return createPerformance(formData);
        }
      },
      children: <PerformanceReviewFormInner />
    });
  };

  return (
    <div className={style['middle-column']}>
      <Card className={style['skill-card']}>
        <Flex justify="space-between" className={style['card-title']}>
          <Space>
            <span className="anticon">
              <FaHeadSideVirus style={{ color: '#9F70FD' }} />
            </span>
            技能指标
          </Space>
        </Flex>
        {skillRadarData && skillRadarData.employee && skillRadarData.employee.length > 0 ? (
          <div className={style['radar-chart']}>
            <SkillRadarChart data={skillRadarData} />
          </div>
        ) : null}
        {skillTags.length > 0 ? (
          <Space wrap className={style['skill-tags']}>
            {skillTags.map((skill, index) => (
              <Tag key={index}>{skill}</Tag>
            ))}
          </Space>
        ) : (
          <EmptyState text="暂无技能信息" />
        )}
      </Card>

      <Card className={style['target-card']}>
        <Flex justify="space-between" className={style['card-title']}>
          <Space>
            <span className="anticon">
              <MdPersonSearch style={{ color: '#5386FA' }} />
            </span>
            意向岗位
          </Space>
          <Button
            type="text"
            className={style['edit-btn']}
            icon={<MdOutlineEdit />}
            onClick={() => {
              formModal({
                title: '编辑意向岗位',
                size: 'small',
                formProps: {
                  data: {
                    name: targetPositions.map(item => item.position)
                  },
                  onSubmit: formData => {
                    return saveProfile({ intentionPosition: formData.name });
                  }
                },
                children: <TargetPositionFormInner />
              });
            }}
          />
        </Flex>
        {targetPositions.length > 0 ? (
          <Space wrap className={style['target-positions']}>
            {targetPositions.map(({ positionId, position }, index) => {
              return (
                <Tag
                  key={index}
                  onClick={() => {
                    positionId && gotoPosition(positionId);
                  }}
                >
                  {position}
                </Tag>
              );
            })}
          </Space>
        ) : (
          <EmptyState text="暂无意向岗位" />
        )}
      </Card>

      <Card className={style['mobility-card']}>
        <Flex justify="space-between" className={style['card-title']}>
          <Space>
            <span className="anticon">
              <LuWorkflow />
            </span>
            流动性偏好
          </Space>
          <Button
            type="text"
            className={style['edit-btn']}
            icon={<MdOutlineEdit />}
            onClick={() => {
              formModal({
                title: '编辑流动性偏好',
                size: 'small',
                formProps: {
                  data: {
                    workPreference: {
                      work_mode_preference: mobilityPreferences[0],
                      relocation_willingness: mobilityPreferences[1],
                      business_travel_willingness: mobilityPreferences[2]
                    }
                  },
                  onSubmit: formData => {
                    return saveProfile({ workPreference: formData.workPreference });
                  }
                },
                children: <MobilityPreferenceFormInner />
              });
            }}
          />
        </Flex>
        {mobilityPreferences.length > 0 ? (
          <Space direction="vertical" className={style['mobility-list']}>
            {[
              {
                icon: (
                  <div className="anticon">
                    <FaBriefcase style={{ color: '#5386FA' }} />
                  </div>
                ),
                label: '工作模式偏好',
                value: translateMobilityValue(mobilityPreferences[0]),
                level: 0
              },
              {
                icon: (
                  <span className="anticon">
                    <FaPlaneArrival style={{ color: '#5386FA' }} />
                  </span>
                ),
                label: '出差意愿',
                value: translateMobilityValue(mobilityPreferences[2]),
                level: getMobilityLevel(mobilityPreferences[2])
              },
              {
                icon: (
                  <span className="anticon">
                    <FaExchangeAlt style={{ color: '#5386FA' }} />
                  </span>
                ),
                label: '外派意愿',
                value: translateMobilityValue(mobilityPreferences[1]),
                level: getMobilityLevel(mobilityPreferences[1])
              }
            ].map((item, index) => (
              <div key={index} className={style['mobility-item']}>
                <Space className={style['mobility-label']}>
                  {item.icon}
                  <Text>{item.label}</Text>
                </Space>
                <Text
                  className={classnames(style['mobility-value'], {
                    [style['level-1']]: item.level === 1,
                    [style['level-2']]: item.level === 2
                  })}
                >
                  {item.value}
                </Text>
              </div>
            ))}
          </Space>
        ) : (
          <EmptyState text="暂无流动性偏好" />
        )}
      </Card>

      <Card className={style['interests-card']}>
        <Flex justify="space-between" className={style['card-title']}>
          <Space>
            <span className="anticon">
              <PiFlowerLight style={{ color: '#4ADE80' }} />
            </span>
            兴趣爱好
          </Space>
          <Button
            type="text"
            className={style['edit-btn']}
            icon={<MdOutlineEdit />}
            onClick={() => {
              formModal({
                title: '编辑兴趣爱好',
                size: 'small',
                formProps: {
                  data: {
                    name: interests
                  },
                  onSubmit: formData => {
                    return saveProfile({
                      options: {
                        hobbies: formData.name
                      }
                    });
                  }
                },
                children: <InterestFormInner />
              });
            }}
          />
        </Flex>
        {interests.length > 0 ? (
          <Space wrap>
            {interests.map((interest, index) => (
              <Tag key={index}>{interest}</Tag>
            ))}
          </Space>
        ) : (
          <EmptyState text="暂无兴趣爱好" />
        )}
      </Card>

      <Card className={style['performance-card']}>
        <Flex justify="space-between" className={style['card-title']}>
          <Space>
            <span className="anticon">
              <FaClipboardList style={{ color: 'rgba(17, 24, 39, 0.78)' }} />
            </span>
            绩效评价
          </Space>
          <Button type="text" className={style['edit-btn']} icon={<MdAdd />} onClick={handleAddPerformance} />
        </Flex>
        {performanceReviews.length > 0 ? (
          <Timeline
            className={style['timeline']}
            items={performanceReviews.map((review, index) => ({
              dot: <span className={classnames(style['timeline-dot'], index === 0 && style['timeline-dot-active'])} />,
              children: (
                <div key={index} className={style['performance-item']}>
                  <Flex justify="space-between" align="flex-start" className={style['performance-header']}>
                    <div>
                      <Space className={style['review-date']}>
                        <Text
                          className={classnames(style['review-date-text'], {
                            [style['active']]: index === 0
                          })}
                        >
                          {review.date}
                        </Text>
                      </Space>
                      <Flex align="center" gap={4} className={style['review-rating-wrapper']}>
                        <Rate disabled value={review.rating} className={style['review-rating']} />
                        <Text type="secondary" className={style['review-rating-text']}>
                          {review.rating}/5
                        </Text>
                      </Flex>
                    </div>
                    <Flex vertical align="flex-end">
                      <Text strong className={classnames(style['reviewer-name'])}>
                        {review.reviewer}
                      </Text>
                      <Flex align="center" gap={4} className={style['performance-actions']}>
                        <Button
                          type="text"
                          size="small"
                          className={style['edit-btn']}
                          icon={<MdOutlineEdit />}
                          onClick={() => {
                            formModal({
                              title: '编辑绩效评价',
                              size: 'small',
                              formProps: {
                                data: {
                                  date: review.date,
                                  score: review.rating,
                                  evaluatorName: review.reviewer,
                                  comment: review.comment
                                },
                                onSubmit: formData => {
                                  return savePerformance(Object.assign({}, formData, { id: review.id }));
                                }
                              },
                              children: <PerformanceReviewFormInner />
                            });
                          }}
                        />
                        <ConfirmButton
                          type="text"
                          size="small"
                          className={style['edit-btn']}
                          isDelete
                          danger
                          icon={<MdOutlineDeleteOutline />}
                          onClick={() => {
                            return removePerformance(review.id);
                          }}
                        />
                      </Flex>
                    </Flex>
                  </Flex>
                  <Paragraph className={style['review-comment']}>{review.comment}</Paragraph>
                </div>
              )
            }))}
          />
        ) : (
          <EmptyState text="暂无绩效评价" />
        )}
      </Card>
    </div>
  );
});

export default MiddleColumn;
