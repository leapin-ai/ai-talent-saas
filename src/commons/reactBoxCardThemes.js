import { createThemeColors } from '@kne/react-box';

/** 岗位洞察横幅等多色渐变底 + 软边框 */
export const createBannerColors = (color, overrides = {}) =>
  createThemeColors(color, {
    backgroundImage: 'linear-gradient(99.56deg, rgba(79, 70, 229, 0.07) 0%, rgba(34, 211, 238, 0.07) 55%, rgba(240, 171, 252, 0.07) 100%)',
    borderColor: 'rgba(79, 70, 229, 0.16)',
    surface: 'transparent',
    titleColor: '#0F172A',
    mutedColor: '#64748B',
    descriptionColor: '#64748B',
    itemTitleColor: '#0F172A',
    itemBackground: 'transparent',
    itemBorderColor: 'transparent',
    shadow: 'none',
    hoverShadow: 'none',
    hoverBorderColor: 'rgba(79, 70, 229, 0.16)',
    transition: 'none',
    ...overrides
  });

/** Talent Profile 头卡（Figma talent info）：淡紫洗底 → 白，圆角 16 */
export const createTalentInfoColors = (color, overrides = {}) =>
  createThemeColors(color, {
    borderColor: '#EBE9F9',
    surface: '#FFFFFF',
    panelFrom: 'transparent',
    panelTo: 'transparent',
    backgroundImage: 'linear-gradient(172.6deg, rgb(244, 242, 255) 0%, rgb(255, 255, 255) 58%)',
    glow: 'transparent',
    titleColor: '#0F172A',
    mutedColor: '#94A3B8',
    descriptionColor: '#64748B',
    shadow: '0 4px 16px rgba(79, 70, 229, 0.08)',
    hoverShadow: '0 4px 16px rgba(79, 70, 229, 0.08)',
    hoverBorderColor: '#EBE9F9',
    transition: 'none',
    ...overrides
  });

/** @deprecated 用 talentInfo；保留避免旧引用报错 */
export const createProfileHeaderColors = createTalentInfoColors;

/** Readiness 左卡：轻色洗底 + 软阴影（勿用内置 halo 的重紫阴影） */
export const createReadinessHaloColors = (color, overrides = {}) =>
  createThemeColors(color, {
    borderColor: '#E2E8F0',
    surface: '#FFFFFF',
    panelFrom: 'transparent',
    panelTo: 'transparent',
    backgroundImage: 'radial-gradient(ellipse 70% 55% at 50% 45%, rgba(124, 58, 237, 0.06) 0%, transparent 55%), linear-gradient(135deg, rgba(124, 58, 237, 0.04) 0%, rgba(34, 211, 238, 0.04) 55%, rgba(240, 171, 252, 0.04) 100%)',
    glow: 'transparent',
    titleColor: '#0F172A',
    mutedColor: '#64748B',
    descriptionColor: '#475569',
    shadow: '0 4px 16px rgba(15, 23, 42, 0.06)',
    hoverShadow: '0 4px 16px rgba(15, 23, 42, 0.06)',
    hoverBorderColor: '#E2E8F0',
    transition: 'none',
    ...overrides
  });

/** Readiness 右卡 Priority Gaps：白底浅边 */
export const createReadinessGapsColors = (color, overrides = {}) =>
  createThemeColors(color, {
    borderColor: '#E2E8F0',
    surface: '#FFFFFF',
    panelFrom: '#FFFFFF',
    panelTo: '#FFFFFF',
    backgroundImage: 'none',
    glow: 'transparent',
    titleColor: '#0F172A',
    mutedColor: '#64748B',
    descriptionColor: '#64748B',
    shadow: '0 4px 16px rgba(15, 23, 42, 0.06)',
    hoverShadow: '0 4px 16px rgba(15, 23, 42, 0.06)',
    hoverBorderColor: '#E2E8F0',
    transition: 'none',
    ...overrides
  });

