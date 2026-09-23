import React from 'react';
import { App, Button, Tag, Space, Flex, Typography, Progress } from 'antd';
import { MdOutlineEdit } from 'react-icons/md';
import { Card } from '@kne/react-box';
import { createWithRemoteLoader } from '@kne/remote-loader';
import style from '../style.module.scss';
import '@kne/react-box/dist/index.css';
import withLocale from '../withLocale';
import { useIntl } from '@kne/react-intl';
import CardGate from '../CardGate';
import { GrowthPlanFormInner, MatchPositionFormInner } from '../FormInner';
import iconPath from '../assets/icon-path.svg';
import iconFocus from '../assets/icon-focus.svg';
import iconSpark from '../assets/icon-spark.svg';

const { Text } = Typography;

const GrowthCard = ({ item, gotoPosition, renderProgress, getPriorityText, formatMessage }) => {
  if (!item || item.isCurrent) {
    return null;
  }
  return (
    <Card className={style['growth-plan-card']} theme="inset" hover={false}>
      <div className={style['growth-plan-period']}>{item.period}</div>
      <div className={style['growth-plan-block']}>
        <div className={style['growth-plan-label']}>
          <img src={iconSpark} alt="" />
          <Text>{formatMessage({ id: 'talentProfile.TargetPositionLabel' })}</Text>
        </div>
        <Typography.Link onClick={() => item.positionId && gotoPosition(item.positionId)}>{item.position || formatMessage({ id: 'talentProfile.NoData' })}</Typography.Link>
      </div>
      {item.paths && item.paths.length ? (
        <div className={style['growth-plan-block']}>
          <div className={style['growth-plan-label']}>
            <img src={iconPath} alt="" />
            <Text strong>{formatMessage({ id: 'talentProfile.DevelopmentPath' })}</Text>
          </div>
          <ul className={style['growth-plan-list']}>
            {item.paths.map((path, i) => (
              <li key={i}>{path}</li>
            ))}
          </ul>
        </div>
      ) : null}
      {item.trainings && item.trainings.length ? (
        <div className={style['growth-plan-block']}>
          <div className={style['growth-plan-label']}>
            <img src={iconFocus} alt="" />
            <Text strong>{formatMessage({ id: 'talentProfile.TrainingFocus' })}</Text>
          </div>
          {item.trainings.map((training, i) => (
            <div key={i} className={style['growth-training']}>
              <Flex justify="space-between">
                <Text>{training.name}</Text>
                <Text style={{ color: renderProgress(training.priority) }}>{getPriorityText(training.priority)}</Text>
              </Flex>
              <Progress
                percent={(() => {
                  if (training.priority === 'low') {
                    return 10;
                  }
                  if (training.priority === 'medium') {
                    return 50;
                  }
                  return 100;
                })()}
                showInfo={false}
                strokeColor={renderProgress(training.priority)}
              />
            </div>
          ))}
        </div>
      ) : null}
    </Card>
  );
};

const MatchRing = ({ matchRate, formatMessage }) => {
  const radius = 36;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - ((matchRate || 0) / 100) * circumference;
  const color = matchRate >= 80 ? '#4f46e5' : '#818cf8';

  return (
    <div className={style['match-ring-lg']}>
      <svg className={style['ring-svg']} viewBox="0 0 88 88">
        <circle cx="44" cy="44" r={radius} fill="none" stroke="#f1f5f9" strokeWidth="6" />
        <circle cx="44" cy="44" r={radius} fill="none" stroke={color} strokeWidth="6" strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={offset} style={{ transform: 'rotate(-90deg)', transformOrigin: 'center' }} />
      </svg>
      <div className={style['match-value']}>
        <span className={style['match-number']}>{matchRate}%</span>
        <span className={style['match-label']}>{formatMessage({ id: 'talentProfile.MatchDegree' })}</span>
      </div>
    </div>
  );
};

const toTermForm = item => ({
  position: item?.position || '',
  paths: Array.isArray(item?.paths) ? item.paths : [],
  trainings: Array.isArray(item?.trainings)
    ? item.trainings.map(training => ({
        name: training?.name || '',
        priority: training?.priority || 'medium'
      }))
    : []
});

const fromTermForm = value => {
  const trainings = Array.isArray(value?.trainings) ? value.trainings : [];
  return {
    target_position: value?.position || '',
    development_points: Array.isArray(value?.paths) ? value.paths.filter(Boolean) : [],
    training_focus: trainings.map(item => item?.name).filter(Boolean),
    skill_gap: trainings.map(item => ({
      name: item?.name || '',
      level: item?.priority || 'medium'
    }))
  };
};

