const { TalentGrid } = _TalentMarket;

const TalentGridExample = () => {
  const mockTalents = [
    {
      id: 1,
      name: '张三三',
      position: '数据分析师',
      avatar:
        'https://lh3.googleusercontent.com/aida-public/AB6AXuDvPAB0O641DVkigN2YUUsCo3jIvsHcp4OSFJjmz0fPhorqdvR4efVlRQ5l_rwJfrDW5MYuaggIE0eoLk1WYVo8SJ-hKhsE_VLIn_fIcqid0sEtVW6X9Yzle7oVtbY8O8yw2sFJ98QToZJXYweEiPoPMDjgu3-SqCokd9C79qBpgmtBr4xN-SX7pyZkfZH7LsuNTL5EmXaeteqQs9un1Fsj_hbojeqzcsjFHrkH5jW3K68PWJ9hNKNgYYhEVwiCv6jtbW94jil8prPe',
      status: 'employed',
      skills: ['分析市场需求', '制定解决方案', '数据可视化'],
      advantages: ['擅长数据可视化', '数据洞察', '团队领导力']
    }
  ];

  return <TalentGrid talents={mockTalents} onViewProfile={talent => console.log('查看:', talent)} />;
};

render(<TalentGridExample />);
