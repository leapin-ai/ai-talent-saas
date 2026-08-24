export const TENANT_THEME_STYLE_ID = 'ai-talent-saas-tenant-theme';
export const GLOBAL_THEME_STYLE_ID = 'component-core-theme';
export const THEME_CONTAINER_CLASS = 'core-container-body';

export const resolveTenantThemeColor = ({ tenant, tenantUserInfo } = {}) => tenant?.themeColor || tenantUserInfo?.tenant?.themeColor || null;

export const getThemeContainer = () => {
  if (typeof document === 'undefined') {
    return null;
  }

  if (document.body.classList.contains(THEME_CONTAINER_CLASS)) {
    return document.body;
  }

  return document.querySelector(`.${THEME_CONTAINER_CLASS}`) || document.querySelector('.container-body') || document.body;
};

const parseHex = hex => {
  const normalized = String(hex || '').replace('#', '');
  const value =
    normalized.length === 3
      ? normalized
          .split('')
          .map(char => char + char)
          .join('')
      : normalized;
  if (value.length !== 6) {
    return null;
  }
  const r = parseInt(value.slice(0, 2), 16);
  const g = parseInt(value.slice(2, 4), 16);
  const b = parseInt(value.slice(4, 6), 16);
  if ([r, g, b].some(Number.isNaN)) {
    return null;
  }
  return { r, g, b };
};

const toHex = ({ r, g, b }) => `#${[r, g, b].map(channel => Math.round(channel).toString(16).padStart(2, '0')).join('')}`;

const mixWithWhite = (hex, whiteRatio) => {
  const rgb = parseHex(hex);
  if (!rgb) {
    return hex;
  }
  const primaryRatio = 1 - whiteRatio;
  return toHex({
    r: rgb.r * primaryRatio + 255 * whiteRatio,
    g: rgb.g * primaryRatio + 255 * whiteRatio,
    b: rgb.b * primaryRatio + 255 * whiteRatio
  });
};

const mixWithBlack = (hex, blackRatio) => {
  const rgb = parseHex(hex);
  if (!rgb) {
    return hex;
  }
  const primaryRatio = 1 - blackRatio;
  return toHex({
    r: rgb.r * primaryRatio,
    g: rgb.g * primaryRatio,
    b: rgb.b * primaryRatio
  });
};

export const buildPrimaryColorCssVars = colorPrimary => {
  const rgb = parseHex(colorPrimary);
  if (!rgb) {
    return {
      '--primary-color': colorPrimary,
      '--ant-color-primary': colorPrimary,
      '--ant-color-link': colorPrimary
    };
  }

  const hover = mixWithBlack(colorPrimary, 0.12);
  const active = mixWithBlack(colorPrimary, 0.28);
  const primaryBg = mixWithWhite(colorPrimary, 0.9);
  const primaryBgHover = mixWithWhite(colorPrimary, 0.8);
  const primaryBorder = mixWithWhite(colorPrimary, 0.5);
  const primaryBorderHover = mixWithWhite(colorPrimary, 0.3);

  const vars = {
    '--primary-color': colorPrimary,
    '--primary-color-red': String(rgb.r),
    '--primary-color-green': String(rgb.g),
    '--primary-color-blue': String(rgb.b),
    '--primary-color-06': mixWithWhite(colorPrimary, 0.94),
    '--theme-primary-hover': hover,
    '--theme-primary-emphasis': active,
    '--ant-color-primary': colorPrimary,
    '--ant-color-primary-hover': hover,
    '--ant-color-primary-active': active,
    '--ant-color-primary-bg': primaryBg,
    '--ant-color-primary-bg-hover': primaryBgHover,
    '--ant-color-primary-border': primaryBorder,
    '--ant-color-primary-border-hover': primaryBorderHover,
    '--ant-color-link': colorPrimary,
    '--ant-color-link-hover': hover,
    '--ant-color-link-active': active
  };

  for (let level = 1; level <= 10; level += 1) {
    vars[`--primary-color-${level}`] = mixWithWhite(colorPrimary, 1 - level / 10);
  }

  return vars;
};

const buildThemeStylesheetText = colorPrimary => {
  const declarations = Object.entries(buildPrimaryColorCssVars(colorPrimary))
    .map(([key, value]) => `${key}:${value}`)
    .join(';');

  return `:root,.${THEME_CONTAINER_CLASS}{${declarations}}`;
};

const applyThemeVarsToElement = (colorPrimary, element = getThemeContainer()) => {
  if (!element || !colorPrimary) {
    return false;
  }

  const vars = buildPrimaryColorCssVars(colorPrimary);
  Object.entries(vars).forEach(([key, value]) => {
    element.style.setProperty(key, value);
  });

  if (typeof document !== 'undefined' && element !== document.documentElement) {
    Object.entries(vars).forEach(([key, value]) => {
      document.documentElement.style.setProperty(key, value);
    });
  }

  return true;
};

export const injectTenantThemeStylesheet = colorPrimary => {
  if (typeof document === 'undefined' || !colorPrimary) {
    return false;
  }

  let styleEl = document.getElementById(TENANT_THEME_STYLE_ID);
  if (!styleEl) {
    styleEl = document.createElement('style');
    styleEl.id = TENANT_THEME_STYLE_ID;
    document.head.appendChild(styleEl);
  }

  styleEl.textContent = buildThemeStylesheetText(colorPrimary);
  applyThemeVarsToElement(colorPrimary);
  return true;
};

export const applyThemeColorToContainer = (colorPrimary, element = getThemeContainer()) => {
  injectTenantThemeStylesheet(colorPrimary);
  return applyThemeVarsToElement(colorPrimary, element);
};

export const observeTenantThemeOverride = (colorPrimary, onReapply) => {
  if (typeof document === 'undefined' || !colorPrimary || typeof MutationObserver === 'undefined') {
    return () => {};
  }

  const globalStyle = document.getElementById(GLOBAL_THEME_STYLE_ID);
  const observer = new MutationObserver(() => {
    onReapply(colorPrimary);
  });

  if (globalStyle) {
    observer.observe(globalStyle, {
      childList: true,
      characterData: true,
      subtree: true
    });
  }

  return () => {
    observer.disconnect();
  };
};
