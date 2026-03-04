
# TalentProfile


### 概述

人才档案详情组件，用于展示员工的完整档案信息。包含个人基本信息、核心优势、技能指标雷达图、晋升历史、绩效评价、AI职业成长规划、AI推荐岗位等模块。


### 示例(全屏)

#### 示例代码

- 基础示例
- 人才档案详情页，展示员工完整信息
- _TalentProfile(@components/TalentProfile)

```jsx
const { default: TalentProfile } = _TalentProfile;

const BaseExample = () => {
  return <TalentProfile />;
};

render(<BaseExample />);

```

- HeaderCard - 档案头部卡片
- 展示员工头像、姓名、联系方式等基本信息
- _TalentProfile(@components/TalentProfile)

```jsx
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

```

- AdvantagesCard - 优势卡片
- 展示员工的核心优势，分类展示不同维度的能力
- _TalentProfile(@components/TalentProfile)

```jsx
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

```

- SkillRadarChart - 技能雷达图
- 使用 ECharts 展示技能指标雷达图，对比员工与行业平均水平
- _TalentProfile(@components/TalentProfile)

```jsx
const { SkillRadarChart } = _TalentProfile;

const SkillRadarChartExample = () => {
  const skillRadarData = {
    employee: [85, 88, 75, 92, 85, 78],
    industry: [65, 72, 80, 75, 68, 85]
  };

  return <SkillRadarChart data={skillRadarData} />;
};

render(<SkillRadarChartExample />);

```

- LeftColumn - 左侧栏
- 档案左侧栏，包含优势卡片、任职时长、证书、晋升历史
- _TalentProfile(@components/TalentProfile)

```jsx
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

```

- MiddleColumn - 中间栏
- 档案中间栏，包含技能雷达图、意向岗位、流动性偏好、兴趣爱好、绩效评价
- _TalentProfile(@components/TalentProfile)

```jsx
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

```

- RightColumn - 右侧栏
- 档案右侧栏，包含 AI 职业成长规划和 AI 推荐岗位
- _TalentProfile(@components/TalentProfile)

```jsx
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

```


### API

## TalentProfile 主组件

|属性名|说明|类型|默认值|
|---|---|---|---|

## HeaderCard 子组件

|属性名|说明|类型|默认值|
|---|---|---|---|
|profileData|员工档案数据|object|-|

## AdvantagesCard 子组件

|属性名|说明|类型|默认值|
|---|---|---|---|
|advantages|优势数据列表|array|-|

## SkillRadarChart 子组件

|属性名|说明|类型|默认值|
|---|---|---|---|
|data|雷达图数据|object|-|

## LeftColumn 子组件

|属性名|说明|类型|默认值|
|---|---|---|---|
|profileData|员工档案数据|object|-|
|advantages|优势数据列表|array|-|
|certificates|证书列表|array|-|
|promotionHistory|晋升历史|array|-|

## MiddleColumn 子组件

|属性名|说明|类型|默认值|
|---|---|---|---|
|skillTags|技能标签|array|-|
|targetPositions|意向岗位|array|-|
|mobilityPreferences|流动性偏好|array|-|
|interests|兴趣爱好|array|-|
|performanceReviews|绩效评价|array|-|
|skillRadarData|技能雷达图数据|object|-|

## RightColumn 子组件

|属性名|说明|类型|默认值|
|---|---|---|---|
|careerPath|职业路径|array|-|
|aiRecommendations|AI推荐|array|-|

