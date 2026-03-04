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