const RightColumn = createWithRemoteLoader({
  modules: ['components-core:FormInfo@useFormModal']
})(
  withLocale(({ remoteModules, careerPath, aiRecommendations, gotoPosition, permissions, section = 'all', readOnly, employeeId, saveAiSuggest, aiSuggest, onGenerateInsight, generatingInsight }) => {
    const [useFormModal] = remoteModules;
    const formModal = useFormModal();
    const { message } = App.useApp();
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
      const texts = {
        high: formatMessage({ id: 'talentProfile.PriorityHigh' }),
        medium: formatMessage({ id: 'talentProfile.PriorityMedium' }),
        low: formatMessage({ id: 'talentProfile.PriorityLow' })
      };
      return texts[priority] || texts.medium;
    };

    const growthItems = (careerPath || []).filter(item => !item.isCurrent);
    const shortTermItem = (careerPath || []).find(item => !item.isCurrent && String(item.period || '').includes('12')) || growthItems[0];
    const longTermItem = (careerPath || []).find(item => item !== shortTermItem && !item.isCurrent) || growthItems[1];

    const openEditGrowth = () => {
      if (readOnly || !employeeId || !saveAiSuggest) {
        return;
      }
      formModal({
        title: formatMessage({ id: 'talentProfile.editGrowth' }),
        size: 'small',
        formProps: {
          data: {
            shortTerm: toTermForm(shortTermItem),
            longTerm: toTermForm(longTermItem)
          },
          onSubmit: async formData => {
            await saveAiSuggest({
              id: employeeId,
              shortTerm: fromTermForm(formData.shortTerm),
              longTerm: fromTermForm(formData.longTerm),
              matchPosition: aiSuggest?.matchPosition
            });
            message.success(formatMessage({ id: 'talentProfile.editGrowthSuccess' }));
          }
        },
        children: <GrowthPlanFormInner />
      });
    };

    const openEditMatch = () => {
      if (readOnly || !employeeId || !saveAiSuggest) {
        return;
      }
      const current = (aiRecommendations || [])[0] || {};
      formModal({
        title: formatMessage({ id: 'talentProfile.editMatch' }),
        size: 'small',
        formProps: {
          data: {
            position: current.position || '',
            matchRate: current.matchRate ?? 0,
            skills: Array.isArray(current.skills) ? current.skills.map(item => (typeof item === 'string' ? item : item?.name || '')) : [],
            gaps: Array.isArray(current.gaps) ? current.gaps.map(item => (typeof item === 'string' ? item : item?.name || item?.title || '')) : []
          },
          onSubmit: async formData => {
            await saveAiSuggest({
              id: employeeId,
              shortTerm: aiSuggest?.shortTerm,
              longTerm: aiSuggest?.longTerm,
              matchPosition: {
                target_position: formData.position || '',
                match_rate: Number(formData.matchRate || 0) / 100,
                skill_match: formData.skills || [],
                skill_gap: (formData.gaps || []).map(name => ({ name }))
              }
            });
            message.success(formatMessage({ id: 'talentProfile.editMatchSuccess' }));
          }
        },
        children: <MatchPositionFormInner />
      });
    };

    if (section === 'growth') {
      return (
        <CardGate request={permissions?.careerPlan}>
          <div className={style['growth-plan-root']}>
            {!readOnly && (onGenerateInsight || (employeeId && saveAiSuggest)) ? (
              <Flex justify="flex-end" gap={4} style={{ marginBottom: 8 }}>
                {onGenerateInsight ? (
                  <Button type="text" className={style['edit-btn']} loading={!!generatingInsight} onClick={() => onGenerateInsight()}>
                    {formatMessage({ id: 'talentProfile.generateInsight' })}
                  </Button>
                ) : null}
                {employeeId && saveAiSuggest ? (
                  <Button type="text" className={style['edit-btn']} icon={<MdOutlineEdit />} onClick={openEditGrowth}>
                    {formatMessage({ id: 'talentProfile.editGrowth' })}
                  </Button>
                ) : null}
              </Flex>
            ) : null}
            {growthItems.length ? (
              <div className={style['growth-plan-grid']}>
                {growthItems.map((item, index) => (
                  <GrowthCard key={index} item={item} gotoPosition={gotoPosition} renderProgress={renderProgress} getPriorityText={getPriorityText} formatMessage={formatMessage} />
                ))}
              </div>
            ) : (
              <EmptyState text={formatMessage({ id: 'talentProfile.NoCareerPlan' })} />
            )}
          </div>
        </CardGate>
      );
    }

    if (section === 'match') {
      return (
        <CardGate request={permissions?.aiRecommend}>
          <div className={style['match-root']}>
            {!readOnly && (onGenerateInsight || (employeeId && saveAiSuggest)) ? (
              <Flex justify="flex-end" gap={4} style={{ marginBottom: 8 }}>
                {onGenerateInsight ? (
                  <Button type="text" className={style['edit-btn']} loading={!!generatingInsight} onClick={() => onGenerateInsight()}>
                    {formatMessage({ id: 'talentProfile.generateInsight' })}
                  </Button>
                ) : null}
                {employeeId && saveAiSuggest ? (
                  <Button type="text" className={style['edit-btn']} icon={<MdOutlineEdit />} onClick={openEditMatch}>
                    {formatMessage({ id: 'talentProfile.editMatch' })}
                  </Button>
                ) : null}
              </Flex>
            ) : null}
            {aiRecommendations && aiRecommendations.length ? (
              <div className={style['match-grid']}>
                {aiRecommendations.map((item, index) => (
                  <Card key={index} className={style['match-card']} theme="inset" hover={false}>
                    <Flex gap={20} align="center">
                      <MatchRing matchRate={item.matchRate} formatMessage={formatMessage} />
                      <div className={style['recommend-content']}>
                        <Text strong className={style['match-position']}>
                          {item.position}
                        </Text>
                        {item.skills && item.skills.length > 0 ? (
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
                        ) : null}
                        {item.gaps && item.gaps.length > 0 ? (
                          <div className={style['skill-gaps']}>
                            <Text type="secondary" className={style['skill-gaps-label']}>
                              {formatMessage({ id: 'talentProfile.SkillGap' })}
                            </Text>
                            <Space wrap>
                              {item.gaps.map((gap, i) => (
                                <Tag key={i} className={style['gap-tag']}>
                                  {typeof gap === 'string' ? gap : gap?.name || gap?.title}
                                </Tag>
                              ))}
                            </Space>
                          </div>
                        ) : null}
                      </div>
                    </Flex>
                  </Card>
                ))}
              </div>
            ) : (
              <EmptyState text={formatMessage({ id: 'talentProfile.NoRecommendPosition' })} />
            )}
          </div>
        </CardGate>
      );
    }

    return null;
  })
);

export default RightColumn;
