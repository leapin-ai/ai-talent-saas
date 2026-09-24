# 剪贴板导入数据格式

管理端「手动任务」里，下列任务支持工具栏 **从剪贴板导入**（JSON）。复制后点导入即可回填，不会自动提交。

| 任务 type | 中文名 | 完成组件 | 剪贴板根结构 |
| --- | --- | --- | --- |
| `position-ai-analysis` | AI岗位分析 | `PositionAnalysisTask` | 见 §1（仅岗位） |
| `position-analysis-review` | 完善岗位分析 | `PositionAnalysisTask` | 见 §1（仅岗位） |
| `assessment-profile-review` | 完善档案生成审核 | `AssessmentGenerateTask` | 见 §2 |

> **说明：** AI岗位分析 / 完善岗位分析 UI **已去掉组织步与个人步**，只编辑岗位内容。剪贴板以 **岗位对象** 为准；若仍带 `org` / `employees`，当前界面不会回填这两块（提交时组织取上下文，个人为空）。

---

## 1. AI岗位分析 / 完善岗位分析（仅岗位）

两个任务共用同一套解析与表单。推荐直接贴岗位对象（含 `verdict` / `skill` / `workforceStrategy` 等）。

### 1.1 推荐示例

```json
{
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
}
```

也可包一层：`{ "position": { ...同上... } }`（只认其中的岗位字段）。

### 1.2 字段对照

| 字段 | 必填 | 说明 |
| --- | --- | --- |
| `roleName` | 否 | 岗位名；数组导入时用于匹配当前岗位 |
| `verdict.summary` / `today` / `future` | 是（提交校验） | Role Outlook |
| `verdict.futureLabel` | 否 | 未来标签 |
| `verdict.aiEfficiencyGain` | 否 | 0–100（百分数） |
| `description` / `requirement` | 否 | HTML，工作内容 / 要求 |
| `developmentGoal` | 否 | 发展目标文案 |
| `skill[]` | 是（至少一项有效 Task） | 见下表 |
| `workforceStrategy[]` | 否 | Gap Recommendations；也可用别名 `strategies` |

#### `skill[]`（未来任务 / Task）

| 字段 | 必填 | 说明 |
| --- | --- | --- |
| `id` | 否 | 稳定 id |
| `name` | **是** | Task 标题（界面「Task」）；空项会被丢掉 |
| `activityCode` | 建议 | 如 `A01` |
| `activityTitle` | 建议 | 如 `Workforce need intake & role definition` |
| `activityGroup` | 否 | 也可直接给整串；否则由 code + title 拼 |
| `origin` | 是 | `existing` / `new` |
| `importanceNow` / `importanceYear` | 是 | 1–5 |
| `change` | 是 | 见枚举 |
| `aiExposure` / `confidence` | 否 | `high` / `medium` / `low` |
| `contentItems[]` | 否 | `{ title, description, source }`；也兼容旧字段 `jd` / `shockReport` 字符串 |

### 1.3 兼容形态

- 岗位数组：`[{ roleName, skill, ... }, ...]`，按当前岗位名匹配 `roleName`，否则取第一项。
- `workforceStrategy` 项里 `type` 可当 `action`；`description` 可当 `detail`。
- 历史整包 `{ org, position, employees }`：仍能解析出 `position` 并回填；`org` / `employees` **当前 UI 不使用**。

### 1.4 枚举

| 字段 | 取值 |
| --- | --- |
| `skill.origin` | `existing` / `new` |
| `skill.change` | `must_build` / `ai_emerging` / `new` / `enhanced` / `stable` / `declining` |
| `skill.aiExposure`、`skill.confidence` | `high` / `medium` / `low` |
| `skill.importanceNow`、`importanceYear` | 1–5 |
| `workforceStrategy.action` | `BUILD` / `MOVE` / `BUY` / `AUGMENT` |
| `verdict.aiEfficiencyGain` | 0–100 |

---

## 2. 完善档案生成审核

