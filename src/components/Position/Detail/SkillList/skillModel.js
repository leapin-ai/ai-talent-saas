/**
 * Position skill list contract (embedded in position.skill JSON).
 *
 * @typedef {Object} PositionSkillJd
 * @property {string} text
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
 * @property {PositionSkillJd} [jd]
 * @property {PositionSkillJd} [shockReport]
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
  high: { labelKey: 'position.skillLevel.high' },
  medium: { labelKey: 'position.skillLevel.medium' },
  low: { labelKey: 'position.skillLevel.low' }
};

const clampImportance = value => {
  const num = Number(value);
  if (!Number.isFinite(num)) {
    return IMPORTANCE_MIN;
  }
  return Math.min(IMPORTANCE_MAX, Math.max(IMPORTANCE_MIN, Math.round(num)));
};

const normalizeTextBlock = value => {
  if (!value || typeof value !== 'object') {
    return { text: '', source: '' };
  }
  return {
    text: typeof value.text === 'string' ? value.text : '',
    source: typeof value.source === 'string' ? value.source : ''
  };
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
  jd: { text: '', source: '' },
  shockReport: { text: '', source: '' }
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
    jd: normalizeTextBlock(raw.jd),
    shockReport: normalizeTextBlock(raw.shockReport)
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
