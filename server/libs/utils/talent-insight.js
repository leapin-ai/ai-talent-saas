const { extractInterviewSignals } = require('./extract-interview-signals');
const { requestTalentInsightFill, normalizeOutputLanguage } = require('./llm-runner');

const buildTalentInsightSchemaHint = () => ({
  readiness: {
    readiness: '0-100',
    summary: 'string',
    metrics: { criticalGaps: 'number', atOrAbove: 'number', monthsToClose: 'number|null' },
    priorityGaps: [{ rank: 'number', title: 'string', description: 'string', current: '0-5', required: '0-5' }],
    skills: [{ id: 'string', name: 'string', current: '0-5', required: '0-5', status: 'critical|gap|onTarget|above', evidence: 'string' }],
    developmentPlan: {
      subtitle: 'string',
      horizons: [
        {
          key: 'short|mid|long',
          title: 'string',
          target: 'string',
          items: [{ tag: 'string', title: 'string', meta: 'string' }]
        }
      ]
    }
  },
  aiSuggest: {
    shortTerm: {
      target_position: 'string',
      development_points: ['string'],
      training_focus: ['string'],
      skill_gap: [{ name: 'string', level: 'high|medium|low' }]
    },
    longTerm: {
      target_position: 'string',
      development_points: ['string'],
      training_focus: ['string'],
      skill_gap: [{ name: 'string', level: 'high|medium|low' }]
    },
    matchPosition: {
      target_position: 'string',
      match_rate: '0-1',
      skill_match: ['string'],
      skill_gap: [{ name: 'string' }]
    }
  }
});

const normalizeInsightReadiness = raw => {
  const data = raw && typeof raw === 'object' ? raw : {};
  const readinessNum = Number(data.readiness);
  const metrics = data.metrics && typeof data.metrics === 'object' ? data.metrics : {};
  const priorityGaps = Array.isArray(data.priorityGaps)
    ? data.priorityGaps
        .map((item, index) => {
          if (!item || typeof item !== 'object') {
            return null;
          }
          const title = typeof item.title === 'string' ? item.title.trim() : '';
          if (!title) {
            return null;
          }
          return {
            rank: Number.isFinite(Number(item.rank)) ? Math.round(Number(item.rank)) : index + 1,
            title: title.slice(0, 200),
            description: typeof item.description === 'string' ? item.description : '',
            current: Number.isFinite(Number(item.current)) ? Math.min(5, Math.max(0, Math.round(Number(item.current)))) : undefined,
            required: Number.isFinite(Number(item.required)) ? Math.min(5, Math.max(0, Math.round(Number(item.required)))) : undefined
          };
        })
        .filter(Boolean)
    : [];
  const skills = Array.isArray(data.skills)
    ? data.skills
        .map(item => {
          if (!item || typeof item !== 'object') {
            return null;
          }
          const name = typeof item.name === 'string' ? item.name.trim() : '';
          if (!name) {
            return null;
          }
          return {
            id: typeof item.id === 'string' ? item.id : undefined,
            name: name.slice(0, 200),
            current: Number.isFinite(Number(item.current)) ? Math.min(5, Math.max(0, Math.round(Number(item.current)))) : 0,
            required: Number.isFinite(Number(item.required)) ? Math.min(5, Math.max(0, Math.round(Number(item.required)))) : 0,
            status: typeof item.status === 'string' ? item.status : undefined,
            evidence: typeof item.evidence === 'string' ? item.evidence.slice(0, 100) : undefined
          };
        })
        .filter(Boolean)
    : [];
  return {
    readiness: Number.isFinite(readinessNum) ? Math.min(100, Math.max(0, Math.round(readinessNum))) : null,
    summary: typeof data.summary === 'string' ? data.summary : '',
    metrics: {
      criticalGaps: Number.isFinite(Number(metrics.criticalGaps)) ? Math.round(Number(metrics.criticalGaps)) : 0,
      atOrAbove: Number.isFinite(Number(metrics.atOrAbove)) ? Math.round(Number(metrics.atOrAbove)) : 0,
      monthsToClose: metrics.monthsToClose == null || metrics.monthsToClose === '' ? null : Number.isFinite(Number(metrics.monthsToClose)) ? Math.round(Number(metrics.monthsToClose)) : null
    },
    priorityGaps,
    skills,
    developmentPlan: data.developmentPlan && typeof data.developmentPlan === 'object' ? data.developmentPlan : null
  };
};

const normalizeInsightAiSuggest = raw => {
  const data = raw && typeof raw === 'object' ? raw : {};
  const normalizeTerm = value => {
    if (!value || typeof value !== 'object') {
      return null;
    }
    return {
      target_position: typeof value.target_position === 'string' ? value.target_position : value.position || '',
      development_points: Array.isArray(value.development_points) ? value.development_points.map(item => (typeof item === 'string' ? item : item?.name || '')).filter(Boolean) : [],
      training_focus: Array.isArray(value.training_focus) ? value.training_focus.map(item => (typeof item === 'string' ? item : item?.name || '')).filter(Boolean) : [],
      skill_gap: Array.isArray(value.skill_gap)
        ? value.skill_gap.map(item => {
            if (typeof item === 'string') {
              return { name: item, level: 'medium' };
            }
            return { name: item?.name || item?.title || '', level: item?.level || 'medium' };
          })
        : []
    };
  };
  const normalizeMatch = value => {
    if (!value || typeof value !== 'object') {
      return null;
    }
    const matchRateRaw = value.match_rate != null ? Number(value.match_rate) : value.matchRate != null ? Number(value.matchRate) / 100 : 0;
    const matchRate = Number.isFinite(matchRateRaw) ? (matchRateRaw > 1 ? matchRateRaw / 100 : matchRateRaw) : 0;
    return {
      target_position: typeof value.target_position === 'string' ? value.target_position : value.position || '',
      match_rate: Math.min(1, Math.max(0, matchRate)),
      skill_match: Array.isArray(value.skill_match) ? value.skill_match.map(item => (typeof item === 'string' ? item : item?.name || '')).filter(Boolean) : [],
      skill_gap: Array.isArray(value.skill_gap) ? value.skill_gap.map(item => (typeof item === 'string' ? { name: item } : { name: item?.name || item?.title || '' })) : []
    };
  };
  return {
    shortTerm: normalizeTerm(data.shortTerm),
    longTerm: normalizeTerm(data.longTerm),
    matchPosition: normalizeMatch(data.matchPosition)
  };
};

const runTalentInsightFill = async (fastify, { language, context, draft }) => {
  const outputLanguage = normalizeOutputLanguage(language || context?.outputLanguage || 'zh-CN');
  const raw = await requestTalentInsightFill(fastify, {
    schema: buildTalentInsightSchemaHint(),
    context: Object.assign({}, context, { outputLanguage }),
    draft: draft || {},
    language: outputLanguage
  });
  return {
    language: outputLanguage,
    readiness: normalizeInsightReadiness(raw?.readiness || raw),
    aiSuggest: normalizeInsightAiSuggest(raw?.aiSuggest || raw)
  };
};

module.exports = {
  extractInterviewSignals,
  buildTalentInsightSchemaHint,
  normalizeInsightReadiness,
  normalizeInsightAiSuggest,
  runTalentInsightFill
};
