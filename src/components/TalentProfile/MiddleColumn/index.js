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
import { TargetPositionFormInner, MobilityPreferenceFormInner, InterestFormInner, PerformanceReviewFormInner, SkillFormInner } from '../FormInner';
import { fromIntentionSelectValue, toIntentionSelectValue } from '../intentionPositionUtils';
import CardGate from '../CardGate';
import withLocale from '../withLocale';
import { useIntl } from '@kne/react-intl';

const { Text, Paragraph } = Typography;

const MiddleColumn = createWithRemoteLoader({
  modules: ['components-core:FormInfo@useFormModal', 'components-core:ConfirmButton']
})(
  withLocale(
    ({
      remoteModules,
      originData,
      createPerformance,
      removePerformance,
      savePerformance,
      saveProfile,
      skillTags,
      targetPositions,
      mobilityPreferences,
      interests,
      performanceReviews,
      skillRadarData,
      gotoPosition,
      readOnly,
      positionListApi,
      positionEnums,
      permissions
    }) => {
      const { formatMessage } = useIntl();
      const [useFormModal, ConfirmButton] = remoteModules;
      const formModal = useFormModal();
      const EmptyState = ({ text }) => (
        <Text type="secondary" style={{ display: 'block', textAlign: 'center', padding: '20px 0' }}>
          {text || formatMessage({ id: 'talentProfile.NoData' })}
        </Text>
      );

      const translateMobilityValue = value => {
        const translations = {
          'Hybrid Work': formatMessage({ id: 'talentProfile.HybridWork' }),
          Remote: formatMessage({ id: 'talentProfile.RemoteWork' }),
          'On-site': formatMessage({ id: 'talentProfile.OnSiteWork' }),
          Open: formatMessage({ id: 'talentProfile.Accept' }),
          'Not Open': formatMessage({ id: 'talentProfile.NotConsider' }),
          Limited: formatMessage({ id: 'talentProfile.LimitedAccept' })
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
          title: formatMessage({ id: 'talentProfile.AddPerformanceReview' }),
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
          <CardGate request={permissions?.skillMetrics}>
            <Card className={style['skill-card']}>
              <Flex justify="space-between" className={style['card-title']}>
                <Space>
                  <span className="anticon">
                    <FaHeadSideVirus style={{ color: '#9F70FD' }} />
                  </span>
                  {formatMessage({ id: 'talentProfile.SkillMetrics' })}
                </Space>
              </Flex>
              {skillRadarData && skillRadarData.employee && skillRadarData.employee.length > 0 ? (
                <div className={style['radar-chart']}>
                  <SkillRadarChart data={skillRadarData} />
                </div>
              ) : (
                <EmptyState text={formatMessage({ id: 'talentProfile.NoSkillRadar' })} />
              )}
              <Space wrap className={style['skill-tags']}>
                {skillTags.length > 0 ? skillTags.map((skill, index) => <Tag key={index}>{skill}</Tag>) : <EmptyState text={formatMessage({ id: 'talentProfile.NoSkillTags' })} />}
                {!readOnly && (
                  <Button
                    type="text"
                    className={style['edit-btn']}
                    icon={<MdOutlineEdit />}
                    onClick={() => {
                      formModal({
                        title: formatMessage({ id: 'talentProfile.EditSkillTags' }),
                        size: 'small',
                        formProps: {
                          data: Object.assign({}, originData.profile?.skills),
                          onSubmit: formData => {
                            return saveProfile({
                              skills: Object.assign(
                                {},
                                {
                                  cert_mapped: [],
                                  interest_strength: [],
                                  work_related: []
                                },
                                formData
                              )
                            });
                          }
                        },
                        children: <SkillFormInner />
                      });
                    }}
                  />
                )}
              </Space>
            </Card>
          </CardGate>

          <CardGate request={permissions?.targetPosition}>
            <Card className={style['target-card']}>
              <Flex justify="space-between" className={style['card-title']}>
                <Space>
                  <span className="anticon">
                    <MdPersonSearch style={{ color: '#5386FA' }} />
                  </span>
                  {formatMessage({ id: 'talentProfile.TargetPosition' })}
                </Space>
                {!readOnly && (
                  <Button
                    type="text"
                    className={style['edit-btn']}
                    icon={<MdOutlineEdit />}
                    onClick={() => {
                      const selectMode = !!positionListApi;
                      formModal({
                        title: formatMessage({ id: 'talentProfile.EditTargetPosition' }),
                        size: 'small',
                        formProps: {
                          data: selectMode
                            ? {
                                intentionPosition: toIntentionSelectValue(
                                  targetPositions.map(item => ({ id: item.positionId, name: item.position })),
                                  positionEnums || originData?.positionEnums
                                )
                              }
                            : {
                                name: targetPositions.map(item => item.position)
                              },
                          onSubmit: formData => {
                            if (selectMode) {
                              return saveProfile({ intentionPosition: fromIntentionSelectValue(formData.intentionPosition) });
                            }
                            return saveProfile({ intentionPosition: formData.name });
                          }
                        },
                        children: selectMode ? <TargetPositionFormInner fieldName="intentionPosition" mode="select" positionListApi={positionListApi} required={false} /> : <TargetPositionFormInner />
                      });
                    }}
                  />
                )}
              </Flex>
              {targetPositions.length > 0 ? (
                <Space wrap className={style['target-positions']}>
                  {targetPositions.map(({ positionId, position }, index) => {
                    return (
                      <Tag
                        key={index}
                        className={positionId ? style['target-position-tag'] : undefined}
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
                <EmptyState text={formatMessage({ id: 'talentProfile.NoTargetPosition' })} />
              )}
            </Card>
          </CardGate>

          <CardGate request={permissions?.mobilityPreference}>
            <Card className={style['mobility-card']}>
              <Flex justify="space-between" className={style['card-title']}>
                <Space>
                  <span className="anticon">
                    <LuWorkflow />
                  </span>
                  {formatMessage({ id: 'talentProfile.MobilityPreference' })}
                </Space>
                {!readOnly && (
                  <Button
                    type="text"
                    className={style['edit-btn']}
                    icon={<MdOutlineEdit />}
                    onClick={() => {
                      formModal({
                        title: formatMessage({ id: 'talentProfile.EditMobilityPreference' }),
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
                )}
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
                      label: formatMessage({ id: 'talentProfile.WorkModePreference' }),
                      value: translateMobilityValue(mobilityPreferences[0]),
                      level: 0
                    },
                    {
                      icon: (
                        <span className="anticon">
                          <FaPlaneArrival style={{ color: '#5386FA' }} />
                        </span>
                      ),
                      label: formatMessage({ id: 'talentProfile.BusinessTravel' }),
                      value: translateMobilityValue(mobilityPreferences[2]),
                      level: getMobilityLevel(mobilityPreferences[2])
                    },
                    {
                      icon: (
                        <span className="anticon">
                          <FaExchangeAlt style={{ color: '#5386FA' }} />
                        </span>
                      ),
                      label: formatMessage({ id: 'talentProfile.RelocationWillingness' }),
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
                <EmptyState text={formatMessage({ id: 'talentProfile.NoMobilityPreference' })} />
              )}
            </Card>
          </CardGate>

          <CardGate request={permissions?.hobbies}>
            <Card className={style['interests-card']}>
              <Flex justify="space-between" className={style['card-title']}>
                <Space>
                  <span className="anticon">
                    <PiFlowerLight style={{ color: '#4ADE80' }} />
                  </span>
                  {formatMessage({ id: 'talentProfile.Hobbies' })}
                </Space>
                {!readOnly && (
                  <Button
                    type="text"
                    className={style['edit-btn']}
                    icon={<MdOutlineEdit />}
                    onClick={() => {
                      formModal({
                        title: formatMessage({ id: 'talentProfile.EditHobbies' }),
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
                )}
              </Flex>
              {interests.length > 0 ? (
                <Space wrap>
                  {interests.map((interest, index) => (
                    <Tag key={index}>{interest}</Tag>
                  ))}
                </Space>
              ) : (
                <EmptyState text={formatMessage({ id: 'talentProfile.NoHobbies' })} />
              )}
            </Card>
          </CardGate>

          <CardGate request={permissions?.performanceReview}>
            <Card className={style['performance-card']}>
              <Flex justify="space-between" className={style['card-title']}>
                <Space>
                  <span className="anticon">
                    <FaClipboardList style={{ color: 'rgba(17, 24, 39, 0.78)' }} />
                  </span>
                  {formatMessage({ id: 'talentProfile.PerformanceReview' })}
                </Space>
                {!readOnly && <Button type="text" className={style['edit-btn']} icon={<MdAdd />} onClick={handleAddPerformance} />}
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
                            {!readOnly && (
                              <Flex align="center" gap={4} className={style['performance-actions']}>
                                <Button
                                  type="text"
                                  size="small"
                                  className={style['edit-btn']}
                                  icon={<MdOutlineEdit />}
                                  onClick={() => {
                                    formModal({
                                      title: formatMessage({ id: 'talentProfile.EditPerformanceReview' }),
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
                            )}
                          </Flex>
                        </Flex>
                        <Paragraph className={style['review-comment']}>{review.comment}</Paragraph>
                      </div>
                    )
                  }))}
                />
              ) : (
                <EmptyState text={formatMessage({ id: 'talentProfile.NoPerformanceReview' })} />
              )}
            </Card>
          </CardGate>
        </div>
      );
    }
  )
);

export default MiddleColumn;