export const bannerTheme = {
  accent: true,
  accentBar: false,
  color: '#4F46E5',
  radius: 15,
  padding: '16px 19px',
  borderWidth: 1,
  titleFontSize: 14,
  titleFontWeight: 600,
  titleLineHeight: '20px',
  descriptionFontSize: 12,
  mediaGap: 18,
  headerMarginBottom: 0,
  contentGap: 0,
  hover: false,
  createThemeColors: 'banner',
  css: `
    & {
      background-color: transparent;
      background-image: var(--card-background-image);
      box-shadow: none;
    }
    &:hover {
      box-shadow: none;
      border-color: var(--card-border);
    }
    & [data-slot="media"] {
      align-items: center;
      width: 100%;
    }
    & [data-slot="main"] {
      display: grid;
      grid-template-columns: 1fr auto;
      align-items: center;
      column-gap: 16px;
      width: 100%;
      min-width: 0;
    }
    & [data-slot="header"] {
      display: contents;
    }
    & [data-slot="title-wrap"] {
      grid-column: 1;
      grid-row: 1;
      min-width: 0;
    }
    & [data-slot="title"] {
      color: var(--card-title, #0F172A);
      font-size: var(--card-title-size, 14px);
      font-weight: var(--card-title-weight, 600);
      line-height: var(--card-title-leading, 20px);
      white-space: normal;
    }
    & [data-slot="content"] {
      grid-column: 1;
      grid-row: 2;
      padding: 0;
      margin: 0;
    }
    & [data-slot="description"] {
      line-height: 16px;
      color: var(--card-description-color, #64748B);
    }
    & [data-slot="extra"] {
      grid-column: 2;
      grid-row: 1 / 3;
      align-self: center;
      display: inline-flex;
      align-items: center;
      gap: 10px;
      color: var(--primary-color);
      font-size: 13.5px;
      font-weight: 700;
      line-height: 1;
    }
    & [data-slot="prefix"] {
      align-items: center;
    }
  `
};

export const talentInfoTheme = {
  accent: false,
  accentBar: false,
  color: '#5B6CFF',
  radius: 16,
  padding: 22,
  borderWidth: 1,
  contentGap: 0,
  headerMarginBottom: 0,
  hover: false,
  createThemeColors: 'talentInfo',
  css: `
    & {
      background-color: #FFFFFF !important;
      background-image: var(--card-background-image) !important;
      border: 1px solid #EBE9F9 !important;
      border-radius: 16px !important;
      box-shadow: 0 4px 16px rgba(79, 70, 229, 0.08) !important;
      padding: 22px !important;
      overflow: hidden;
    }
    &:hover {
      background-image: var(--card-background-image) !important;
      border-color: #EBE9F9 !important;
      box-shadow: 0 4px 16px rgba(79, 70, 229, 0.08) !important;
    }
    & [data-slot="content"] {
      padding: 0 !important;
      margin: 0 !important;
    }
  `
};

/** 兼容旧名 */
export const profileHeaderTheme = talentInfoTheme;

export const readinessHaloTheme = {
  accent: false,
  accentBar: false,
  color: '#7C3AED',
  radius: 16,
  padding: '24px 28px 22px',
  borderWidth: 1,
  contentGap: 0,
  headerMarginBottom: 0,
  hover: false,
  createThemeColors: 'readinessHalo',
  css: `
    & {
      background-color: #FFFFFF !important;
      background-image: var(--card-background-image) !important;
      border: 1px solid #E2E8F0 !important;
      border-radius: 16px !important;
      box-shadow: 0 4px 16px rgba(15, 23, 42, 0.06) !important;
      overflow: hidden;
    }
    &:hover {
      background-image: var(--card-background-image) !important;
      border-color: #E2E8F0 !important;
      box-shadow: 0 4px 16px rgba(15, 23, 42, 0.06) !important;
    }
    & [data-slot="content"] {
      padding: 0 !important;
      margin: 0 !important;
    }
  `
};

export const readinessGapsTheme = {
  accent: false,
  accentBar: false,
  color: '#64748B',
  radius: 16,
  padding: '20px 20px 16px',
  borderWidth: 1,
  contentGap: 12,
  headerMarginBottom: 14,
  titleFontSize: 16,
  titleFontWeight: 700,
  titleLineHeight: '24px',
  hover: false,
  createThemeColors: 'readinessGaps',
  css: `
    & {
      background: #FFFFFF !important;
      background-image: none !important;
      border: 1px solid #E2E8F0 !important;
      border-radius: 16px !important;
      box-shadow: 0 4px 16px rgba(15, 23, 42, 0.06) !important;
    }
    &:hover {
      border-color: #E2E8F0 !important;
      box-shadow: 0 4px 16px rgba(15, 23, 42, 0.06) !important;
    }
    & [data-slot="header"] {
      align-items: center;
      margin-bottom: 14px;
    }
    & [data-slot="title"] {
      color: #0F172A;
      font-size: 16px;
      font-weight: 700;
    }
    & [data-slot="extra"] {
      display: inline-flex;
      align-items: center;
    }
    & [data-slot="content"] {
      padding: 0 !important;
    }
  `
};

/** 供 preset.js 的 boxPreset({ card }) 直接引用 */
export const reactBoxCardPreset = {
  createThemeColors: {
    banner: createBannerColors,
    profileHeader: createProfileHeaderColors,
    talentInfo: createTalentInfoColors,
    readinessHalo: createReadinessHaloColors,
    readinessGaps: createReadinessGapsColors
  },
  themes: {
    banner: bannerTheme,
    profileHeader: profileHeaderTheme,
    talentInfo: talentInfoTheme,
    readinessHalo: readinessHaloTheme,
    readinessGaps: readinessGapsTheme
  }
};

export default reactBoxCardPreset;
