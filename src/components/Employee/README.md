
# Employee


### 概述

Employee 组件是一个完整的员工管理业务单元，基于 BizUnit 架构模式构建。提供了员工列表展示、筛选、创建、编辑、删除等完整的 CRUD 功能。

### 主要功能

- **列表展示**: 显示员工基本信息，支持关键字搜索、状态和性别筛选
- **筛选功能**: 按员工状态（在职、离职、停薪留职等）和性别筛选
- **CRUD操作**: 完整的创建、查看详情、编辑、删除功能
- **表单管理**: 分组展示员工信息，包括基本信息、联系方式、教育信息、身份信息等
- **国际化**: 支持中英文切换

### 技术特点

- 使用 BizUnit 组件封装核心业务逻辑
- 集成 FormInfo 组件实现表单字段管理
- 支持多语言国际化
- 响应式设计，适配不同屏幕尺寸


### 示例(全屏)

#### 示例代码

- Employee列表
- 展示员工列表，支持创建、编辑、删除等操作
- _Employee(@components/Employee),_mockPreset(@root/mockPreset),remoteLoader(@kne/remote-loader)

```jsx
const { default: Employee } = _Employee;
const { default: preset } = _mockPreset;
const { createWithRemoteLoader } = remoteLoader;

const EmployeeExample = createWithRemoteLoader({
  modules: ['components-core:Global@usePreset']
})(({ remoteModules }) => {
  const [usePreset] = remoteModules;
  const { apis } = usePreset();
  return <Employee baseUrl="/tenant" apis={apis.talentSaas.tenant.employee} />;
});

const BaseExample = createWithRemoteLoader({
  modules: ['components-core:Global@PureGlobal']
})(({ remoteModules }) => {
  const [PureGlobal] = remoteModules;
  return (
    <PureGlobal preset={preset}>
      <EmployeeExample />
    </PureGlobal>
  );
});

render(<BaseExample />);

```


### API

## Employee 主组件

|属性名|说明|类型|默认值|
|---|---|---|---|
| baseUrl | 路由基础路径 | string | '/' |
| apis | API配置对象 | object | - |
| apis.employee.list | 列表API | object | - |
| apis.employee.detail | 详情API | object | - |
| apis.employee.create | 创建API | object | - |
| apis.employee.save | 保存API | object | - |
| apis.employee.setStatus | 设置状态API | object | - |
| apis.employee.remove | 删除API | object | - |
| onDetail | 查看详情回调 | function | - |

## 数据结构

### employeeList 返回数据
| 字段 | 说明 | 类型 |
|------|------|------|
| id | ID | number |
| name | 姓名 | string |
| nameEn | 姓名(英文) | string |
| status | 状态 | string |
| gender | 性别 | string |
| email | 邮箱 | string |
| phone | 电话号码 | string |
| college | 毕业院校 | string |
| degree | 学历 | integer |
| city | 所在城市 | string |
| hireDate | 入职日期 | date |
| description | 简介 | text |
| createdAt | 创建时间 | datetime |
| updatedAt | 更新时间 | datetime |

