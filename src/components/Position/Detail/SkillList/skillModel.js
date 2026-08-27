/**
 * Position skill list contract (embedded in position.skill JSON).
 *
 * @typedef {Object} PositionSkillContentItem
 * @property {string} title
 * @property {string} description
 * @property {string} [source]
 *
 * @typedef {Object} PositionSkillItem
 * @property {string} id
 * @property {string} name
 * @property {'existing'|'new'} origin
 * @property {number} importanceNow - baseline importance (1–5)
 * @property {number} importanceYear - current-year importance (1–5), not a fixed calendar year like 2030
 * @property {'must_build'|'ai_emerging'|'new'|'enhanced'|'stable'|'declining'} change
 * @property {'high'|'medium'|'low'} [aiExposure]
 * @property {'high'|'medium'|'low'} [confidence]
 * @property {PositionSkillContentItem[]} [contentItems]
 */

export const ORIGIN_VALUES = ['existing', 'new'];

export const CHANGE_VALUES = ['must_build', 'ai_emerging', 'new', 'enhanced', 'stable', 'declining'];

export const LEVEL_VALUES = ['high', 'medium', 'low'];

export const IMPORTANCE_MIN = 1;
export const IMPORTANCE_MAX = 5;

export const CHANGE_META = {
  must_build: { labelKey: 'position.skillChange.must_build', bg: '#dfdeff', color: '#121163' },
  ai_emerging: { labelKey: 'position.skillChange.ai_emerging', bg: '#ecf2ed', color: '#2a533c' },
  new: { labelKey: 'position.skillChange.new', bg: '#a4e0fc', color: '#0d4159' },
  enhanced: { labelKey: 'position.skillChange.enhanced', bg: '#fce0d1', color: '#5f2d11' },
  stable: { labelKey: 'position.skillChange.stable', bg: '#d1dce7', color: '#132c5d' },
  declining: { labelKey: 'position.skillChange.declining', bg: '#f0dcf6', color: '#5a105f' }
};

export const ORIGIN_META = {
  existing: { labelKey: 'position.skillOrigin.existing' },
  new: { labelKey: 'position.skillOrigin.new' }
};

export const LEVEL_META = {
  high: { labelKey: 'position.skillLevel.high', bg: '#fce0d1', color: '#5f2d11' },
  medium: { labelKey: 'position.skillLevel.medium', bg: '#d1dce7', color: '#132c5d' },
  low: { labelKey: 'position.skillLevel.low', bg: '#ecf2ed', color: '#2a533c' }
};

const clampImportance = value => {
  const num = Number(value);
  if (!Number.isFinite(num)) {
    return IMPORTANCE_MIN;
  }
  return Math.min(IMPORTANCE_MAX, Math.max(IMPORTANCE_MIN, Math.round(num)));
};

const LEGACY_JD_TITLE = '职位描述 / 胜任力';
const LEGACY_SHOCK_TITLE = '冲击报告';

const normalizeContentItem = raw => {
  if (!raw || typeof raw !== 'object') {
    return null;
  }
  const title = typeof raw.title === 'string' ? raw.title.trim() : '';
  const description =
    typeof raw.description === 'string' ? raw.description.trim() : typeof raw.desc === 'string' ? raw.desc.trim() : typeof raw.text === 'string' ? raw.text.trim() : typeof raw.content === 'string' ? raw.content.trim() : '';
  const source = typeof raw.source === 'string' ? raw.source.trim() : '';
  if (!title && !description && !source) {
    return null;
  }
  return {
    title: title.slice(0, 200),
    description: description.slice(0, 2000),
    source: source.slice(0, 200)
  };
};

export const normalizeContentItems = value => {
  if (typeof value === 'string') {
    const text = value.trim();
    return text ? [{ title: '', description: text.slice(0, 2000), source: '' }] : [];
  }
  if (Array.isArray(value)) {
    return value.map(normalizeContentItem).filter(Boolean);
  }
  if (value && typeof value === 'object') {
    if (Array.isArray(value.items)) {
      return normalizeContentItems(value.items);
    }
    if (typeof value.text === 'string' || typeof value.desc === 'string' || typeof value.content === 'string' || typeof value.source === 'string' || typeof value.title === 'string' || typeof value.description === 'string') {
      const legacy = normalizeContentItem(value);
      return legacy ? [legacy] : [];
    }
  }
  return [];
};

