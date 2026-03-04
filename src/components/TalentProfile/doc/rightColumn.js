const { RightColumn } = _TalentProfile;

const RightColumnExample = () => {
  const careerPath = [
    {
      period: '2025 Q3',
      position: '数据分析师',
      duration: '5.3 年',
      isCurrent: true
    },
    {
      period: '短期 (12 个月)',
      position: '资源数据分析师',
      isCurrent: false,
      paths: ['参与客户行为分析项目'],
      trainings: [{ name: '机器学习应用能力', priority: 'high', progress: 80 }]
    }
  ];

  const aiRecommendations = [
    {
      position: '资深数据科学家',
      matchRate: 84,
      skills: ['Python', '公众演讲'],
      gaps: ['深度学习框架']
    }
  ];

  return <RightColumn careerPath={careerPath} aiRecommendations={aiRecommendations} />;
};

render(<RightColumnExample />);
