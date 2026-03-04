const { AdvantagesCard } = _TalentProfile;

const AdvantagesCardExample = () => {
  const advantages = [
    {
      icon: <span>💡</span>,
      title: '战略与规划',
      color: 'purple',
      items: ['擅长从业务目标拆解数据需求。', '曾主导业务平台用户增长项目的分析与落地。']
    },
    {
      icon: <span>📊</span>,
      title: '数据洞察',
      color: 'blue',
      items: ['具备敏锐的业务嗅觉，从海量数据挖掘价值。', '通过用户行为分析使留存率提升 8%。']
    }
  ];

  return <AdvantagesCard advantages={advantages} />;
};

render(<AdvantagesCardExample />);
