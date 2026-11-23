/**
 * 就绪度流程阶段产出 → 预览用 ProfileReadiness / RoleInsights 结构。
 * 与 server/libs/utils/readiness-report-map.js 对齐（Admin 预览不走租户会话，只能前端映射）。
 */

const asArray = value => (Array.isArray(value) ? value : []);

export const unwrap = output => {
  if (!output || typeof output !== 'object') {
    return {};
  }
  if (output.result && typeof output.result === 'object' && !Array.isArray(output.result)) {
    return output.result;
  }
  return output;
};

const aiLevelToNum = value => {
  if (value == null || value === '') {
    return 0;
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.min(5, Math.max(0, Math.round(value)));
  }
  const text = String(value).trim();
  if (!text || /^unknown$/i.test(text)) {
    return 0;
  }
  const matched = text.match(/A?\s*([1-5])/i);
  return matched ? Number(matched[1]) : 0;
};

const normalizeEvidence = list =>
  asArray(list)
    .map(item => {
      if (!item || typeof item !== 'object') {
        return null;
      }
      const title = typeof item.title === 'string' ? item.title.trim() : '';
      const summary = typeof item.summary === 'string' ? item.summary.trim() : typeof item.description === 'string' ? item.description.trim() : '';
      const source = typeof item.source === 'string' ? item.source.trim() : '';
      if (!title && !summary && !source) {
        return null;
      }
      return { title, summary, source };
    })
    .filter(Boolean);

const mapGap = (item, index) => ({
  rank: item.rank ?? index + 1,
  title: item.title || item.name || '',
  description: item.description || item.detail || '',
  ...(item.current != null || item.current_level != null ? { current: aiLevelToNum(item.current ?? item.current_level) } : {}),
  ...(item.required != null || item.required_level != null ? { required: aiLevelToNum(item.required ?? item.required_level) } : {})
});

const CHANGE_TO_SKILL = {
  stable: 'stable',
  increasing: 'enhanced',
  decreasing: 'declining',
  declining: 'declining',
  enhanced: 'enhanced',
  new: 'new',
  add: 'new',
  appear: 'new',
  disappear: 'declining',
  replaced: 'enhanced',
  replace: 'enhanced',
  change: 'enhanced',
  must_build: 'must_build',
  ai_emerging: 'ai_emerging'
};

const forecastChange = value => {
  const key = String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_');
  return CHANGE_TO_SKILL[key] || 'stable';
};

const STRATEGY_ACTIONS = ['BUILD', 'MOVE', 'BUY', 'AUGMENT'];

const normalizeStrategyAction = value => {
  const action = String(value || '')
    .trim()
    .toUpperCase();
  return STRATEGY_ACTIONS.includes(action) ? action : null;
};

/** person_reports + assess + forecast → ProfileReadiness.analysisOverride */
export const buildPersonAnalysis = ({ report, assess, forecast } = {}) => {
  const reportData = unwrap(report);
  const assessData = unwrap(assess);
  const forecastData = unwrap(forecast);
  const assessById = new Map(asArray(assessData.tasks).map(item => [String(item.task_id || item.task), item]));
  const skills = asArray(forecastData.tasks).map(task => {
    const assessTask = assessById.get(String(task.task_id)) || assessById.get(String(task.task)) || {};
    const current = aiLevelToNum(assessTask.ai_level);
    const required = aiLevelToNum(task.expected_ai_level);
    // 评估 unknown（current=0）仍按等级差标 gap/critical，避免预览指标与优先差距为空
    let status = 'onTarget';
    if (!current && !required) {
      status = 'unknown';
    } else if (required - current >= 2) {
      status = 'critical';
    } else if (required > current) {
      status = 'gap';
    } else if (current > required) {
      status = 'above';
    }
    return {
      id: task.task_id ? String(task.task_id) : undefined,
      name: task.task || assessTask.task || '',
      title: task.task || assessTask.task || '',
      current,
      required,
      status,
      confidence: assessTask.level_confidence ?? task.prediction_confidence,
      evidence: normalizeEvidence(assessTask.evidence?.length ? assessTask.evidence : task.evidence)
    };
  });
  const reportGaps = asArray(reportData.priority_gaps || reportData.priorityGaps)
    .map(mapGap)
    .filter(item => item.title);
  const derivedGaps = skills
    .filter(item => item.required > item.current)
    .sort((a, b) => b.required - b.current - (a.required - a.current) || b.required - a.required)
    .slice(0, 3)
    .map((item, index) => ({
      rank: index + 1,
      title: item.name,
      description: '',
      current: item.current,
      required: item.required
    }));
  const priorityGaps = reportGaps.length ? reportGaps : derivedGaps;
  const keySkillGaps = asArray(reportData.key_skill_gaps || reportData.keySkillGaps)
    .map(mapGap)
    .filter(item => item.title);
  const atOrAbove = skills.filter(item => item.status === 'onTarget' || item.status === 'above').length;
  const criticalGaps = skills.filter(item => item.status === 'critical' || item.status === 'gap').length;
  const readiness = reportData.readiness_score ?? reportData.readiness;
  return {
    readiness: readiness == null || !Number.isFinite(Number(readiness)) ? 0 : Math.min(100, Math.max(0, Math.round(Number(readiness)))),
    summary: reportData.where_they_stand || reportData.summary || '',
    metrics: {
      monthsToClose: reportData.months_to_close ?? reportData.monthsToClose ?? null,
      criticalGaps,
      atOrAbove
    },
    priorityGaps,
    keySkillGaps,
    skills
  };
};

const buildRoleSkills = forecast =>
  asArray(unwrap(forecast).tasks).map(task => ({
    id: String(task.task_id || task.task),
    name: task.task || '',
    activityGroup: task.activity || '',
    activityTitle: task.activity || '',
    origin: /new|add|appear/i.test(String(task.change || '')) ? 'new' : 'existing',
    importanceNow: task.importance_now,
    importanceYear: task.importance_year,
    change: forecastChange(task.change),
    confidence: task.prediction_confidence || 'medium',
    aiExposure: task.ai_exposure || 'medium',
    contentItems: normalizeEvidence(task.evidence).map(item => ({
      title: item.title,
      description: item.summary,
      source: item.source
    }))
  }));

const buildRoleVerdict = report => {
  const data = unwrap(report);
  return {
    summary: data.headline || data.summary || '',
    today: data.what_drives_success_now || data.today || '',
    future: data.how_the_role_is_changing || data.future || '',
    futureLabel: '',
    aiEfficiencyGain: data.ai_efficiency_gain ?? data.aiEfficiencyGain ?? null
  };
};

const buildRoleStrategies = report =>
  asArray(unwrap(report).workforce_strategy || unwrap(report).workforceStrategy)
    .map((item, index) => {
      const action = normalizeStrategyAction(item.action || item.type);
      if (!action) {
        return null;
      }
      return {
        id: item.id || `strategy-${index}`,
        action,
        title: item.title || item.name || action,
        detail: item.detail || item.description || item.summary || ''
      };
    })
    .filter(Boolean);

/** role_report + forecast → RoleInsightsContent */
export const buildRolePreview = ({ report, forecast } = {}) => ({
  skills: buildRoleSkills(forecast),
  verdict: buildRoleVerdict(report),
  strategies: buildRoleStrategies(report)
});
