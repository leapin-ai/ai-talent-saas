# Invite Assessment UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (inline) or subagent-driven-development. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 Talent Readiness 页用 Dropdown（Employee/Manager）+ FormModal 邀请表单 UI 壳替换假成功 batchAction。

**Architecture:** 新增 `InviteAssessment`（按钮+下拉+打开 formModal）与 `InviteAssessmentForm`（表单字段）。挂到 `TablePage.buttonGroup`（不依赖勾选）；移除原 `batchActions` 邀请项。提交仅 toast。

**Tech Stack:** React、antd Dropdown/Button/Upload/message、`components-core` FormInfo + useFormModal、`@kne/react-intl` locale。

## Global Constraints

- 仅 UI 壳：不调真实邀请 API；模板下载 toast「敬请期待」
- Employee / Manager 共用表单，仅标题与 `inviteType` 不同
- 不依赖表格 `selectedRowKeys`
- 业务仓流程：改动只在 `WORKPLACE_ROOT`；验收通过后再提交/合回
- 有功能改动须 patch 升 `@kne/ai-talent-saas` version

---

## File map

| Path | Role |
|------|------|
| `src/components/Position/Detail/AnalyzeTalent/InviteAssessment.js` | 按钮 + Dropdown + formModal |
| `src/components/Position/Detail/AnalyzeTalent/InviteAssessmentForm.js` | 弹窗表单内容 |
| `src/components/Position/Detail/AnalyzeTalent/index.js` | 挂 buttonGroup，删假成功 batchAction |
| `src/components/Position/Detail/AnalyzeTalent/style.module.scss` | 邀请按钮/下拉样式 |
| `src/components/Position/locale/zh-CN.js` | 中文文案 |
| `src/components/Position/locale/en-US.js` | 英文文案 |
| `package.json` | patch version（提交阶段） |

---

### Task 1: Locale keys

**Files:**
- Modify: `src/components/Position/locale/zh-CN.js`
- Modify: `src/components/Position/locale/en-US.js`

**Produces:** 下列 key 可用

- [ ] **Step 1: 在 zh-CN / en-US 的 talentInvite 附近追加**

```js
// zh-CN
'position.talentInviteEmployee': '员工',
'position.talentInviteManager': '经理',
'position.talentInviteEmployeesTitle': '邀请员工',
'position.talentInviteManagersTitle': '邀请经理',
'position.talentInviteProject': '评估项目',
'position.talentInviteBatchImport': '批量导入参与者',
'position.talentInviteDownloadTemplate': '下载模板',
'position.talentInviteUploadHint': '点击或拖拽文件到此区域上传',
'position.talentInviteUploadTypes': '支持 pdf, jpg, png, jpeg, doc, docx, xls, xlsx, html, msg, eml, zip。单文件不超过 10 MB。',
'position.talentInviteManualEntry': '手动录入参与者',
'position.talentInviteName': '姓名',
'position.talentInviteEmail': '邮箱',
'position.talentInvitePhone': '手机',
'position.talentInviteDeadline': '截止日期',
'position.talentInviteEnter': '请输入',
'position.talentInviteSelect': '请选择',
'position.talentInviteTemplateSoon': '模板下载敬请期待',
'position.talentInviteSuccess': '已提交{type}邀请（演示）',
'position.talentInviteProjectOption': '人才获取就绪度评估',

// en-US
'position.talentInviteEmployee': 'Employee',
'position.talentInviteManager': 'Manager',
'position.talentInviteEmployeesTitle': 'Invite Employees',
'position.talentInviteManagersTitle': 'Invite Managers',
'position.talentInviteProject': 'Assessment Project',
'position.talentInviteBatchImport': 'Batch Import Participant',
'position.talentInviteDownloadTemplate': 'Download Template',
'position.talentInviteUploadHint': 'Click or drag file to this area to upload',
'position.talentInviteUploadTypes': 'Support pdf, jpg, png, jpeg, doc, docx, xls, xlsx, html, msg, eml, zip. Single file size does not exceed 10 MB.',
'position.talentInviteManualEntry': 'Manual Entry Participant',
'position.talentInviteName': 'Name',
'position.talentInviteEmail': 'Email',
'position.talentInvitePhone': 'Phone',
'position.talentInviteDeadline': 'Deadline',
'position.talentInviteEnter': 'Enter',
'position.talentInviteSelect': 'Select',
'position.talentInviteTemplateSoon': 'Template download coming soon',
'position.talentInviteSuccess': '{type} invite submitted (demo)',
'position.talentInviteProjectOption': 'Talent Acquisition Readiness Assessment',
```

