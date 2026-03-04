
# EnumLoader


### 概述

枚举加载器组件，用于集中管理应用中的枚举数据。通过 render props 模式向子组件提供枚举数据，实现枚举的统一获取和管理。


### 示例

#### 示例代码

- 基础示例
- 枚举加载器，用于获取枚举数据
- _EnumLoader(@components/EnumLoader)

```jsx
const { default: EnumLoader } = _EnumLoader;
const BaseExample = () => {
  return <EnumLoader />;
};

render(<BaseExample />);

```


### API

|属性名|说明|类型|默认值|
|---|---|---|---|
|children|渲染函数，接收枚举数据作为参数|(enums: object) => ReactNode|-|

