# CompleteProfile Career Info Step UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (inline) or subagent-driven-development. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将员工短评估 `CompleteProfile` 第 1 步按设计稿还原为「Add Career Information」双卡片（CV Required + LinkedIn Optional），并把 LinkedIn 从 Review 前移到本步。

**Architecture:** 扩展现有 `UploadStep` 为双卡片布局；`uploadState` 增加 `linkedin` 后缀字段；进入第 2 步时拼完整 URL 写入 `reviewData`；`ReviewStep` 删除 LinkedIn 输入。纯函数 `stripLinkedinPrefix` / `joinLinkedinUrl` 放在 `profileDataUtils.js`。

**Tech Stack:** React、antd（Input / Tag / Typography）、`@kne/react-file` 上传、`components-core` FileList、`@kne/react-intl` locale、SCSS modules。

## Global Constraints

- 范围仅第 1 步 UI + LinkedIn 前移（方案 A / 实现方案 1）
- 不改第 2–4 步视觉、SystemLayout、邀请 API
- 业务仓：代码只改 `WORKPLACE_ROOT`（当前会话副本）；验收通过后再提交/合回
- 有功能改动须 patch 升 `@kne/ai-talent-saas` version（提交阶段）
- Spec：`docs/superpowers/specs/2026-09-16-complete-profile-career-info-ui-design.md`
- 颜色跟 `--primary-color`；结构/间距/徽章/前缀输入按稿还原

---

## File map

| Path | Role |
|------|------|
| `src/components/TenantAdmin/CompleteProfile/profileDataUtils.js` | `stripLinkedinPrefix` / `joinLinkedinUrl` |
| `src/components/TenantAdmin/CompleteProfile/UploadStep.js` | 双卡片 UI；LinkedIn 后缀输入 |
| `src/components/TenantAdmin/CompleteProfile/style.module.scss` | 卡片 / 徽章 / 前缀输入 / 提示块 |
| `src/components/TenantAdmin/CompleteProfile/index.js` | `uploadState.linkedin`；继续时合并；预填后缀 |
| `src/components/TenantAdmin/CompleteProfile/ReviewStep.js` | 删除 linkedin 字段 |
| `src/components/TenantAdmin/locale/zh-CN.js` | 中文文案 |
| `src/components/TenantAdmin/locale/en-US.js` | 英文文案 |
| `package.json` | patch version（提交阶段） |

---

### Task 1: Locale keys

**Files:**
- Modify: `src/components/TenantAdmin/locale/en-US.js`
- Modify: `src/components/TenantAdmin/locale/zh-CN.js`

**Produces:** 第 1 步标题与双卡片文案 key 可用

- [ ] **Step 1: 更新 / 追加 en-US**

在 `completeStepUpload` / `completeTitleUpload` 附近，**改写**已有标题，并**追加**新 key：

```js
'tenantAdmin.completeStepUpload': 'Add Career Information',
'tenantAdmin.completeTitleUpload': 'Add Career Information',
'tenantAdmin.completeCvSectionTitle': 'CV',
'tenantAdmin.completeCvSectionDesc': 'Upload your CV to prefill your profile.',
'tenantAdmin.completeRequiredBadge': 'Required',
'tenantAdmin.completeOptionalBadge': 'Optional',
'tenantAdmin.completeLinkedinSectionTitle': 'LinkedIn Profile',
'tenantAdmin.completeLinkedinSectionDesc': 'Add your profile URL to supplement your experience.',
'tenantAdmin.completeLinkedinUrlLabel': 'LinkedIn URL',
'tenantAdmin.completeLinkedinPrefix': 'https://www.linkedin.com/in/',
'tenantAdmin.completeLinkedinPlaceholder': 'Please enter your-profile-name',
'tenantAdmin.completeLinkedinPrivacyTitle': 'Privacy settings',
'tenantAdmin.completeLinkedinPrivacyBody': 'Please make sure your LinkedIn profile is set to Public so we can view the information you\'ve shared.',
'tenantAdmin.completeLinkedinUseTitle': 'How we use it',
'tenantAdmin.completeLinkedinUseBody': 'We\'ll use your LinkedIn profile to complete your profile and provide a more accurate assessment of your skills and future potential.',
```

