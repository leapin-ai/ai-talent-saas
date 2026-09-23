# 剪贴板导入数据格式

岗位分析弹窗里的「从剪贴板导入」认下面这份整包 JSON。完善档案生成审核目前没有剪贴板按钮，右侧草稿实际认的是第二份结构（档案字段 + 就绪度 / 成长 / 匹配）。

## 1. 完善岗位分析

整包一次粘贴，三步都会回填。`employees[].employeeId` 要和当前岗位员工 id 一致；对不上时按数组顺序对当前员工。`skill[].name` 为空的项会被丢掉。

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
    "developmentGoal": "未来业务目标",
    "skill": [
      {
        "id": "skill-1",
        "name": "需求分析",
        "origin": "existing",
        "activityCode": "A01",
        "activityTitle": "Customer Focus",
        "importanceNow": 3,
        "importanceYear": 4,
        "change": "enhanced",
        "aiExposure": "medium",
        "confidence": "high",
        "contentItems": [
          { "title": "依据标题", "description": "依据说明", "source": "来源" },
          { "title": "另一条依据", "description": "说明", "source": "来源" }
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
          "name": "需求分析",
          "current": 2,
          "required": 4,
          "status": "gap",
          "evidence": "证据"
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
              { "tag": "技能名", "title": "行动", "meta": "细节" }
            ]
          }
        ]
      }
    }
  ]
}
```

### 枚举

| 字段 | 取值 |
| --- | --- |
| `skill.origin` | `existing` / `new` |
| `skill.change` | `must_build` / `ai_emerging` / `new` / `enhanced` / `stable` / `declining` |
| `skill.aiExposure`、`skill.confidence` | `high` / `medium` / `low` |
| `skill.importanceNow`、`importanceYear` | 1–5 |
| `workforceStrategy.action` | `BUILD` / `MOVE` / `BUY` / `AUGMENT` |
| `verdict.aiEfficiencyGain` | 0–100 |
| `employees.readiness` | 0–100 |
| `employees.skills.status` | `critical` / `gap` / `onTarget` / `above` |
| `employees.skills.current`、`required` | 0–5 |
| `developmentPlan.horizons.tone` | `primary` / `cyan` / `rose` |

也可以只贴岗位对象（含 `skill` 或 `verdict` 或 `roleName`），或贴岗位数组（按 `roleName` 匹配当前岗位名，否则取第一项）。`org` / `position` / `employees` 可以只给其中一部分。

## 2. 完善档案生成审核

对应右侧草稿：`employee` + `profile` 给「AI 填充档案」，`skillAnalysis` + `aiSuggest` 给「生成就绪度/成长/匹配」。`match_rate` 用 0–1（`0.78` 表示 78%）。

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
        "name": "需求分析",
        "current": 2,
        "required": 4,
        "status": "gap",
        "evidence": "证据"
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

`gender` 用 `M` / `F` / `N`。`skill_gap.level` 用 `high` / `medium` / `low`。技能 `status` 与岗位分析个人步相同：`critical` / `gap` / `onTarget` / `above`。
