const { SkillRadarChart } = _TalentProfile;

const SkillRadarChartExample = () => {
  const skillRadarData = {
    employee: [85, 88, 75, 92, 85, 78],
    industry: [65, 72, 80, 75, 68, 85]
  };

  return <SkillRadarChart data={skillRadarData} />;
};

render(<SkillRadarChartExample />);