保留已有：`completeDragTip`、`completeUploadHint`、`completeChooseFile`、`completeUploadPrivacy`（文案已与稿接近则不动）。

- [ ] **Step 2: 更新 / 追加 zh-CN**

```js
'tenantAdmin.completeStepUpload': '添加职业信息',
'tenantAdmin.completeTitleUpload': '添加职业信息',
'tenantAdmin.completeCvSectionTitle': 'CV',
'tenantAdmin.completeCvSectionDesc': '上传简历以预填档案。',
'tenantAdmin.completeRequiredBadge': '必填',
'tenantAdmin.completeOptionalBadge': '选填',
'tenantAdmin.completeLinkedinSectionTitle': 'LinkedIn 主页',
'tenantAdmin.completeLinkedinSectionDesc': '添加主页链接以补充经历。',
'tenantAdmin.completeLinkedinUrlLabel': 'LinkedIn URL',
'tenantAdmin.completeLinkedinPrefix': 'https://www.linkedin.com/in/',
'tenantAdmin.completeLinkedinPlaceholder': '请输入你的主页路径',
'tenantAdmin.completeLinkedinPrivacyTitle': '隐私设置',
'tenantAdmin.completeLinkedinPrivacyBody': '请将 LinkedIn 主页设为公开（Public），以便我们查看你分享的信息。',
'tenantAdmin.completeLinkedinUseTitle': '我们如何使用',
'tenantAdmin.completeLinkedinUseBody': '我们将使用你的 LinkedIn 主页补全档案，并更准确地评估你的技能与潜力。',
```

- [ ] **Step 3: 自检**

确认上述 key 在 zh/en 成对存在；无重复 key。

---

### Task 2: LinkedIn URL helpers

**Files:**
- Modify: `src/components/TenantAdmin/CompleteProfile/profileDataUtils.js`

**Produces:**
- `stripLinkedinPrefix(urlOrSlug: string) => string`
- `joinLinkedinUrl(slug: string) => string`
- 常量前缀：`LINKEDIN_PROFILE_PREFIX = 'https://www.linkedin.com/in/'`

- [ ] **Step 1: 在 `profileDataUtils.js` 顶部附近追加**

```js
export const LINKEDIN_PROFILE_PREFIX = 'https://www.linkedin.com/in/';

/** 去掉固定前缀，得到输入框后缀；已是后缀则原样 trim */
export const stripLinkedinPrefix = value => {
  const raw = String(value || '').trim();
  if (!raw) return '';
  const lower = raw.toLowerCase();
  const prefix = LINKEDIN_PROFILE_PREFIX.toLowerCase();
  if (lower.startsWith(prefix)) {
    return raw.slice(LINKEDIN_PROFILE_PREFIX.length).replace(/^\/+/, '').trim();
  }
  // 兼容无协议的 linkedin.com/in/xxx
  const alt = 'linkedin.com/in/';
  const idx = lower.indexOf(alt);
  if (idx >= 0) {
    return raw.slice(idx + alt.length).replace(/^\/+/, '').trim();
  }
  return raw.replace(/^\/+/, '').trim();
};

/** 后缀 → 完整 URL；空后缀 → '' */
export const joinLinkedinUrl = slug => {
  const s = String(slug || '')
    .trim()
    .replace(/^\/+/, '');
  if (!s) return '';
  return `${LINKEDIN_PROFILE_PREFIX}${s}`;
};
```

- [ ] **Step 2: 快速手工验证（node）**

在 workplace 根目录执行：

```bash
node -e "
const { stripLinkedinPrefix, joinLinkedinUrl } = require('./src/components/TenantAdmin/CompleteProfile/profileDataUtils.js');
"
```

若 ESM 无法 require，改用临时脚本或在浏览器控制台 / 后续联调验证以下期望：

| input | strip | join(strip) |
|-------|-------|-------------|
| `https://www.linkedin.com/in/jane` | `jane` | `https://www.linkedin.com/in/jane` |
| `jane` | `jane` | `https://www.linkedin.com/in/jane` |
| `` | `` | `` |

