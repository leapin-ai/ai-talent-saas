# Phase2 数据口径（D0）

**日期：** 2026-09-21  
**项目：** ai-talent-saas  
**依据：** Figma 管理端 Sticky `839:25310`（米其林原型 · 原型-0914）

## 岗位列表 Status

列表主列只展示 `assessmentStatus`，不把发布态冒充 Status。

| 值 | 含义 |
|----|------|
| `pending` | 已纳入范围，尚未成功发出第一份访谈邀请 |
| `interviews_in_progress` | 已发出邀请，分析结果尚未生成 |
| `completed` | 分析结果已生成，可查看 Role Insights |

`draft|published|closed` 仅用于上下架。`closed` 不计入 Roles in Scope。

## KPI

| KPI | 计算 |
|-----|------|
| Roles in Scope | `status !== closed` |
| Roles Requiring Change | `assessmentStatus=completed` 且 `changeMagnitude ∈ {medium,high}` |
| High-Change Roles | `completed` 且 `changeMagnitude=high` |
| Assessments Remaining | 范围内未完成分析的**岗位数** = `pending + interviews_in_progress` |

人维度待评不占用 Assessments Remaining。

## Role Insights

沿用 `start-analysis` → `complete-analysis`。写回 `position.outlook`、`t_position_task`、`t_position_workforce_strategy`。不新建任务类型。旧 `verdict` / 以 `skill[]` 充当 Insights 主数据在导入后废弃。

## 枚举

```text
changeTag: critical_to_build | ai_emerging | new | increasing | stable | decreasing
confidence: high | medium | low
workforceAction: BUILD | MOVE | BUY | AUGMENT
importanceNow / importanceFuture: 1..5
taskReadiness.status: critical | gap | onTarget | above
current / required: 0..5
```

## Evidence 与完成度

`sourceType`：`cv | linkedin | ai_interview | project | certification | jd | performance | external`

Profile Completion 六项等权（0–100）：基础信息、CV、LinkedIn、项目经历、AI 面试、审核通过。落库 `profileCompletionPercent` + `profileCompletionChecklist`。

## 采集主路径

员工数据采集仅 AI 面试邀请 → `/collect-profile`。完成后 `enterGenerating` → 既有任务 `assessment-profile-review`。废弃 Home 自助 `/complete-profile`。任务左栏 AI 面试 Tab 使用 open-api `project/interview-detail`。
