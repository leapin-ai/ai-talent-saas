# 剪贴板导入数据格式

管理端「手动任务」里，下列三类任务支持工具栏 **从剪贴板导入**（JSON）。复制后点导入即可回填，不会自动提交。

| 任务 type | 中文名 | 完成组件 | 剪贴板根结构 |
| --- | --- | --- | --- |
| `position-ai-analysis` | AI岗位分析 | `PositionAnalysisTask` | 见 §1（与完善岗位分析相同） |
| `position-analysis-review` | 完善岗位分析 | `PositionAnalysisTask` | 见 §1 |
| `assessment-profile-review` | 完善档案生成审核 | `AssessmentGenerateTask` | 见 §2 |

---

## 1. AI岗位分析 / 完善岗位分析

两个任务共用同一套解析（`parseClipboardImportPayload`）。推荐一次贴整包，三步（组织 / 岗位 / 个人）都会缓存；当前步立即回填，其它步进入时自动带上。

### 1.1 整包示例

```json
{
  "org": {
    "departmentName": "产品部",
    "tenantOrgId": null
  },
  "position": {
    "roleName": "产品经理",
    "verdict": {
      "summary": "岗位判断摘要",
      "today": "当前状态",
      "future": "未来方向",
      "futureLabel": "2026–2030",
      "aiEfficiencyGain": 12
    },
    "description": "<p>岗位描述，支持 HTML</p>",
    "requirement": "<p>任职要求，支持 HTML</p>",
    "developmentGoal": "未来业务目标：2–3 年该岗位帮助业务实现什么",
    "skill": [
      {
        "id": "skill-1",
        "name": "Recruitment needs translation",
        "activityCode": "A01",
        "activityTitle": "Workforce need intake & role definition",
        "origin": "existing",
        "importanceNow": 3,
        "importanceYear": 4,
        "change": "enhanced",
        "aiExposure": "medium",
        "confidence": "high",
        "contentItems": [
          { "title": "依据标题", "description": "依据说明", "source": "JD / 访谈" }
        ]
      }
    ],
    "workforceStrategy": [
      { "action": "BUILD", "title": "内部培养", "detail": "说明" },
      { "action": "MOVE", "title": "内部调动", "detail": "说明" },
      { "action": "BUY", "title": "外部招聘", "detail": "说明" },
      { "action": "AUGMENT", "title": "AI 增强", "detail": "说明" }
    ]
  },
  "employees": [
    {
      "employeeId": "员工id",
      "employeeName": "张三",
      "readiness": 72,
      "summary": "就绪度总结",
      "metrics": { "criticalGaps": 1, "atOrAbove": 4, "monthsToClose": 6 },
      "skills": [
        {
          "id": "skill-1",
          "name": "Recruitment needs translation",
          "current": 2,
          "required": 4,
          "status": "gap",
          "evidence": "证据摘要（字符串）"
        }
      ],
      "priorityGaps": [
        { "rank": 1, "title": "优先缺口", "description": "说明", "current": 2, "required": 4 }
      ],
      "developmentPlan": {
        "subtitle": "发展计划副标题",
        "horizons": [
          {
            "key": "short",
            "label": "短期",
            "period": "0-3个月",
            "title": "阶段标题",
            "tone": "primary",
            "target": "阶段目标",
            "items": [
              { "tag": "技能名", "title": "行动", "meta": "细节" },
              { "tag": "技能名", "title": "行动", "meta": "细节" },
              { "tag": "技能名", "title": "行动", "meta": "细节" }
            ]
          },
          {
            "key": "mid",
            "label": "中期",
            "period": "3-6个月",
            "title": "阶段标题",
            "tone": "cyan",
            "target": "阶段目标",
            "items": [
              { "tag": "技能名", "title": "行动", "meta": "细节" },
              { "tag": "技能名", "title": "行动", "meta": "细节" },
              { "tag": "技能名", "title": "行动", "meta": "细节" }
            ]
          },
          {
            "key": "long",
            "label": "长期",
            "period": "6-12个月",
            "title": "阶段标题",
            "tone": "rose",
            "target": "阶段目标",
            "items": [
              { "tag": "技能名", "title": "行动", "meta": "细节" },
              { "tag": "技能名", "title": "行动", "meta": "细节" },
              { "tag": "技能名", "title": "行动", "meta": "细节" }
            ]
          }
        ]
      }
    }
  ]
}
```

### 1.2 三步字段对照

