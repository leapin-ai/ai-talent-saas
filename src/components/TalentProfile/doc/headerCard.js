const { HeaderCard } = _TalentProfile;

const HeaderCardExample = () => {
  const profileData = {
    name: '张三三',
    englishName: 'Kianna Zhang',
    position: '数据分析师',
    department: '技术部',
    avatar:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuB_xVIPjt20E4Cn8KBE8QKXyI3ftGSlPWUHOwKfGrfbIFb8AVSZezmI2Yt-uRucJSBYX5R639D36oZBIWfHb96oCYLzE9LxAvFQBk8LjbtWHABpF6gC-2P53N9y5B4ecuTmxeUO8WkjiBjh-xU7eZVpXlFMRL4ULA0XAp6T6USgqCdVQmXcLkmpNSzIX_T3huTHJ7XJvPPufq_mkwf_Tf6c9mGWg7TD4Df7PoIFSo-SDVVZySAX1bl3gVAnsPx3OY1szrQ-oO351sZc',
    phone: '+65 8123 4567',
    email: 'kianna@gmail.com',
    linkedin: 'linkedin.com/in/kiannabaptista',
    location: '上海',
    languages: '英语, 中文',
    serviceYears: 5.3,
    totalWorkYears: 6.8,
    isOnline: true
  };

  return <HeaderCard profileData={profileData} />;
};

render(<HeaderCardExample />);
