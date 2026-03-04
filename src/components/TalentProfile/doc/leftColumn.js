const { LeftColumn } = _TalentProfile;

const LeftColumnExample = () => {
  const profileData = {
    name: '张三三',
    serviceYears: 5.3,
    totalWorkYears: 6.8
  };

  const advantages = [
    {
      icon: <span>💡</span>,
      title: '战略与规划',
      color: 'purple',
      items: ['擅长从业务目标拆解数据需求。']
    }
  ];

  const certificates = ['大学英语六级', '心理咨询师'];

  const promotionHistory = [
    { period: '2024-至今', position: '数据分析师', department: '技术部', active: true },
    { period: '2021-2024', position: '数据专员', department: '技术部', active: false }
  ];

  return <LeftColumn profileData={profileData} advantages={advantages} certificates={certificates} promotionHistory={promotionHistory} />;
};

render(<LeftColumnExample />);
