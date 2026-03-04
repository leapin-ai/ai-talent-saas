const { MiddleColumn } = _TalentProfile;

const MiddleColumnExample = () => {
  const skillTags = ['深度学习框架', '数据管道设计', 'SQL 与高级查询'];
  const targetPositions = ['资源数据分析师', '资深数据科学家'];
  const mobilityPreferences = [
    { icon: <span>👔</span>, label: '工作模式偏好', value: '混合办公' },
    { icon: <span>📍</span>, label: '出差意愿', value: '有限接受' }
  ];
  const interests = ['跳舞', '徒步'];
  const performanceReviews = [
    {
      date: '2025-12-31',
      rating: 4,
      reviewer: '陈敬东',
      comment: '技术能力出色，能够承担起更复杂的数据分析任务。'
    }
  ];

  return <MiddleColumn skillTags={skillTags} targetPositions={targetPositions} mobilityPreferences={mobilityPreferences} interests={interests} performanceReviews={performanceReviews} />;
};

render(<MiddleColumnExample />);
