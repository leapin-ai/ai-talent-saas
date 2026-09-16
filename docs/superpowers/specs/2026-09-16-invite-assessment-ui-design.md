# Invite Assessment UI（员工 / 经理）设计

**日期：** 2026-09-16  
**项目：** ai-talent-saas  
**范围：** UI 壳 only（方案 A）  
**实现方案：** 方案 1 — 独立 `InviteAssessment` + Dropdown + FormModal  

## 背景

岗位详情「Talent Readiness」页（`AnalyzeTalent`）已有「Invite Assessment」batchAction，当前仅 toast 假成功。设计稿要求：点击按钮先选 Employee / Manager，再打开邀请表单弹窗。

## 目标

1. 提供与设计稿一致的邀请入口（按钮 → Employee / Manager 下拉）。
2. 打开同一套邀请表单弹窗；标题与 `inviteType` 随类型变化。
3. 表单可填、可做前端必填校验；提交仅 toast，不调真实邀请 API。

## 非目标

- 真实邀请 API、模板下载文件、上传解析入库
- Employee / Manager 字段差异（仅标题与 `inviteType` 不同）
- 与表格勾选联动预填参与者
- 改动其它 Tab / 岗位模块无关能力

## 交互

1. 入口位于 Talent Readiness 表格工具栏区域，替换现有假成功 batchAction。
2. 点击「Invite Assessment」→ 下拉：`Employee` / `Manager`（白底、分割线、阴影，对齐设计稿）。
3. 选择一项 → 打开 FormModal；`inviteType` 为 `'employee' | 'manager'`。
4. 标题：`Invite Employees` / `Invite Managers`（中英文 locale）。
5. **不依赖**表格 `selectedRowKeys`；邀请流程不读勾选。
6. 关闭方式：X / Cancel / 提交成功 toast 后关闭。

## 组件与文件

```
src/components/Position/Detail/AnalyzeTalent/
  index.js                 # 挂载 InviteAssessment；移除假成功 batchAction
  InviteAssessment.js      # 按钮 + Dropdown + 打开 FormModal
  InviteAssessmentForm.js  # 弹窗内表单字段
  style.module.scss        # 按需补按钮 / 下拉样式
src/components/Position/locale/
  zh-CN.js / en-US.js      # 邀请相关文案
```

- `InviteAssessment`：通过 remote-loader 使用 `FormInfo` / `useFormModal`（与仓内其它表单弹窗一致）。
- `InviteAssessmentForm`：纯表单内容，接收 `inviteType`（UI 壳阶段字段不分支）。
- 若 `TablePage.batchActions` 无法承载自定义下拉，则将按钮放在 metrics 与表格之间的工具区（仍保持视觉与设计稿一致）。

## 表单字段（UI 壳）

| 区块 | 控件 | 壳行为 |
|------|------|--------|
| Assessment Project * | Select | 静态占位选项；必填 |
| Batch Import Participant | Upload + Download Template 链接 | Upload 可交互；模板链接 toast「敬请期待」 |
| Manual Entry Participant | Name / Email / Phone(+86) 可增减行 | List，默认一行；+/- 增删 |
| Deadline * | DatePicker | 必填 |

- 底部：Cancel + Submit（沿用 FormModal 默认按钮能力）。
- Submit：校验通过 → `message.success`（文案含 inviteType 语义）→ 关弹窗；**不调 API**。

## 文案（locale key 方向）

- 按钮：沿用 / 扩展 `position.talentInvite`
- 下拉：Employee / Manager（中英）
- 弹窗标题：Invite Employees / Invite Managers
- 字段标签、占位、模板链接、提交成功 toast、模板敬请期待 toast

具体 key 在实现计划中列出并写入 `zh-CN.js` / `en-US.js`。

## 验收

1. Talent Readiness 可见「Invite Assessment」，点击出现 Employee / Manager 下拉。
2. 任选一项打开弹窗，标题随类型变化，表单字段齐全可填。
3. 必填未填时提交被拦截；填齐后 toast 成功并关闭。
4. 不勾选表格行也能完成邀请流程；原假成功 batch toast 不再出现。
5. 中英文文案齐全。

## 后续（本次不做）

对接真实邀请接口时，仅替换 FormModal `onSubmit` / 模板下载与上传解析逻辑，尽量不改交互骨架。