（本仓前端多为 ESM；若 node 直接 require 失败，跳过本步，在 Task 4 联调预填时验证即可。）

---

### Task 3: UploadStep 双卡片 UI

**Files:**
- Modify: `src/components/TenantAdmin/CompleteProfile/UploadStep.js`
- Modify: `src/components/TenantAdmin/CompleteProfile/style.module.scss`

**Consumes:** locale keys（Task 1）；`value.linkedin` / `onChange` 扩展

**Produces:** 视觉对齐设计稿的 CV + LinkedIn 双卡片；LinkedIn 变更写回 `onChange({ ...value, linkedin })`

- [ ] **Step 1: 扩展 `UploadStep` props 数据约定**

`value` / `onChange` 形状：

```js
// value: { resumes: [], parsed: null | object, linkedin: string /* 后缀 */ }
```

现有 `applyList` 在 `onChange` 时保留 `linkedin`：

```js
onChange?.({ resumes: list, parsed: null, linkedin: value?.linkedin || '' });
// 以及其它 onChange 分支同样带上 linkedin: value?.linkedin || ''
```

- [ ] **Step 2: 重写 JSX 结构（保留上传逻辑）**

外层改为：

```jsx
<div className={style['career-step']}>
  <section className={style['career-card']}>
    <div className={style['career-card-head']}>
      <div className={style['career-card-titles']}>
        <span className={style['career-card-title']}>{formatMessage({ id: 'tenantAdmin.completeCvSectionTitle' })}</span>
        <span className={style['badge-required']}>{formatMessage({ id: 'tenantAdmin.completeRequiredBadge' })}</span>
      </div>
      <p className={style['career-card-desc']}>{formatMessage({ id: 'tenantAdmin.completeCvSectionDesc' })}</p>
    </div>
    {/* 现有 Spin + DragAreaOuter + upload-zone（Choose file 改为描边样式 class upload-cta-outline） */}
    <div className={style['upload-privacy']}>...</div>
  </section>

  <section className={style['career-card']}>
    <div className={style['career-card-head']}>
      <div className={style['career-card-titles']}>
        <span className={style['career-card-title']}>{formatMessage({ id: 'tenantAdmin.completeLinkedinSectionTitle' })}</span>
        <span className={style['badge-optional']}>{formatMessage({ id: 'tenantAdmin.completeOptionalBadge' })}</span>
      </div>
      <p className={style['career-card-desc']}>{formatMessage({ id: 'tenantAdmin.completeLinkedinSectionDesc' })}</p>
    </div>
    <div className={style['linkedin-field']}>
      <div className={style['linkedin-label']}>{formatMessage({ id: 'tenantAdmin.completeLinkedinUrlLabel' })}</div>
      <Input
        className={style['linkedin-input']}
        addonBefore={
          <span className={style['linkedin-prefix']}>
            {/* LinkedIn 图标可用简单 SVG 或 antd icon 替代；前缀文案用 locale completeLinkedinPrefix */}
            {formatMessage({ id: 'tenantAdmin.completeLinkedinPrefix' })}
          </span>
        }
        value={value?.linkedin || ''}
        placeholder={formatMessage({ id: 'tenantAdmin.completeLinkedinPlaceholder' })}
        onChange={e => onChange?.({ ...value, resumes: value?.resumes || [], parsed: value?.parsed ?? null, linkedin: e.target.value })}
        allowClear
      />
    </div>
    <div className={style['linkedin-tips']}>
      <div className={style['linkedin-tip']}>
        <LockOutlined />
        <div>
          <div className={style['linkedin-tip-title']}>{formatMessage({ id: 'tenantAdmin.completeLinkedinPrivacyTitle' })}</div>
          <div className={style['linkedin-tip-body']}>{formatMessage({ id: 'tenantAdmin.completeLinkedinPrivacyBody' })}</div>
        </div>
      </div>
      <div className={style['linkedin-tip']}>
        <InfoCircleOutlined />
        <div>
          <div className={style['linkedin-tip-title']}>{formatMessage({ id: 'tenantAdmin.completeLinkedinUseTitle' })}</div>
          <div className={style['linkedin-tip-body']}>{formatMessage({ id: 'tenantAdmin.completeLinkedinUseBody' })}</div>
        </div>
      </div>
    </div>
  </section>
</div>
```

