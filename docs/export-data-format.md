# 导出数据格式

管理端「手动任务」侧栏的 **导出数据** 会下载一份 JSON（空字段会被省略）。实现见 `src/components/PositionAnalysisTask/exportInterviewData.js`。

| 任务 type | 中文名 | 文件名 | 主要用途 |
| --- | --- | --- | --- |
| `position-ai-analysis` / `position-analysis-review` | AI岗位分析 / 完善岗位分析 | `analysis-data-{岗位名}.json` | 上下文（岗位 / 公司 / 面试）+ 可回贴的岗位结构 |
| `assessment-profile-review` | 完善档案生成审核 | `profile-data-{姓名}.json` | 上下文（简历 / 填写 / 面试）+ 可回贴的 reviewData |

与剪贴板导入的对应关系见 [clipboard-import-data-format.md](./clipboard-import-data-format.md)。

> **说明：** 导出不会自动提交任务；空值、空数组、空对象不会写入 JSON。

---

## 1. AI岗位分析 / 完善岗位分析

侧栏点「导出数据」→ `analysis-data-*.json`。

### 1.1 根结构

```json
{
  "position": { },
  "company": { },
  "questionnaire": { },
  "questions": [ ]
}
```

| 字段 | 说明 |
| --- | --- |
| `position` | 岗位快照，见 §1.2；可对照 / 回贴 [导入 §1](./clipboard-import-data-format.md) |
| `company` | 租户公司信息（名称、行业、规模等） |
| `questionnaire` | 调研问卷可读答案（有 schema 时展开）；可含 `submittedAt` |
| `questions` | AI 面试题目与作答列表（含视频题转写等） |

本任务 UI 已去掉组织步 / 个人步，导出 **不含** `org` / `employees`。

### 1.2 `position`（与导入 §1 对齐）

```json
{
  "id": "岗位id",
  "name": "产品经理",
  "roleName": "产品经理",
  "department": "产品部",
  "tenantOrgId": null,
  "language": "zh-CN",
  "description": "<p>工作内容</p>",
  "requirement": "<p>任职要求</p>",
  "developmentGoal": "未来业务目标",
  "verdict": {
    "summary": "岗位判断摘要",
    "today": "当前状态",
    "future": "未来方向",
    "futureLabel": "2026–2030",
    "aiEfficiencyGain": 12
  },
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
    { "action": "BUILD", "title": "内部培养", "detail": "说明" }
  ],
  "changeMagnitude": "medium"
}
```

| 字段 | 说明 |
| --- | --- |
| `roleName` / `name` | 岗位名；回贴导入时可用 `roleName` 匹配 |
| `verdict` | Role Outlook；含 `aiEfficiencyGain`（0–100） |
| `skill[]` | Task 列表；含 `confidence`（`high` / `medium` / `low`）与 `contentItems[{ title, description, source }]` |
| `workforceStrategy[]` | Gap Recommendations；`action` 为 `BUILD` / `MOVE` / `BUY` / `AUGMENT` |

**回贴：** 可将导出的 `position` 对象（或整段 JSON 里的 `position`）复制后，在岗位分析任务里「从剪贴板导入」。

---

## 2. 完善档案生成审核

侧栏点「导出数据」→ `profile-data-*.json`。除上下文外，会带上右侧当前草稿的 review 块（含已编辑的置信度与证据）。

### 2.1 根结构

```json
{
  "position": { },
  "company": { },
  "questionnaire": { },
  "questions": [ ],
  "employee": { },
  "resumeParsed": { },
  "submittedInfo": { },
  "profile": { },
  "skillAnalysis": { },
  "aiSuggest": { }
}
```

| 字段 | 说明 |
| --- | --- |
| `position` / `company` / `questionnaire` / `questions` | 同 §1，上下文参考 |
| `employee` | 员工基础信息（与草稿合并；`draft-*` id 会去掉） |
| `resumeParsed` | 简历解析结果（不含文件 id / oss 等附件字段） |
| `submittedInfo` | 调研填写信息；**含 `projects[]` 项目经历** |
| `profile` | 档案扩展（技能标签、意向岗位、工作偏好、linkedin 等） |
| `skillAnalysis` | Workforce Readiness 草稿，见 §2.2；可回贴 [导入 §2](./clipboard-import-data-format.md) |
| `aiSuggest` | 成长建议 / 岗位匹配 |

### 2.2 `skillAnalysis`（含置信度与结构化证据）

```json
{
  "readiness": 72,
  "summary": "就绪度总结",
  "metrics": { "criticalGaps": 1, "atOrAbove": 4, "monthsToClose": 6 },
  "skills": [
    {
      "id": "skill-1",
      "name": "Recruitment needs translation",
      "title": "Recruitment needs translation",
      "current": 2,
      "required": 4,
      "status": "gap",
      "confidence": "medium",
      "evidence": [
        {
          "source": "简历",
          "title": "培训交付经历缺失",
          "summary": "未见培训方案设计、课程组织相关经历"
        },
        {
          "source": "AI面试",
          "title": "学习交付表述不足",
          "summary": "面试中未体现讲师管理或复盘改进经验"
        }
      ]
    }
  ],
  "priorityGaps": [
    { "rank": 1, "title": "优先缺口", "description": "说明", "current": 2, "required": 4 }
  ],
  "developmentPlan": { }
}
```

| 字段 | 说明 |
| --- | --- |
| `skills[].confidence` | `high` / `medium` / `low` |
| `skills[].evidence[]` | 统一为 `{ source, title, summary }`；旧字符串证据会拆/补成数组 |
| `skills[].name` / `title` | 需与岗位 `skill[].name`（Task 标题）一致，才能挂就绪度 |

### 2.3 `submittedInfo.projects[]`

```json
{
  "name": "项目名",
  "role": "角色",
  "description": "描述",
  "skills": ["技能A"],
  "period": null,
  "company": "公司名"
}
```

### 2.4 回贴导入

可将导出 JSON 中的下列块直接用于「从剪贴板导入」（或整包粘贴，解析器会识别）：

- `employee` + `profile` + `skillAnalysis` + `aiSuggest`
- 或仅 `skillAnalysis`（含 `confidence` / `evidence`）

别名兼容与导入文档相同：`skillAnalysisDraft` / `readiness` 等。

---

## 3. 与导入对照

| 导出 | 导入文档 | 回贴方式 |
| --- | --- | --- |
| `analysis-data-*.json` → `position` | [§1 仅岗位](./clipboard-import-data-format.md) | 复制 `position` 或含 `skill`/`verdict` 的对象 |
| `profile-data-*.json` → review 块 | [§2 档案审核](./clipboard-import-data-format.md) | 复制整包或 `skillAnalysis` 等子块 |

**注意：**

1. 导出是「当前上下文 + 草稿快照」，不等于任务提交体。
2. 档案导出的 `skillAnalysis` 取自右侧 TalentProfile 当前草稿（含编辑证据 / 置信度后的结果）。
3. 证据来源请用真实文案（简历 / AI面试 / 项目经历等），不要用「分析依据」。
