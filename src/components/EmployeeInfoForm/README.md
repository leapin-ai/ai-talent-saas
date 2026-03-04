
# EmployeeInfoForm


### 概述

员工信息补充表单组件，用于补充和完善员工的档案信息。包含基本信息编辑、意向岗位管理、技能指标、兴趣爱好、流动性偏好、证书与执照等模块。支持动态添加和删除标签项。


### 示例(全屏)

#### 示例代码

- 基础示例
- 员工信息补充表单，支持添加/删除意向岗位、技能、兴趣爱好等
- _EmployeeInfoForm(@components/EmployeeInfoForm)

```jsx
const { default: EmployeeInfoForm } = _EmployeeInfoForm;

const BaseExample = () => {
  return <EmployeeInfoForm />;
};

render(<BaseExample />);

```

- ProfileCard - 个人资料卡片
- 展示和编辑员工基本信息（头像、姓名、联系方式等）
- _EmployeeInfoForm(@components/EmployeeInfoForm),remoteLoader(@kne/remote-loader)

```jsx
const { ProfileCard } = _EmployeeInfoForm;
const { createWithRemoteLoader } = remoteLoader;

const ProfileCardExample = createWithRemoteLoader({
  modules: ['components-core:FormInfo']
})(({ remoteModules }) => {
  const [FormInfo] = remoteModules;
  const { Form } = FormInfo;

  return (
    <div style={{ maxWidth: 400 }}>
      <Form onSubmit={data => console.log(data)}>
        <ProfileCard avatarUrl="https://lh3.googleusercontent.com/aida-public/AB6AXuC_AorCAIKZoI2DcahfuT4hT9GDUUaBpTlWUJr3Odohda9NuDi2rGCxWiHwow-OsNiPPrLtCIrMVU4Qgmrdt9H7-60ACubvKLb5EdJ8va-qaAPLMj_uaNUQ1Yolk_J-nfhIheltcXrRHkspotSFm3X6xjh9wKyM_NQYE_P3ACK6aNkJsUEoBca-5ursPSnyHnwZmAxZGHS2FUvH8E1piSMezqWm6H1XxWyU2Zm_G83zLtokX2mz2IOXE-TMwR6YKhDEbySePufNnvrE" />
      </Form>
    </div>
  );
});

render(<ProfileCardExample />);

```

- TagInputCard - 标签输入卡片
- 通用的标签输入组件，支持添加/删除标签项
- _EmployeeInfoForm(@components/EmployeeInfoForm)

```jsx
const { TagInputCard } = _EmployeeInfoForm;

const TagInputCardExample = () => {
  const [items, setItems] = React.useState(['数据分析师', '机器学习工程师']);

  return (
    <TagInputCard
      title="意向岗位"
      items={items}
      onAdd={() => setItems([...items, ''])}
      onRemove={index => setItems(items.filter((_, i) => i !== index))}
      onItemChange={(index, value) => {
        const newItems = [...items];
        newItems[index] = value;
        setItems(newItems);
      }}
      placeholder="请输入意向岗位"
    />
  );
};

render(<TagInputCardExample />);

```

- MobilityCard - 流动性偏好卡片
- 设置工作模式、出差意愿、外派意愿等偏好
- _EmployeeInfoForm(@components/EmployeeInfoForm),remoteLoader(@kne/remote-loader)

```jsx
const { MobilityCard } = _EmployeeInfoForm;
const { createWithRemoteLoader } = remoteLoader;

const MobilityCardExample = createWithRemoteLoader({
  modules: ['components-core:FormInfo']
})(({ remoteModules }) => {
  const [FormInfo] = remoteModules;
  const { Form } = FormInfo;

  return (
    <Form onSubmit={data => console.log(data)}>
      <MobilityCard />
    </Form>
  );
});

render(<MobilityCardExample />);

```

- CertificateCard - 证书与执照卡片
- 管理员工的证书和执照信息
- _EmployeeInfoForm(@components/EmployeeInfoForm)

```jsx
const { CertificateCard } = _EmployeeInfoForm;

const CertificateCardExample = () => {
  const [certificates, setCertificates] = React.useState(['大学英语六级', '心理咨询师', '认证数据分析师']);

  return (
    <CertificateCard
      items={certificates}
      onAdd={() => setCertificates([...certificates, ''])}
      onRemove={index => setCertificates(certificates.filter((_, i) => i !== index))}
      onItemChange={(index, value) => {
        const newItems = [...certificates];
        newItems[index] = value;
        setCertificates(newItems);
      }}
    />
  );
};

render(<CertificateCardExample />);

```


### API

## EmployeeInfoForm 主组件

|属性名|说明|类型|默认值|
|---|---|---|---|

## ProfileCard 子组件

|属性名|说明|类型|默认值|
|---|---|---|---|
|form|Form 实例|FormInstance|-|
|onFinish|表单提交回调|(values: object) => void|-|
|avatarUrl|头像 URL|string|-|

## TagInputCard 子组件

|属性名|说明|类型|默认值|
|---|---|---|---|
|title|卡片标题|string|-|
|icon|标题图标|ReactNode|-|
|items|标签列表|array|-|
|onAdd|添加标签回调|() => void|-|
|onRemove|删除标签回调|(index: number) => void|-|
|onItemChange|标签内容变化回调|(index: number, value: string) => void|-|
|placeholder|输入框占位符|string|-|
|buttonClassName|按钮样式类名|string|-|

## MobilityCard 子组件

|属性名|说明|类型|默认值|
|---|---|---|---|
|mobilityData|流动性数据|object|-|
|onChange|数据变化回调|(data: object) => void|-|

## CertificateCard 子组件

|属性名|说明|类型|默认值|
|---|---|---|---|
|items|证书列表|array|-|
|onAdd|添加证书回调|() => void|-|
|onRemove|删除证书回调|(index: number) => void|-|
|onItemChange|证书内容变化回调|(index: number, value: string) => void|-|