| 步骤 | 根字段 | 写入表单 | 说明 |
| --- | --- | --- | --- |
| 组织 | `org` | `departmentName`、`tenantOrgId` | 缺省时用当前岗位组织兜底 |
| 岗位 | `position`（或顶层岗位对象） | `verdict`、`description`、`requirement`、`developmentGoal`、`skill`、`workforceStrategy` | `skill[].name` 为空会被丢掉；`activityGroup` 可由 `activityCode` + `activityTitle` 推导 |
| 个人 | `employees[]` | 按当前任务员工列表回填每人的就绪度块 | 优先用 `employeeId` / `id` 对齐；对不上则按数组下标 |

#### `position.skill[]`（未来任务 / Task）

| 字段 | 必填 | 说明 |
| --- | --- | --- |
| `id` | 否 | 稳定 id，个人步 `skills[].id` 可同号对齐 |
| `name` | **是** | Task 标题（界面「Task」） |
| `activityCode` | 建议 | 如 `A01` |
| `activityTitle` | 建议 | 如 `Workforce need intake & role definition` |
| `activityGroup` | 否 | 也可直接给整串；否则由 code + title 拼 |
| `origin` | 是 | `existing` / `new` |
| `importanceNow` / `importanceYear` | 是 | 1–5 |
| `change` | 是 | 见下方枚举 |
| `aiExposure` / `confidence` | 否 | `high` / `medium` / `low` |
| `contentItems[]` | 否 | `{ title, description, source }`；也兼容旧字段 `jd` / `shockReport` 字符串 |

#### `employees[]` / 个人就绪度

每人可直接写在对象上，或包在 `analysis` 里（两种都能认）。

| 字段 | 说明 |
| --- | --- |
| `employeeId` / `id` | 与任务上下文员工 id 对齐 |
| `readiness` | 0–100 |
| `summary` | 就绪度总结 |
| `metrics.criticalGaps` / `atOrAbove` / `monthsToClose` | 指标 |
| `skills[]` | `{ id, name, current, required, status, evidence }`；`current`/`required` 为 0–5；`evidence` 为字符串 |
| `priorityGaps[]` | `{ rank, title, description, current, required }` |
| `developmentPlan` | `subtitle` + `horizons[3]`（`key/label/period/title/tone/target/items[3]`） |

个人步 `skills[].name` 应与岗位步 `skill[].name`（Task 标题）一致，后续档案就绪度按标题匹配任务。

### 1.3 兼容形态

- 只贴岗位对象：含 `skill` / `verdict` / `roleName` / `workforceStrategy` 任一即可。
- 岗位数组：`[{ roleName, skill, ... }, ...]`，按当前岗位名匹配 `roleName`，否则取第一项。
- `workforceStrategy` 也可用别名 `strategies`；项里 `type` 可当 `action`；`description` 可当 `detail`。
- `org` / `position` / `employees` 可只给其中一部分。

### 1.4 枚举

| 字段 | 取值 |
| --- | --- |
| `skill.origin` | `existing` / `new` |
| `skill.change` | `must_build` / `ai_emerging` / `new` / `enhanced` / `stable` / `declining` |
| `skill.aiExposure`、`skill.confidence` | `high` / `medium` / `low` |
| `skill.importanceNow`、`importanceYear` | 1–5 |
| `workforceStrategy.action` | `BUILD` / `MOVE` / `BUY` / `AUGMENT` |
| `verdict.aiEfficiencyGain` | 0–100（百分数） |
| `employees.readiness` | 0–100 |
| `employees.skills.status` | `critical` / `gap` / `onTarget` / `above` |
| `employees.skills.current`、`required` | 0–5 |
| `developmentPlan.horizons.tone` | `primary` / `cyan` / `rose` |

---

## 2. 完善档案生成审核

任务 type：`assessment-profile-review`。对应右侧草稿：`employee` + `profile` + `skillAnalysis` + `aiSuggest`。导入后会重算档案完成度，不自动提交。

完成提交时，`skillAnalysis` 会按 `skills[].name`（或 `title`）同步到岗位任务就绪度；名称需与岗位分析里的 Task 标题一致。

### 2.1 推荐结构

