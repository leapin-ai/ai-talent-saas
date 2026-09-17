# CompleteProfile 第 1 步「Add Career Information」UI 还原设计

**日期：** 2026-09-16  
**项目：** ai-talent-saas  
**范围：** 仅第 1 步 UI / 字段前移（方案 A）  
**实现方案：** 方案 1 — 扩展现有 `UploadStep` 为双卡片（CV + LinkedIn）

## 背景

员工短评估（`CompleteProfile`，含 `mode=assessment` 与 `mode=collect`）第 1 步目前只有简历上传区；LinkedIn 在第 2 步 `ReviewStep` 的联系信息里。设计稿要求第 1 步为「Add Career Information」：CV（Required）与 LinkedIn Profile（Optional）两张独立卡片，并强调 UI 还原度。

## 目标

1. 按设计稿还原第 1 步布局：标题、CV 卡片、LinkedIn 卡片、徽章、前缀输入、隐私提示块。
2. 将 LinkedIn 从前移到第 1 步；`ReviewStep` 不再编辑 LinkedIn，避免重复。
3. 保留现有上传 / 解析 / 继续校验（CV 必填）与 Skip 行为；不改后三步视觉与邀请 API。

## 非目标

- 第 2–4 步视觉重做或统一改版
- SystemLayout / 侧栏改动
- 新建路由或拆分独立「短评估」应用
- LinkedIn 远端抓取 / 强校验完整 URL
- 改变简历解析 API 或 collect 邀请后端契约（仅多传已有 profile 字段 `linkedin`）

## 页面结构

仍挂在现有 `CompleteProfile` 内容区（外层 Layout 不动）：

1. 页标题：EN `Add Career Information`；ZH 对齐为「添加职业信息」类文案（locale 更新 `completeTitleUpload` / 必要时 `completeStepUpload`）。
2. Stepper：第 1 步标签与标题语义一致。
3. **CV 卡片**（Required）。
4. **LinkedIn Profile 卡片**（Optional）。
5. 底栏：Skip + 主按钮；无简历不可继续（现有规则）。

两张卡片：白底、圆角、轻阴影，纵向间距对齐稿面；上传区虚线框使用主题主色（稿面偏紫/蓝，跟 `--primary-color`）。

## 数据流

- `uploadState` 扩展为：`{ resumes, parsed, linkedin }`。
- `linkedin` 存**后缀**（如 `your-profile-name`）；UI 固定前缀 `https://www.linkedin.com/in/`；写入 Review / 保存时拼成完整 URL（后缀为空则存空字符串）。
- 修改 LinkedIn 只更新 `uploadState.linkedin`，不触发简历解析。
- 进入第 2 步时：将完整 URL（或空）并入 `reviewData.linkedin`；若 Review 已有值，以本步最新值为准覆盖。
- `ReviewStep` **删除** `linkedin` 输入项。
- 校验：CV 仍必填；LinkedIn 可选，不做 URL 强校验。
- 预填：从 employee / assessment / invite / 已有 `reviewData` 读取 linkedin 时，去掉固定前缀后回填后缀输入框。

## UI 细节

### CV 卡片

- 标题 `CV` + 紫色 `Required` 徽章；副文案：Upload your CV to prefill your profile.（中英 locale）。
- 虚线拖拽区：上传图标、「Drag your file here」、`PDF, DOC or DOCX · up to 10 MB`、描边 `Choose file`。
- 底部 info：文件仅用于预填、可随时删除（沿用 / 对齐 `completeUploadPrivacy`）。
- 已选文件：区内 `FileList`（预览/删除），可更换。

### LinkedIn 卡片

- 标题 `LinkedIn Profile` + 灰色 `Optional`；副文案：Add your profile URL to supplement your experience.
- 标签 `LinkedIn URL`；左侧前缀（LinkedIn 图标 + `https://www.linkedin.com/in/`）+ 右侧可编辑后缀（placeholder：`Please enter your-profile-name`）。
- 底部浅蓝提示块两条：
  - Privacy：请将 LinkedIn 设为 Public。
  - How we use it：用于补全档案与更准确的技能评估。

## 组件与文件

```
src/components/TenantAdmin/CompleteProfile/
  UploadStep.js            # 双卡片布局；LinkedIn 后缀输入；保留上传解析
  index.js                 # uploadState 含 linkedin；进 Review 时合并；标题文案
  ReviewStep.js            # 去掉 linkedin 字段
  style.module.scss        # 卡片 / 徽章 / 前缀输入 / 提示块样式
src/components/TenantAdmin/locale/
  zh-CN.js / en-US.js      # 标题、徽章、LinkedIn 提示等文案
```

- 业务改动仅在 `WORKPLACE_ROOT` 副本中进行（business-development-workflow）；验收通过后再提交 / 合回个人基线。

## 验收标准

1. 桌面端第 1 步与设计稿对比：双卡片结构、Required/Optional 徽章、拖拽区、前缀 LinkedIn 输入、隐私提示块还原到位。
2. 无简历点继续 → 仍提示必填；仅填 LinkedIn 不可跳过 CV 校验。
3. 填 LinkedIn 后进入 Review → 联系区无 LinkedIn 编辑框；保存档案时 `linkedin` 为完整 URL 或空。
4. 预填场景：已有完整 LinkedIn URL 时，第 1 步输入框只显示后缀。
5. `assessment` 与 `collect` 两种 mode 第 1 步 UI 一致。
6. 中英文案齐全。

## 风险与注意

- 主题主色可能因租户 theme 与稿面紫不完全一致：结构与间距按稿，颜色跟 `--primary-color`。
- 历史用户若只在 Review 填过 LinkedIn：预填逻辑须能从 `reviewData` 回填到第 1 步。