从 `antd` 增加导入：`Input`；图标增加 `LockOutlined`（已有 `InfoCircleOutlined`）。

- [ ] **Step 3: 追加 SCSS（对齐稿面）**

在 `style.module.scss` 增加（可放在 `.upload-wrap` 附近）：

```scss
.career-step {
  display: flex;
  flex-direction: column;
  gap: 16px;
  width: 100%;
}

.career-card {
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(15, 23, 42, 0.04);
  padding: 20px 24px 24px;
  border: 1px solid #f1f5f9;
}

.career-card-head {
  margin-bottom: 16px;
}

.career-card-titles {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
}

.career-card-title {
  font-size: 16px;
  font-weight: 700;
  color: #0f172a;
}

.career-card-desc {
  margin: 0;
  font-size: 14px;
  line-height: 22px;
  color: #64748b;
}

.badge-required {
  display: inline-flex;
  align-items: center;
  padding: 0 8px;
  height: 22px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 600;
  color: #4f46e5;
  background: #eef2ff;
}

.badge-optional {
  display: inline-flex;
  align-items: center;
  padding: 0 8px;
  height: 22px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 600;
  color: #64748b;
  background: #f1f5f9;
}

.linkedin-field {
  margin-bottom: 16px;
}

.linkedin-label {
  font-size: 14px;
  font-weight: 600;
  color: #0f172a;
  margin-bottom: 8px;
}

.linkedin-prefix {
  color: #64748b;
  font-size: 13px;
  max-width: 260px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.linkedin-tips {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 12px 14px;
  border-radius: 8px;
  background: #eff6ff;
}

.linkedin-tip {
  display: flex;
  gap: 10px;
  align-items: flex-start;
  color: #334155;
  font-size: 13px;
  line-height: 20px;

  :global(.anticon) {
    margin-top: 2px;
    color: #0087ef;
  }
}

.linkedin-tip-title {
  font-weight: 600;
  color: #0f172a;
  margin-bottom: 2px;
}

.linkedin-tip-body {
  color: #475569;
}

// Choose file：稿面为描边按钮，覆盖 .upload-cta 为 outline 变体
.upload-cta-outline {
  display: flex;
  justify-content: center;
  margin-top: 8px;

  :global(.ant-btn) {
    height: 40px !important;
    min-width: 140px;
    padding: 0 28px !important;
    border-radius: 8px !important;
    background: #fff !important;
    color: var(--primary-color) !important;
    font-weight: 600 !important;
    border: 1px solid var(--primary-color) !important;
    box-shadow: none !important;

    &:hover,
    &:focus {
      background: color-mix(in srgb, var(--primary-color) 6%, #fff) !important;
      color: var(--primary-color) !important;
      border-color: var(--primary-color) !important;
    }
  }
}
```

将原 `upload-cta` 的 class 在 UploadStep 中改为 `upload-cta-outline`（或同时保留两个 class）。

上传区仍用现有 `.upload-zone`；卡片内可不需要再套一层 `.upload-wrap` 大白底。

- [ ] **Step 4: 视觉自检清单（开发机打开第 1 步）**

对照设计稿：双卡片、Required/Optional 徽章、拖拽区、描边 Choose file、LinkedIn 前缀输入、浅蓝双提示。

---

### Task 4: index.js 状态合并 + ReviewStep 去字段

**Files:**
- Modify: `src/components/TenantAdmin/CompleteProfile/index.js`
- Modify: `src/components/TenantAdmin/CompleteProfile/ReviewStep.js`

**Consumes:** `stripLinkedinPrefix` / `joinLinkedinUrl`（Task 2）；`UploadStep` linkedin（Task 3）

- [ ] **Step 1: `uploadState` 初始值**

```js
const [uploadState, setUploadState] = useState({ resumes: [], parsed: null, linkedin: '' });
```

所有 `setUploadState(prev => ...)` 分支保留 `linkedin: prev.linkedin || ''`（除非从预填写入）。