任务 type：`assessment-profile-review`。对应右侧草稿：`employee` + `profile` + `skillAnalysis` + `aiSuggest`。导入后会重算档案完成度，不自动提交。

完成提交时，`skillAnalysis` 会按 `skills[].name`（或 `title`）同步到岗位任务就绪度；名称需与 §1 里 `skill[].name`（Task 标题）一致。

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
        "evidence": [
          { "source": "简历", "title": "培训交付经历缺失", "summary": "未见培训方案设计、课程组织相关经历" },
          { "source": "AI面试", "title": "学习交付表述不足", "summary": "面试中未体现讲师管理或复盘改进经验" }
        ]
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
| `skillAnalysis` | 就绪度；`skills[].name` 或 `title`；**每项应含 `confidence`（high/medium/low）与 `evidence`**；也可用别名 `skillAnalysisDraft` / `readiness` |
| `aiSuggest` | `shortTerm` / `longTerm` / `matchPosition`；`match_rate` 用 **0–1**（`0.78` = 78%） |

### 2.3 兼容形态

- 扁平档案详情：顶层直接带 `name` / `email` / `profile` / `skillAnalysisDraft` 等。
- AI 填充 / 洞察返回体：`{ data, readiness, aiSuggest }`（`readiness` 会落到 `skillAnalysis`，其中 `skills[].confidence` 会一并导入）。

### 2.4 枚举

| 字段 | 取值 |
| --- | --- |
| `employee.gender` | `M` / `F` / `N` |
| `skillAnalysis.skills.status` | `critical` / `gap` / `onTarget` / `above` |
| `skillAnalysis.skills.current`、`required` | 0–5 |
| `skillAnalysis.skills.confidence` | `high` / `medium` / `low`（**导入与 AI 生成均应提供**；缺省时前端按证据推算，可在编辑证据中改） |
| `skillAnalysis.skills.evidence` | 推荐数组，见下表；兼容旧版字符串 |
| `aiSuggest.*.skill_gap[].level` | `high` / `medium` / `low` |

#### `skillAnalysis.skills[].evidence[]`

| 字段 | 必填 | 说明 |
| --- | --- | --- |
| `source` | **是** | 真实来源文案，如 `简历` / `AI面试` / `项目经历` / `JD` / `绩效`；**不要**写「分析依据」 |
| `title` | **是** | 该条证据短标题 |
| `summary` | **是** | 证据摘要正文 |
| `sourceType` | 否 | 可选枚举（`cv` / `ai_interview` / `project` 等）；有 `source` 即可 |

导入时若缺 `source` / `title` 会尽量补齐；**每一条**都应自带字段，不要只填数组第一项。

---

## 3. 跨任务对齐建议

1. **Task 标题唯一**：§1 `skill[].name` ↔ 档案 `skillAnalysis.skills[].name`（或 `title`）保持一致，否则就绪度无法挂到任务。
2. **先岗位、后档案**：先完成 AI岗位分析 / 完善岗位分析并落库任务，再在完善档案生成审核里导入 `skillAnalysis`。
3. **证据与置信度**：剪贴板 `skills[].evidence` 推荐 `[{ source, title, summary }, ...]`，**每一条都要有 source / title / summary**（不要只填第一条）。导入时会自动补齐缺失的 source/title。`skills[].confidence` 会原样写入草稿。也可在档案页「编辑证据」中改，并与置信度一起保存。

---

## 4. 导出数据

侧栏「导出数据」的 JSON 结构、字段与回贴说明见独立文档：

→ **[export-data-format.md](./export-data-format.md)**

| 场景 | 导出文件 | 可回贴导入 |
| --- | --- | --- |
| 岗位分析 | `analysis-data-*.json` → `position` | 本文 §1 |
| 档案审核 | `profile-data-*.json` → `employee` / `profile` / `skillAnalysis` / `aiSuggest` | 本文 §2（含 `confidence` 与 `evidence[{ source, title, summary }]`） |