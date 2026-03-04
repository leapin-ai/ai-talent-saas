
# Position


### 概述

# Position 模块

Position 模块是职位管理的业务组件，提供完整的职位 CRUD 功能。

## 主要功能

- 职位列表展示，支持筛选和搜索
- 创建职位
- 编辑职位
- 删除职位
- 查看职位详情

## 技术栈

- React 18+
- Ant Design 5.x
- @kne/remote-loader
- @kne/react-fetch
- BizUnit 核心业务单元组件


### 示例(全屏)

#### 示例代码

- Position列表
- 展示职位列表，支持创建、编辑、删除等操作
- _Position(@components/Position),_mockPreset(@root/mockPreset),remoteLoader(@kne/remote-loader)

```jsx
const { default: Position } = _Position;
const { default: preset } = _mockPreset;
const { createWithRemoteLoader } = remoteLoader;

const PositionExample = createWithRemoteLoader({
  modules: ['components-core:Global@usePreset']
})(({ remoteModules }) => {
  const [usePreset] = remoteModules;
  const { apis } = usePreset();
  return <Position baseUrl="/tenant" apis={apis.talentSaas.tenant.position} />;
});

const BaseExample = createWithRemoteLoader({
  modules: ['components-core:Global@PureGlobal']
})(({ remoteModules }) => {
  const [PureGlobal] = remoteModules;
  return (
    <PureGlobal preset={preset}>
      <PositionExample />
    </PureGlobal>
  );
});

render(<BaseExample />);

```


### API

## Position 主组件

|属性名|说明|类型|默认值|
|---|---|---|---|
| baseUrl | 路由基础路径 | string | '/' |
| apis | API配置对象 | object | - |
| apis.tenant.position.create | 创建API | object | - |
| apis.tenant.position.list | 列表API | object | - |
| apis.tenant.position.save | 保存API | object | - |
| onDetail | 查看详情回调 | function | - |

## 数据结构

### Position 列表返回数据
| 字段 | 说明 | 类型 |
|------|------|------|
| id | ID | string |
| name | 职位名称 | string |
| description | 描述 | string |
| requirement | 要求 | string |
| language | 语言 | string |
| locationType | 工作地点类型 | string |
| status | 状态 | string |
| publishAt | 发布时间 | date |
| createdAt | 创建时间 | date |

### 状态枚举
| 值 | 说明 |
|---|---|
| draft | 草稿 |
| published | 已发布 |
| closed | 已关闭 |

### 语言枚举
| 值 | 说明 |
|---|---|
| zh-CN | 中文 |
| en-US | 英文 |

### 工作地点类型枚举
| 值 | 说明 |
|---|---|
| on-site | 现场 |
| remote | 远程 |