- [ ] **Step 2: 预填时写入后缀**

在设置 `reviewData` 的预填逻辑处（employee / assessment / collect detail），同步：

```js
import { ..., stripLinkedinPrefix, joinLinkedinUrl } from './profileDataUtils';

// 当得到 review.linkedin 时：
setUploadState(prev => ({
  ...prev,
  linkedin: stripLinkedinPrefix(review.linkedin || '')
}));
```

（具体插入点：现有 `setReviewData` / prefill `useEffect` 成功分支；不要覆盖用户已编辑的后缀——若 `prefillAppliedRef` 只跑一次，与现有预填门禁一致即可。）

- [ ] **Step 3: 点「继续」合并 linkedin**

替换 `current === 0` 主按钮里的 `setReviewData`，保证写入完整 URL：

```js
onClick={() => {
  if (!canContinueUpload) {
    message.warning(formatMessage({ id: 'tenantAdmin.completeUploadRequired' }));
    return;
  }
  const linkedinUrl = joinLinkedinUrl(uploadState.linkedin);
  setReviewData(prev => {
    const base = prev
      ? Object.assign({}, prev)
      : Object.assign({}, uploadState.parsed || {});
    if (isCollect) {
      Object.assign(base, {
        name: inviteMeta?.name || base.name || '',
        email: inviteMeta?.email || base.email || '',
        phone: inviteMeta?.phone || base.phone || ''
      });
    }
    base.linkedin = linkedinUrl;
    return normalizeReviewProfileData(base);
  });
  setCurrent(1);
}}
```

注意：即使用户已有 `prev`（预填），也要用本步 `linkedinUrl` **覆盖** `linkedin`（spec 要求）。

- [ ] **Step 4: `ReviewStep` 删除 linkedin 行**

从 Contact `list` 中移除：

```js
<Input name="linkedin" label={formatMessage({ id: 'tenantAdmin.completePublicProfile' })} rule="LEN-0-200" />
```

Contact 仅保留 name / phone / email（column 仍可为 2）。

- [ ] **Step 5: 联调验收**

1. 无简历点继续 → 仍 toast 必填。  
2. 上传简历 + 填 LinkedIn 后缀 → 进入 Review，联系区无 LinkedIn 框；保存后 profile 含完整 URL。  
3. 有预填完整 URL → 第 1 步输入框仅后缀。  
4. `collect-profile?token=...` 与登录态 assessment 第 1 步 UI 一致。

---

### Task 5: 收尾说明（提交前）

**Files:** 无额外代码；提交阶段再动 `package.json` version

- [ ] **Step 1: 对照 spec 验收标准逐条勾选**

见 `docs/superpowers/specs/2026-09-16-complete-profile-career-info-ui-design.md`「验收标准」。

- [ ] **Step 2: 向用户给出 workplace 启动命令（等待验收）**

示例（路径以实际 `WORKPLACE_ROOT` 为准）：

```bash
cd "$WORKPLACE_ROOT" && npm start
```

打开 CompleteProfile 第 1 步（assessment 或 collect）对照设计稿。

- [ ] **Step 3: 用户明确验收通过并授权提交后**

按 business-development-workflow：workplace 内 patch 升版本 → commit → 拷回 SOURCE 同名分支 → merge 入 `{PERSONAL_BRANCH}` → 清理 workplace。**本 Task 在实现阶段不要擅自 commit。**

---

## Spec coverage (self-review)

| Spec 要求 | Task |
|-----------|------|
| 第 1 步双卡片 UI | Task 3 |
| 标题 / Stepper 文案 | Task 1 + 现有 Page title / Stepper 读 locale |
| LinkedIn 前移、后缀存储、完整 URL 合并 | Task 2 + 4 |
| Review 去 LinkedIn | Task 4 |
| CV 必填、LinkedIn 可选 | Task 4（沿用 canContinueUpload） |
| 预填 strip 前缀 | Task 2 + 4 |
| 不改后三步 / Layout / API | 全局约束 |
| 中英文案 | Task 1 |
| Choose file 描边 | Task 3 SCSS |

无 TBD / 无「类似 Task N」占位。
