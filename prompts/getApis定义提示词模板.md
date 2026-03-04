# 前端 getApis 定义生成提示词模板

> 基于 server/libs/controllers 和 src/components/Apis 代码结构总结

---

## 目录

- [概述](#1-概述)
- [getApis 结构说明](#2-getapis-结构说明)
- [定义提示词模板](#3-定义提示词模板)
- [完整示例](#4-完整示例)
- [命名规范](#5-命名规范)
- [注意事项](#6-注意事项)

---

## 1. 概述

`getApis` 是前端统一的 API 配置文件,用于集中管理后端接口定义。它将后端 Controller 中定义的路由转换为前端可调用的 API 对象。

### 文件位置

- 后端 Controller: `server/libs/controllers/[entityName].js`
- 前端 getApis: `src/components/Apis/getApis.js`

### 使用方式

```javascript
import { Apis } from '@components/Apis';

function MyComponent() {
  return (
    <Apis>
      {({ getApis }) => {
        const { employee } = getApis();
        // 使用 employee.list, employee.create 等
      }}
    </Apis>
  );
}
```

---

## 2. getApis 结构说明

### 2.1 基本结构

```javascript
const getApis = options => {
  const { prefix } = Object.assign({}, { prefix: '/api/v1' }, options);

  return {
    // 顶级模块名称 (对应后端路由前缀的一部分)
    moduleName: {
      // 子模块
      subModule: {
        // 接口定义
        actionName: {
          url: `${prefix}/module-path/action`,
          method: 'GET' // 或 'POST'
        }
      }
    }
  };
};
```

### 2.2 接口定义格式

#### 标准 REST 接口

```javascript
{
  url: `${prefix}/path/to/api`,
  method: 'GET' // 'GET' 或 'POST'
}
```

#### Loader 接口 (前端本地数据)

```javascript
{
  loader: () => []
}
```

### 2.3 Controller 对应关系

| 后端 Controller 路由 | getApis 路径映射 |
|---------------------|------------------|
| `${prefix}/admin/digital/getList` | `digital.getList` |
| `${prefix}/on-boarding/employee/list` | `onBoarding.employee.list` |
| `${prefix}/on-boarding/client/login` | `onBoarding.client.login` |

---

## 3. 定义提示词模板

### 3.1 完整提示词

```
请根据以下后端 Controller 接口定义,生成对应的 getApis 配置:

**后端 Controller 文件路径**: [如: server/libs/controllers/employee.js]

**后端接口定义**:
[列出所有的 fastify.get 和 fastify.post 路由定义,包括:
- 路由路径 (如: ${options.prefix}/on-boarding/employee/list)
- HTTP 方法 (GET/POST)
- 接口说明 (schema.summary)
- 认证方式 (onRequest 中间件)

**生成要求**:
1. 根据 Controller 路由自动推断模块层级结构
2. 使用 ${prefix} 作为 API 前缀变量
3. 确保方法名 (actionName) 与接口功能对应
4. 模块命名参考已有模块结构:
   - admin/* 模块 -> digital, tenant 等
   - on-boarding/* 模块 -> onBoarding.employee, onBoarding.flow, onBoarding.client 等
5. 接口路径中操作名称映射:
   - /list -> list
   - /create -> create
   - /save -> save
   - /remove -> remove
   - /set-status -> setStatus
   - /set-employee -> setEmployee (驼峰命名)
   - /flow-data-list -> flowDataList
   - /get-list -> getList (保留 get 前缀)
   - /custom-component-detail -> customComponentDetail

6. 对于 GET 请求使用 method: 'GET'
7. 对于 POST 请求使用 method: 'POST'

**输出格式**:
请在现有 getApis 对象的对应模块下添加新的接口定义,保持代码格式一致。
```

### 3.2 分类提示词

#### 3.2.1 增删改查标准接口

```
**实体名称**: [EntityName] (如: employee, task, flow)
**模块路径**: [如: on-boarding/employee]

**接口列表**:
- 列表: GET /list
- 创建: POST /create
- 更新: POST /save
- 删除: POST /remove
- 设置状态: POST /set-status (可选)

**生成 getApis 配置**:
```

#### 3.2.2 管理后台接口

```
**实体名称**: [EntityName] (如: digital)
**模块路径**: [如: admin/digital]

**接口列表**:
- 获取列表: GET /getList
- 添加: POST /add
- 保存: POST /save
- 删除: POST /remove

**生成 getApis 配置**:
```

#### 3.2.3 自定义业务接口

```
**接口功能描述**: [如: 设置学员]
**实体名称**: [EntityName] (如: flow)
**操作名称**: [ActionName] (如: set-employee)
**HTTP 方法**: [GET/POST]
**接口路径**: [如: on-boarding/flow/set-employee]

**生成 getApis 配置**:
```

---

## 4. 完整示例

### 4.1 后端 Controller (employee.js)

```javascript
const fp = require('fastify-plugin');

module.exports = fp(async (fastify, options) => {
  const { services } = fastify[options.name];
  const { authenticate: tenantAuthenticate } = fastify.tenant;
  const { authenticate } = fastify.account;

  fastify.get(
    `${options.prefix}/on-boarding/employee/list`,
    {
      onRequest: [authenticate.user, tenantAuthenticate.tenantUser],
      schema: {
        summary: '员工列表',
        query: {
          type: 'object',
          properties: {
            filter: { type: 'object', default: {} },
            perPage: { type: 'number', default: 20 },
            currentPage: { type: 'number', default: 1 }
          }
        }
      }
    },
    async request => {
      return services.employee.list(request.tenantUserInfo, request.query);
    }
  );

  fastify.post(
    `${options.prefix}/on-boarding/employee/create`,
    {
      onRequest: [authenticate.user, tenantAuthenticate.tenantUser],
      schema: {
        summary: '添加员工',
        body: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            phone: { type: 'string', default: '' },
            email: { type: 'string', default: '' }
          },
          required: ['name']
        }
      }
    },
    async request => {
      return services.employee.create(request.tenantUserInfo, request.body);
    }
  );

  fastify.post(
    `${options.prefix}/on-boarding/employee/save`,
    {
      onRequest: [authenticate.user, tenantAuthenticate.tenantUser],
      schema: {
        summary: '修改员工信息',
        body: {
          type: 'object',
          properties: {
            id: { type: 'string' }
          }
        }
      }
    },
    async request => {
      await services.employee.save(request.tenantUserInfo, request.body);
      return {};
    }
  );

  fastify.post(
    `${options.prefix}/on-boarding/employee/set-status`,
    {
      onRequest: [authenticate.user, tenantAuthenticate.tenantUser],
      schema: {
        summary: '修改员工状态',
        body: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            status: { type: 'string' }
          }
        }
      }
    },
    async request => {
      await services.employee.setStatus(request.tenantUserInfo, request.body);
      return {};
    }
  );

  fastify.post(
    `${options.prefix}/on-boarding/employee/remove`,
    {
      onRequest: [authenticate.user, tenantAuthenticate.tenantUser],
      schema: {
        summary: '删除员工',
        body: {
          type: 'object',
          properties: {
            id: { type: 'string' }
          },
          required: ['id']
        }
      }
    },
    async request => {
      await services.employee.remove(request.tenantUserInfo, request.body);
      return {};
    }
  );
});
```

### 4.2 对应的 getApis 配置

```javascript
const getApis = options => {
  const { prefix } = Object.assign({}, { prefix: '/api/v1' }, options);

  return {
    onBoarding: {
      employee: {
        list: {
          url: `${prefix}/on-boarding/employee/list`,
          method: 'GET'
        },
        create: {
          url: `${prefix}/on-boarding/employee/create`,
          method: 'POST'
        },
        save: {
          url: `${prefix}/on-boarding/employee/save`,
          method: 'POST'
        },
        setStatus: {
          url: `${prefix}/on-boarding/employee/set-status`,
          method: 'POST'
        },
        remove: {
          url: `${prefix}/on-boarding/employee/remove`,
          method: 'POST'
        }
      }
    }
  };
};
```

### 4.3 管理后台示例 (digital.js)

#### 后端 Controller

```javascript
fastify.get(
  `${options.prefix}/admin/digital/getList`,
  {
    schema: {
      tags: ['管理后台'],
      summary: '获取数字人列表',
      query: {
        type: 'object',
        properties: {
          perPage: { type: 'number' },
          currentPage: { type: 'number' }
        }
      }
    }
  },
  async request => {
    const { filter, perPage, currentPage } = Object.assign(
      { perPage: 20, currentPage: 1 },
      request.query
    );
    return await services.digital.getDigitalList({ filter, perPage, currentPage });
  }
);

fastify.post(
  `${options.prefix}/admin/digital/add`,
  {
    onRequest: [authenticate.user, authenticate.admin],
    schema: {
      tags: ['管理后台'],
      summary: '添加数字人',
      body: {}
    }
  },
  async request => {
    await services.digital.addDigital(request.body);
    return {};
  }
);

fastify.post(
  `${options.prefix}/admin/digital/save`,
  {
    onRequest: [authenticate.user, authenticate.admin],
    schema: {
      tags: ['管理后台'],
      summary: '修改数字人信息',
      body: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string' },
          name: { type: 'string' }
        }
      }
    }
  },
  async request => {
    await services.digital.saveDigital(request.body);
    return {};
  }
);

fastify.post(
  `${options.prefix}/admin/digital/remove`,
  {
    onRequest: [authenticate.user, authenticate.admin],
    schema: {
      tags: ['管理后台'],
      summary: '删除数字人',
      body: {
        type: 'object',
        required: ['id'],
        properties: { id: { type: 'string' } }
      }
    }
  },
  async request => {
    await services.digital.removeDigital({ id: request.body.id });
    return {};
  }
);
```

#### 对应 getApis 配置

```javascript
digital: {
  getList: {
    url: `${prefix}/admin/digital/getList`,
    method: 'GET'
  },
  list: {  // 别名
    url: `${prefix}/admin/digital/getList`,
    method: 'GET'
  },
  add: {
    url: `${prefix}/admin/digital/add`,
    method: 'POST'
  },
  save: {
    url: `${prefix}/admin/digital/save`,
    method: 'POST'
  },
  remove: {
    url: `${prefix}/admin/digital/remove`,
    method: 'POST'
  }
}
```

### 4.4 复杂业务接口示例 (flow.js)

#### 后端 Controller

```javascript
fastify.post(
  `${options.prefix}/on-boarding/flow/create`,
  { /* ... */ },
  async request => {
    return services.flow.create(request.tenantUserInfo, request.body);
  }
);

fastify.get(
  `${options.prefix}/on-boarding/flow/list`,
  { /* ... */ },
  async request => {
    return services.flow.list(request.tenantUserInfo, request.query);
  }
);

fastify.post(
  `${options.prefix}/on-boarding/flow/set-employee`,
  {
    schema: {
      summary: '设置学员',
      body: {
        type: 'object',
        properties: {
          employeeIds: { type: 'array', items: { type: 'string' } },
          id: { type: 'string' }
        }
      }
    }
  },
  async request => {
    await services.flow.setEmployee(request.tenantUserInfo, request.body);
    return {};
  }
);

fastify.get(
  `${options.prefix}/on-boarding/flow/flow-data-list`,
  { /* ... */ },
  async request => {
    return services.flow.flowDataList(request.tenantUserInfo, request.query);
  }
);
```

#### 对应 getApis 配置

```javascript
onBoarding: {
  flow: {
    create: {
      url: `${prefix}/on-boarding/flow/create`,
      method: 'POST'
    },
    list: {
      url: `${prefix}/on-boarding/flow/list`,
      method: 'GET'
    },
    remove: {
      url: `${prefix}/on-boarding/flow/remove`,
      method: 'POST'
    },
    save: {
      url: `${prefix}/on-boarding/flow/save`,
      method: 'POST'
    },
    setStatus: {
      url: `${prefix}/on-boarding/flow/set-status`,
      method: 'POST'
    },
    setEmployee: {  // 连字符转驼峰
      url: `${prefix}/on-boarding/flow/set-employee`,
      method: 'POST'
    },
    flowDataList: {  // 连字符转驼峰
      url: `${prefix}/on-boarding/flow/flow-data-list`,
      method: 'GET'
    }
  }
}
```

### 4.5 Loader 接口示例 (前端本地数据)

```javascript
onBoarding: {
  workspace: {
    employeeStatus: {
      loader: () => []
    },
    flowAndTask: {
      loader: () => []
    },
    progressData: {
      loader: () => []
    },
    completionRate: {
      loader: () => []
    },
    trendAnalysis: {
      loader: () => []
    },
    warningList: {
      loader: () => []
    }
  }
}
```

---

## 5. 命名规范

### 5.1 模块命名

| 后端路由前缀 | getApis 模块名 |
|-------------|----------------|
| `admin/*` | `digital`, `tenant` (顶级模块) |
| `on-boarding/employee/*` | `onBoarding.employee` |
| `on-boarding/flow/*` | `onBoarding.flow` |
| `on-boarding/task/*` | `onBoarding.task` |
| `on-boarding/client/*` | `onBoarding.client` |
| `rag/*` | `onBoarding.rag` |

### 5.2 操作命名 (actionName)

| 后端路由后缀 | actionName |
|-------------|------------|
| `/list` | `list` |
| `/create` | `create` |
| `/save` | `save` |
| `/remove` | `remove` |
| `/set-status` | `setStatus` |
| `/set-employee` | `setEmployee` (连字符转驼峰) |
| `/flow-data-list` | `flowDataList` (连字符转驼峰) |
| `/get-list` | `getList` (保留 get) |
| `/custom-component-detail` | `customComponentDetail` (连字符转驼峰) |
| `/task-detail` | `taskDetail` (连字符转驼峰) |

### 5.3 转换规则

```javascript
// 连字符转驼峰
set-employee -> setEmployee
flow-data-list -> flowDataList
custom-component-detail -> customComponentDetail

// 保留特定前缀
get-list -> getList (不是 list)
```

---

## 6. 注意事项

### 6.1 路径转换

1. **前缀变量**: 始终使用 `${prefix}` 而不是硬编码 `/api/v1`
2. **完整路径**: url 必须包含完整的 API 路径
3. **大小写**: 保持后端路由中的原始大小写 (kebab-case)

### 6.2 HTTP 方法

- `fastify.get` → `method: 'GET'`
- `fastify.post` → `method: 'POST'`
- `fastify.put` → `method: 'PUT'`
- `fastify.delete` → `method: 'DELETE'`

### 6.3 方法名选择

- 如果路由以 `get-` 开头,actionName 保留 `get` 前缀
- 如果路由以 `set-` 开头,actionName 使用 `setXxx` 格式
- 连字符分隔的多个词全部转为驼峰

### 6.4 别名处理

可以为同一个接口创建多个别名,方便不同场景调用:

```javascript
getList: {
  url: `${prefix}/admin/digital/getList`,
  method: 'GET'
},
list: {  // 别名
  url: `${prefix}/admin/digital/getList`,
  method: 'GET'
}
```

### 6.5 参数占位符

如果接口路径包含参数占位符,在 url 中保持不变:

```javascript
{
  url: `${prefix}/rag/chats/{chat_id}/sessions`,
  method: 'POST'
}
```

### 6.6 本地数据接口

对于不需要调用后端接口的本地数据,使用 `loader`:

```javascript
{
  loader: () => []  // 或返回其他本地数据
}
```

---

## 7. 快速生成检查清单

根据 Controller 生成 getApis 时,请确认:

- [ ] 所有 fastify.get 和 fastify.post 都有对应配置
- [ ] url 使用 `${prefix}` 变量
- [ ] method 正确设置 (GET/POST)
- [ ] actionName 符合命名规范 (驼峰命名)
- [ ] 模块层级结构合理
- [ ] 连字符正确转换为驼峰
- [ ] 特殊前缀 (如 get-) 正确保留
- [ ] 参数占位符格式正确
- [ ] 代码格式与现有代码一致

---

## 8. 常见错误示例

### 错误 1: 硬编码前缀

```javascript
// ❌ 错误
list: {
  url: '/api/v1/on-boarding/employee/list',
  method: 'GET'
}

// ✅ 正确
list: {
  url: `${prefix}/on-boarding/employee/list`,
  method: 'GET'
}
```

### 错误 2: 命名不规范

```javascript
// ❌ 错误
set_employee: {  // 使用了下划线
  url: `${prefix}/on-boarding/flow/set-employee`,
  method: 'POST'
}

// ✅ 正确
setEmployee: {  // 使用驼峰
  url: `${prefix}/on-boarding/flow/set-employee`,
  method: 'POST'
}
```

### 错误 3: 方法错误

```javascript
// ❌ 错误
list: {
  url: `${prefix}/on-boarding/employee/list`,
  method: 'POST'  // 应该是 GET
}

// ✅ 正确
list: {
  url: `${prefix}/on-boarding/employee/list`,
  method: 'GET'
}
```

### 错误 4: 特殊前缀处理不当

```javascript
// ❌ 错误
getList: {  // 丢失了 get 前缀
  url: `${prefix}/admin/digital/get-list`,
  method: 'GET'
}

// ✅ 正确
getList: {  // 保留 get 前缀
  url: `${prefix}/admin/digital/get-list`,
  method: 'GET'
}
```

---

*最后更新: 2026-02-10*
