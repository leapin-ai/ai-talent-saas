
# TalentMarket


### 概述

人才市场首页组件，用于展示内部人才库中的推荐候选人列表。支持搜索、筛选功能，展示候选人的基本信息、核心技能和优势，并支持切换暗黑模式。


### 示例(全屏)

#### 示例代码

- 基础示例
- 人才市场首页，展示推荐候选人列表
- _TalentMarket(@components/TalentMarket)

```jsx
const { default: TalentMarket } = _TalentMarket;

const BaseExample = () => {
  return <TalentMarket />;
};

render(<BaseExample />);

```

- Header - 页面头部
- 人才市场页面头部，包含欢迎语、搜索栏和筛选按钮
- _TalentMarket(@components/TalentMarket)

```jsx
const { Header } = _TalentMarket;

const HeaderExample = () => {
  const [searchValue, setSearchValue] = React.useState('');

  return <Header searchValue={searchValue} onSearchChange={setSearchValue} onFilterToggle={() => console.log('Toggle filter')} />;
};

render(<HeaderExample />);

```

- TalentGrid - 候选人网格
- 候选人卡片网格布局，展示推荐候选人列表
- _TalentMarket(@components/TalentMarket)

```jsx
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

```

- TalentCard - 候选人卡片
- 单个候选人信息卡片，展示基本信息、技能和优势
- _TalentMarket(@components/TalentMarket)

```jsx
const { TalentCard } = _TalentMarket;

const TalentCardExample = () => {
  const talent = {
    id: 1,
    name: '张三三',
    position: '数据分析师',
    avatar:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuDvPAB0O641DVkigN2YUUsCo3jIvsHcp4OSFJjmz0fPhorqdvR4efVlRQ5l_rwJfrDW5MYuaggIE0eoLk1WYVo8SJ-hKhsE_VLIn_fIcqid0sEtVW6X9Yzle7oVtbY8O8yw2sFJ98QToZJXYweEiPoPMDjgu3-SqCokd9C79qBpgmtBr4xN-SX7pyZkfZH7LsuNTL5EmXaeteqQs9un1Fsj_hbojeqzcsjFHrkH5jW3K68PWJ9hNKNgYYhEVwiCv6jtbW94jil8prPe',
    status: 'employed',
    skills: ['分析市场需求', '制定解决方案', '数据可视化'],
    advantages: ['擅长数据可视化', '数据洞察', '团队领导力']
  };

  return <TalentCard talent={talent} onViewProfile={talent => console.log('查看:', talent)} />;
};

render(<TalentCardExample />);

```


### API

## TalentMarket 主组件

|属性名|说明|类型|默认值|
|---|---|---|---|

## Header 子组件

|属性名|说明|类型|默认值|
|---|---|---|---|
|searchValue|搜索框值|string|-|
|onSearchChange|搜索框值变化回调|(value: string) => void|-|
|onFilterToggle|筛选按钮点击回调|() => void|-|

## TalentGrid 子组件

|属性名|说明|类型|默认值|
|---|---|---|---|
|talents|候选人数据列表|array|[]|
|onViewProfile|点击查看档案时的回调函数|(talent: object) => void|-|

## TalentCard 子组件

|属性名|说明|类型|默认值|
|---|---|---|---|
|talent|候选人数据|object|-|
|onViewProfile|点击查看档案时的回调函数|(talent: object) => void|-|