const normalizeLegacyContentBlock = (value, defaultTitle) => {
  const items = normalizeContentItems(value);
  if (!items.length && typeof value === 'string' && value.trim()) {
    return [{ title: defaultTitle, description: value.trim().slice(0, 2000), source: '' }];
  }
  return items.map(item => ({
    ...item,
    title: item.title || defaultTitle
  }));
};

/** Merge contentItems with legacy jd / shockReport fields. @returns {PositionSkillContentItem[]} */
export const normalizeSkillContentItems = raw => {
  if (!raw || typeof raw !== 'object') {
    return [];
  }
  const merged = [...normalizeContentItems(raw.contentItems), ...normalizeLegacyContentBlock(raw.jd, LEGACY_JD_TITLE), ...normalizeLegacyContentBlock(raw.shockReport, LEGACY_SHOCK_TITLE)];
  const seen = new Set();
  return merged.filter(item => {
    const key = `${item.title}\0${item.description}\0${item.source}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
};

export const createSkillId = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `skill-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
};

/** @returns {PositionSkillItem} */
export const createEmptySkill = () => ({
  id: createSkillId(),
  name: '',
  origin: 'existing',
  importanceNow: 3,
  importanceYear: 3,
  change: 'stable',
  aiExposure: 'medium',
  confidence: 'medium',
  contentItems: []
});

/** @returns {PositionSkillItem|null} */
export const normalizeSkillItem = (raw, index = 0) => {
  if (!raw || typeof raw !== 'object') {
    return null;
  }
  const origin = ORIGIN_VALUES.includes(raw.origin) ? raw.origin : 'existing';
  const importanceNow = clampImportance(raw.importanceNow);
  const importanceYear = clampImportance(raw.importanceYear);
  let change = CHANGE_VALUES.includes(raw.change) ? raw.change : null;
  if (!change) {
    if (importanceYear <= importanceNow - 1) {
      change = 'declining';
    } else if (importanceYear >= importanceNow + 2 && origin === 'new') {
      change = 'ai_emerging';
    } else if (importanceYear >= importanceNow + 1) {
      change = origin === 'new' ? 'new' : 'enhanced';
    } else {
      change = 'stable';
    }
  }
  const aiExposure = LEVEL_VALUES.includes(raw.aiExposure) ? raw.aiExposure : 'medium';
  const confidence = LEVEL_VALUES.includes(raw.confidence) ? raw.confidence : 'medium';
  const name = typeof raw.name === 'string' ? raw.name.trim() : '';
  if (!name) {
    return null;
  }
  // Prefer persisted id; otherwise a stable fallback so hover/list lookups stay consistent across normalize passes.
  const id = typeof raw.id === 'string' && raw.id ? raw.id : `skill-${index}-${name.slice(0, 40)}`;
  return {
    id,
    name: name.slice(0, 200),
    origin,
    importanceNow,
    importanceYear,
    change,
    aiExposure,
    confidence,
    contentItems: normalizeSkillContentItems(raw)
  };
};

/** @returns {PositionSkillItem[]} */
export const normalizeSkills = skill => {
  if (!Array.isArray(skill)) {
    return [];
  }
  return skill.map((raw, index) => normalizeSkillItem(raw, index)).filter(Boolean);
};

export const countByChange = skills => {
  const counts = CHANGE_VALUES.reduce((acc, key) => {
    acc[key] = 0;
    return acc;
  }, {});
  (skills || []).forEach(item => {
    if (counts[item.change] != null) {
      counts[item.change] += 1;
    }
  });
  return counts;
};

/**
 * @typedef {Object} PositionVerdict
 * @property {string} summary
 * @property {string} today
 * @property {string} future
 * @property {string} [futureLabel] - optional display label, e.g. "2026–2030"
 */

/** @returns {PositionVerdict} */
export const normalizeVerdict = raw => {
  if (!raw || typeof raw !== 'object') {
    return { summary: '', today: '', future: '', futureLabel: '' };
  }
  return {
    summary: typeof raw.summary === 'string' ? raw.summary : '',
    today: typeof raw.today === 'string' ? raw.today : '',
    future: typeof raw.future === 'string' ? raw.future : '',
    futureLabel: typeof raw.futureLabel === 'string' ? raw.futureLabel : ''
  };
};

/** Metrics for the overview cards above the skill table. */
export const getSkillMetrics = skills => {
  const list = skills || [];
  const counts = countByChange(list);
  return {
    inScope: list.length,
    mustBuild: counts.must_build,
    aiEmerging: counts.ai_emerging,
    fading: counts.declining
  };
};