- [ ] **Step 2: 人工确认两个 locale 文件无语法错误**

---

### Task 2: InviteAssessmentForm

**Files:**
- Create: `src/components/Position/Detail/AnalyzeTalent/InviteAssessmentForm.js`

**Consumes:** FormInfo remote modules（由父组件注入或本文件 remote-loader）  
**Produces:** `InviteAssessmentForm` 组件

- [ ] **Step 1: 实现表单（FormInfo Select / Upload 区 / List / DatePicker）**

结构要点：
- remote-loader：`components-core:FormInfo`
- `Select` name=`assessmentProject` rule=`REQ`，静态 options 一项占位
- Batch：标题行 + Download Template（`message.info` templateSoon）+ antd `Upload.Dragger`（`beforeUpload={() => false}`，不上传）
- `List` name=`participants` minLength=1，字段 Name/Email/`PhoneNumber` format=string
- `DatePicker` name=`deadline` rule=`REQ`

- [ ] **Step 2: 目视对照设计稿字段齐全**

---

### Task 3: InviteAssessment + 样式

**Files:**
- Create: `src/components/Position/Detail/AnalyzeTalent/InviteAssessment.js`
- Modify: `src/components/Position/Detail/AnalyzeTalent/style.module.scss`

**Consumes:** InviteAssessmentForm、locale keys  
**Produces:** 可点击按钮组件

- [ ] **Step 1: InviteAssessment.js**

- remote：`FormInfo@useFormModal`、`FormInfo`
- antd `Dropdown` menu：Employee / Manager
- 选中后 `formModal({ title, size: 'small'|large, formProps: { onSubmit: toast success + close }, children: <InviteAssessmentForm /> })`
- 按钮文案 `position.talentInvite`，信封图标可用 `@ant-design/icons` MailOutlined
- 兼容作为 `buttonGroup.list[].buttonComponent`：渲染为 Button，吞掉无关 props

- [ ] **Step 2: style** — 浅蓝底/蓝边按钮、下拉白底分割线阴影（`.invite-btn` / `.invite-dropdown`）

---

### Task 4: 接入 AnalyzeTalent

**Files:**
- Modify: `src/components/Position/Detail/AnalyzeTalent/index.js`

- [ ] **Step 1: import InviteAssessment**
- [ ] **Step 2: 删除 `batchActions` 中 invite 项；增加 `buttonGroup={{ list: [{ buttonComponent: InviteAssessment }] }}`**
- [ ] **Step 3: 若不再需要勾选，可保留 rowSelection（其它能力）或按现状保留**

---

### Task 5: 本地验收说明

- [ ] **Step 1: 给出启动命令** `cd "$WORKPLACE_ROOT" && npm start`
- [ ] **Step 2: 验收清单**（对齐 design spec 验收 1–5）
- [ ] **Step 3: 用户验收通过后再升版本 + commit + 合回个人分支**（业务仓流程；本计划不在开发中途 commit SOURCE）

---

## Spec coverage

| Spec 项 | Task |
|---------|------|
| Dropdown Employee/Manager | Task 3 |
| 同表单不同标题/inviteType | Task 3 |
| 表单四区块 | Task 2 |
| 不依赖勾选 / 去假成功 batch | Task 4 |
| locale 中英 | Task 1 |
| 提交 toast only | Task 3 |

## Self-review

- 无 TBD；`buttonGroup` 替代 `batchActions`（后者无选中禁用，违反 spec）
- 提交节奏遵循业务仓验收门禁，不强制任务内 git commit
