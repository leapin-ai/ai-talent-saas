# MCP 使用引导

本服务通过 **3 个工具** 暴露已开启的业务接口（全局 allowlist）。目录默认收录 **全部** OpenAPI 接口（密钥 / 文件导出类仍默认 deny）。

## 工具

1. `describe_capabilities` — 阅读本引导与已开启能力目录
2. `search_apis` — 按关键词 / 场景搜索已开启接口
3. `call_api` — `mode=schema` 看参数；`mode=invoke` 执行

## 用法

```text
describe_capabilities
  → search_apis({ query: "..." })
  → call_api({ mode: "schema", operationId 或 method+path })
  → 向用户确认（若 confirm=true）
  → call_api({ mode: "invoke", ..., userConfirmed: true })
```

## 推荐场景（search_apis 的 scenario / query）

| 场景 | 用途 |
| --- | --- |
| 岗位管理 | 岗位 CRUD、编制、任务与技能分析 |
| 员工档案 | 员工、绩效、证据 |
| 就绪度 | 就绪度任务、问题与发布 |
| 人才盘点 | 盘点设置与盘点流程 |
| 人才采集 | 采集邀请、简历解析 |
| AI面试与分享 | AI 面试项目、分享报告、市场推荐 |
| 租户设置 | 首页等租户配置 |
| 租户权限与组织 | 角色、权限、组织、共享组、邮件 |
| 平台超管 | 平台侧租户/就绪度管理 |
| 公开免登录 | public 短链类接口 |
| 开放API密钥 | Signature |
| 系统与账号 | 账号、文件、任务等 |

## 禁忌

- 不要调用未出现在 search 结果中的路径
- 密钥管理、文件流导出等接口默认不可用
- 写操作执行前必须向用户确认
