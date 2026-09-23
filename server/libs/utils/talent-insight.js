const { extractInterviewSignals } = require('./extract-interview-signals');
const { requestTalentInsightFill, normalizeOutputLanguage } = require('./llm-runner');

const normalizeConfidence = value => {
  const key = String(value || '')
    .trim()
    .toLowerCase();
  return key === 'high' || key === 'medium' || key === 'low' ? key : null;
};

const SOURCE_INFER_RULES = [
  { match: /简历|cv|resume/i, source: '简历' },
  { match: /linkedin/i, source: 'LinkedIn' },
  { match: /ai\s*面试|面试|interview/i, source: 'AI面试' },
  { match: /项目经历|项目/i, source: '项目经历' },
  { match: /\bjd\b|职位描述|岗位描述/i, source: 'JD' },
  { match: /绩效|performance/i, source: '绩效' },
  { match: /证书|认证|certification/i, source: '证书' },
  { match: /档案|profile/i, source: '档案' }
];

const inferEvidenceSourceLabel = text => {
  const s = String(text || '');
  for (const rule of SOURCE_INFER_RULES) {
    if (rule.match.test(s)) {
      return rule.source;
    }
  }
  return '';
};

/** 统一成 [{ source, title, summary }]；每条都补齐 source/title，避免只有第一条有 */
const normalizeSkillEvidence = evidence => {
  const finalize = (summary, source, title) => {
    const text = String(summary || '').trim();
    if (!text) {
      return null;
    }
    let src = String(source || '').trim();
    if (!src || src === 'analysis' || src === 'skill' || src === '分析' || src === '分析依据') {
      src = inferEvidenceSourceLabel(text);
    }
    let ttl = String(title || '').trim();
    if (!ttl) {
      ttl = src || text.slice(0, 40);
    }
    return {
      source: src.slice(0, 64),
      title: ttl.slice(0, 200),
      summary: text.slice(0, 2000)
    };
  };

  const fromOne = item => {
    if (typeof item === 'string') {
      return finalize(item, '', '');
    }
    if (!item || typeof item !== 'object') {
      return null;
    }
    const summary = item.summary || item.text || item.content || item.description || '';
    const source = item.source || item.sourceType || item.sourceLabel || item.origin || '';
    const title = item.title || '';
    return finalize(summary, source, title);
  };

  if (typeof evidence === 'string') {
    const text = evidence.trim();
    if (!text) {
      return undefined;
    }
    const lines = text
      .split(/\n+/)
      .map(line => line.trim())
      .filter(Boolean);
    if (lines.length > 1) {
      const list = lines.map(line => finalize(line, '', '')).filter(Boolean);
      return list.length ? list : undefined;
    }
    const one = finalize(text, '', '');
    return one ? [one] : undefined;
  }
  if (Array.isArray(evidence)) {
    const list = evidence.map(fromOne).filter(Boolean);
    return list.length ? list : undefined;
  }
  if (evidence && typeof evidence === 'object') {
    const one = fromOne(evidence);
    return one ? [one] : undefined;
  }
  return undefined;
};

const buildTalentInsightSchemaHint = () => ({
  readiness: {
    readiness: '0-100',
    summary: 'string',
    metrics: { criticalGaps: 'number', atOrAbove: 'number', monthsToClose: 'number|null' },
    priorityGaps: [{ rank: 'number', title: 'string', description: 'string', current: '0-5', required: '0-5' }],
    skills: [
      {
        id: 'string',
        name: 'string',
        current: '0-5',
        required: '0-5',
        status: 'critical|gap|onTarget|above',
        confidence: 'high|medium|low (REQUIRED)',
        evidence: '[{ source: string REQUIRED (真实来源如 简历/AI面试/项目经历/JD，禁止「分析依据」), title: string REQUIRED (该条证据短标题), summary: string REQUIRED }] — 每条都必须自带 source+title+summary，禁止只填第一条'
      }
    ],
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
          const confidence = normalizeConfidence(item.confidence) || 'medium';
          const evidence = normalizeSkillEvidence(item.evidence);
          return {
            id: typeof item.id === 'string' ? item.id : undefined,
            name: name.slice(0, 200),
            current: Number.isFinite(Number(item.current)) ? Math.min(5, Math.max(0, Math.round(Number(item.current)))) : 0,
            required: Number.isFinite(Number(item.required)) ? Math.min(5, Math.max(0, Math.round(Number(item.required)))) : 0,
            status: typeof item.status === 'string' ? item.status : undefined,
            confidence,
            ...(evidence !== undefined ? { evidence } : {})
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
  normalizeSkillEvidence,
  runTalentInsightFill
};
