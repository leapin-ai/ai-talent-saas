import React from 'react';
import { App, Button, Card, Tag, Space, Flex, Typography, Progress } from 'antd';
import { FaCompass, FaDirections, FaCrosshairs } from 'react-icons/fa';
import { MdOutlineEdit } from 'react-icons/md';
import { createWithRemoteLoader } from '@kne/remote-loader';
import style from '../style.module.scss';
import withLocale from '../withLocale';
import { useIntl } from '@kne/react-intl';
import CardGate from '../CardGate';
import { GrowthPlanFormInner, MatchPositionFormInner } from '../FormInner';

const { Text } = Typography;

const hasText = value => typeof value === 'string' && value.trim().length > 0;

const namedTrainings = item => (Array.isArray(item?.trainings) ? item.trainings.filter(training => hasText(training?.name)) : []);

const namedPaths = item => (Array.isArray(item?.paths) ? item.paths.filter(hasText) : []);

const hasCareerContent = item => {
  if (!item) {
    return false;
  }
  if (item.isCurrent) {
    return hasText(item.position);
  }
  return hasText(item.position) || namedPaths(item).length > 0 || namedTrainings(item).length > 0;
};

const CareerPath = ({ careerPath, renderProgress, getPriorityText, gotoPosition, formatMessage }) => {
  const items = (careerPath || []).filter(hasCareerContent);
  if (!items.length) {
    return (
      <Text type="secondary" style={{ display: 'block', textAlign: 'center', padding: '20px 0' }}>
        {formatMessage({ id: 'talentProfile.NoCareerPlan' })}
      </Text>
    );
  }
  return (
    <div className={style['growth-plan-grid']}>
      {items.map((item, index) => {
        const paths = namedPaths(item);
        const trainings = namedTrainings(item);
        return (
          <Card key={index} className={style['career-item']}>
            {hasText(item.period) ? (
              <Text strong className={style['career-period']}>
                {item.period}
              </Text>
            ) : null}
            {item.isCurrent ? (
              <Flex vertical gap={24}>
                <Flex vertical gap={4} className={style['current-position']}>
                  <Text>{formatMessage({ id: 'talentProfile.CurrentPosition' })}</Text>
                  <div>
                    <Typography.Link onClick={() => item.positionId && gotoPosition(item.positionId)}>{item.position}</Typography.Link>
                  </div>
                </Flex>
                {hasText(item.duration) ? (
                  <Flex justify="space-between">
                    <Text>{formatMessage({ id: 'talentProfile.ServiceDuration' })}</Text>
                    <Text strong>{item.duration}</Text>
                  </Flex>
                ) : null}
              </Flex>
            ) : (
              <Flex vertical gap={24}>
                {hasText(item.position) ? (
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
                ) : null}
                {paths.length ? (
                  <div className={style['career-paths']}>
                    <Flex gap={4}>
                      <span className="anticon">
                        <FaDirections />
                      </span>
                      <Text strong>{formatMessage({ id: 'talentProfile.DevelopmentPath' })}</Text>
                    </Flex>
                    <ul>
                      {paths.map((path, i) => (
                        <li key={i}>{path}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                {trainings.length ? (
                  <div className={style.trainings}>
                    <Flex gap={4}>
                      <span className="anticon">
                        <FaCompass />
                      </span>
                      <Text strong>{formatMessage({ id: 'talentProfile.TrainingFocus' })}</Text>
                    </Flex>
                    {trainings.map((training, i) => (
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
                ) : null}
              </Flex>
            )}
          </Card>
        );
      })}
    </div>
  );
};

const renderMatchRing = (matchRate, formatMessage) => {
  const radius = 28;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - ((matchRate || 0) / 100) * circumference;
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

const labelOf = value => (typeof value === 'string' ? value.trim() : value?.name || value?.title || '');

const hasMatchContent = item => {
  if (!item) {
    return false;
  }
  const skills = (item.skills || []).map(labelOf).filter(Boolean);
  const gaps = (item.gaps || []).map(labelOf).filter(Boolean);
  return hasText(item.position) || skills.length > 0 || gaps.length > 0;
};

const AiRecommendCard = ({ aiRecommendations, formatMessage }) => {
  const items = (aiRecommendations || []).filter(hasMatchContent);
  if (!items.length) {
    return (
      <Text type="secondary" style={{ display: 'block', textAlign: 'center', padding: '20px 0' }}>
        {formatMessage({ id: 'talentProfile.NoRecommendPosition' })}
      </Text>
    );
  }

  return (
    <div className={style['growth-plan-grid']}>
      {items.map((item, index) => {
        const skills = (item.skills || []).map(labelOf).filter(Boolean);
        const gaps = (item.gaps || []).map(labelOf).filter(Boolean);
        return (
          <Card key={index} className={style['career-item']}>
            <Flex gap={20} align="center">
              {renderMatchRing(item.matchRate, formatMessage)}
              {hasText(item.position) ? (
                <div className={style['recommend-content']}>
                  <Text strong>{item.position}</Text>
                </div>
              ) : null}
            </Flex>
            {skills.length ? (
              <div className={style['skill-gaps']}>
                <Text type="secondary" className={style['skill-gaps-label']}>
                  {formatMessage({ id: 'talentProfile.MatchSkills' })}
                </Text>
                <Space wrap>
                  {skills.map((skill, i) => (
                    <Tag key={i} className={style['match-tag']}>
                      {skill}
                    </Tag>
                  ))}
                </Space>
              </div>
            ) : null}
            {gaps.length ? (
              <div className={style['skill-gaps']}>
                <Text type="secondary" className={style['skill-gaps-label']}>
                  {formatMessage({ id: 'talentProfile.SkillGap' })}
                </Text>
                <Space wrap>
                  {gaps.map((gap, i) => (
                    <Tag key={i} className={style['gap-tag']}>
                      {gap}
                    </Tag>
                  ))}
                </Space>
              </div>
            ) : null}
          </Card>
        );
      })}
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

    const growthActions =
      !readOnly && (onGenerateInsight || (employeeId && saveAiSuggest)) ? (
        <Flex justify="flex-end" gap={4} style={{ marginBottom: 8 }}>
          {onGenerateInsight ? (
            <Button type="text" className={style['edit-btn']} loading={!!generatingInsight} onClick={() => onGenerateInsight()}>
              {formatMessage({ id: 'talentProfile.generateInsight' })}
            </Button>
          ) : null}
          {employeeId && saveAiSuggest ? (
            <Button type="text" className={style['edit-btn']} icon={<MdOutlineEdit />} onClick={section === 'match' ? openEditMatch : openEditGrowth}>
              {formatMessage({ id: section === 'match' ? 'talentProfile.editMatch' : 'talentProfile.editGrowth' })}
            </Button>
          ) : null}
        </Flex>
      ) : null;

    const careerCard = (
      <CardGate request={permissions?.careerPlan}>
        {section === 'growth' ? growthActions : null}
        <CareerPath careerPath={careerPath} renderProgress={renderProgress} getPriorityText={getPriorityText} gotoPosition={gotoPosition} formatMessage={formatMessage} />
      </CardGate>
    );

    const matchCard = (
      <CardGate request={permissions?.aiRecommend}>
        {section === 'match' ? growthActions : null}
        <AiRecommendCard aiRecommendations={aiRecommendations} formatMessage={formatMessage} />
      </CardGate>
    );

    if (section === 'growth') {
      return careerCard;
    }

    if (section === 'match') {
      return matchCard;
    }

    return (
      <div className={style['right-column']}>
        {careerCard}
        {matchCard}
      </div>
    );
  })
);

export default RightColumn;