```json
{
  "employee": {
    "name": "张三",
    "phone": "13800000000",
    "email": "zhangsan@example.com",
    "gender": "M",
    "description": "个人简介",
    "city": "上海",
    "address": "详细地址",
    "college": "某某大学",
    "major": "计算机",
    "degree": 3,
    "options": {}
  },
  "profile": {
    "skills": {
      "work_related": ["需求分析", "SQL"],
      "cert_mapped": ["PMP"],
      "interest_strength": ["产品设计"]
    },
    "intentionPosition": ["产品经理"],
    "workPreference": {
      "work_mode_preference": "hybrid",
      "business_travel_willingness": "occasional",
      "relocation_willingness": "open"
    },
    "options": {
      "linkedin": "zhangsan"
    }
  },
  "skillAnalysis": {
    "readiness": 72,
    "summary": "就绪度总结",
    "metrics": { "criticalGaps": 1, "atOrAbove": 4, "monthsToClose": 6 },
    "skills": [
      {
        "id": "skill-1",
        "name": "Recruitment needs translation",
        "current": 2,
        "required": 4,
        "status": "gap",
        "confidence": "medium",
        "evidence": "证据摘要"
      }
    ],
    "priorityGaps": [
      { "rank": 1, "title": "优先缺口", "description": "说明", "current": 2, "required": 4 }
    ],
    "developmentPlan": {
      "subtitle": "发展计划副标题",
      "horizons": [
        {
          "key": "short",
          "title": "短期目标",
          "target": "阶段结果",
          "items": [{ "tag": "技能名", "title": "行动", "meta": "细节" }]
        },
        {
          "key": "mid",
          "title": "中期目标",
          "target": "阶段结果",
          "items": [{ "tag": "技能名", "title": "行动", "meta": "细节" }]
        },
        {
          "key": "long",
          "title": "长期目标",
          "target": "阶段结果",
          "items": [{ "tag": "技能名", "title": "行动", "meta": "细节" }]
        }
      ]
    }
  },
  "aiSuggest": {
    "shortTerm": {
      "target_position": "高级产品经理",
      "development_points": ["带项目", "跨部门协作"],
      "training_focus": ["数据分析"],
      "skill_gap": [{ "name": "数据分析", "level": "high" }]
    },
    "longTerm": {
      "target_position": "产品总监",
      "development_points": ["团队管理"],
      "training_focus": ["战略"],
      "skill_gap": [{ "name": "战略规划", "level": "medium" }]
    },
    "matchPosition": {
      "target_position": "产品经理",
      "match_rate": 0.78,
      "skill_match": ["需求分析"],
      "skill_gap": [{ "name": "SQL" }]
    }
  }
}
```

### 2.2 字段对照

| 块 | 字段要点 |
| --- | --- |
| `employee` | 姓名 / 手机 / 邮箱 / 性别 / 简介 / 城市地址 / 学历等；`draft-*` id 导入时会丢掉 |
| `profile` | `skills`、`intentionPosition`、`workPreference`、`options.linkedin` 等 |
| `skillAnalysis` | 与岗位分析个人步同构；`skills[].name` 或 `title`；也可用别名 `skillAnalysisDraft` / `readiness` |
| `aiSuggest` | `shortTerm` / `longTerm` / `matchPosition`；`match_rate` 用 **0–1**（`0.78` = 78%） |

### 2.3 兼容形态

- 扁平档案详情：顶层直接带 `name` / `email` / `profile` / `skillAnalysisDraft` 等。
- AI 填充返回体：`{ data, readiness, aiSuggest }`（`readiness` 会落到 `skillAnalysis`）。

### 2.4 枚举

| 字段 | 取值 |
| --- | --- |
| `employee.gender` | `M` / `F` / `N` |
| `skillAnalysis.skills.status` | `critical` / `gap` / `onTarget` / `above` |
| `skillAnalysis.skills.current`、`required` | 0–5 |
| `skillAnalysis.skills.confidence` | `high` / `medium` / `low`（可选） |
| `aiSuggest.*.skill_gap[].level` | `high` / `medium` / `low` |

---

## 3. 跨任务对齐建议

1. **岗位 Task 标题唯一**：`position.skill[].name` ↔ `employees[].skills[].name` ↔ 档案 `skillAnalysis.skills[].name`（或 `title`）保持一致，否则就绪度无法挂到任务。
2. **先岗位、后档案**：先完成 AI岗位分析 / 完善岗位分析并落库任务，再在完善档案生成审核里导入 `skillAnalysis`，提交时才会 `importSkillReadiness` 成功。
3. **证据**：岗位分析个人步与档案审核剪贴板目前认 **字符串** `evidence`；结构化证据仍走档案页证据编辑，不在本 JSON 里展开。
