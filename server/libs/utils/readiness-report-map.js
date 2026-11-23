/**
 * 就绪度流程阶段产出 → 档案「就绪度 / Role Insights」展示与落库结构。
 * 个人：person_reports + assess(/update) + forecast → skillAnalysis
 * 组织：role_report + forecast → RoleInsights 只读视图 / position.outlook
 */

const asArray = value => (Array.isArray(value) ? value : []);

const unwrap = output => {
  if (!output || typeof output !== 'object') {
    return {};
  }
  if (output.result && typeof output.result === 'object' && !Array.isArray(output.result)) {
    return output.result;
  }
  return output;
};

/** A1–A5 / 1–5 → 1–5；unknown 或缺省 → 0 */
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

const skillStatus = (current, required) => {
  // 评估为 unknown（current=0）时仍按目标等级差记 gap/critical，档案页才能出优先差距与指标
  if (!current && !required) {
    return 'unknown';
  }
  if (required - current >= 2) {
    return 'critical';
  }
  if (required > current) {
    return 'gap';
  }
  if (current > required) {
    return 'above';
  }
  return 'onTarget';
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

/**
 * 个人就绪度：以 forecast 任务为骨架，当前等级取最新评估，目标等级取 forecast.expected_ai_level；
 * 优先差距优先用 person_reports，否则从技能差推导 Top 3。
 */
const buildPersonAnalysis = ({ report, assess, forecast } = {}) => {
  const reportData = unwrap(report);
  const assessData = unwrap(assess);
  const forecastData = unwrap(forecast);
  const assessById = new Map(asArray(assessData.tasks).map(item => [String(item.task_id || item.task), item]));
  const skills = asArray(forecastData.tasks).map(task => {
    const assessTask = assessById.get(String(task.task_id)) || assessById.get(String(task.task)) || {};
    const current = aiLevelToNum(assessTask.ai_level);
    const required = aiLevelToNum(task.expected_ai_level);
    return {
      id: task.task_id ? String(task.task_id) : undefined,
      name: task.task || assessTask.task || '',
      title: task.task || assessTask.task || '',
      current,
      required,
      status: skillStatus(current, required),
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
  const atOrAbove = skills.filter(item => item.current > 0 && item.current >= item.required).length;
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

/** forecast 任务 → RoleInsights SkillList 行 */
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

/** role_report → SkillOverview verdict */
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

const STRATEGY_ACTIONS = ['BUILD', 'MOVE', 'BUY', 'AUGMENT'];

const normalizeStrategyAction = value => {
  const action = String(value || '')
    .trim()
    .toUpperCase();
  return STRATEGY_ACTIONS.includes(action) ? action : null;
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

/** forecast → workforce.replaceTasks 入参 */
const buildPositionTasks = forecast =>
  buildRoleSkills(forecast).map((skill, index) => ({
    activityGroup: skill.activityGroup || 'A01',
    sortOrder: index,
    title: skill.name,
    description: asArray(skill.contentItems)
      .map(item => item.description)
      .filter(Boolean)
      .join('\n'),
    importanceNow: skill.importanceNow,
    importanceFuture: skill.importanceYear,
    change: skill.change,
    confidence: skill.confidence,
    detail: {
      contentItems: asArray(skill.contentItems),
      whyToday: skill.contentItems?.[0]?.description || '',
      whyFuture: skill.contentItems?.[1]?.description || ''
    }
  }));

const buildRolePreview = ({ report, forecast } = {}) => ({
  skills: buildRoleSkills(forecast),
  verdict: buildRoleVerdict(report),
  strategies: buildRoleStrategies(report)
});

/** 写入 position.outlook 的结构（与 normalizePositionVerdict 对齐） */
const buildPositionOutlook = report => {
  const verdict = buildRoleVerdict(report);
  return {
    summary: verdict.summary,
    today: verdict.today,
    future: verdict.future,
    futureLabel: verdict.futureLabel,
    aiEfficiencyGain: verdict.aiEfficiencyGain,
    drivesSuccessNow: verdict.today ? [verdict.today] : [],
    howRoleChanging: verdict.future ? [verdict.future] : []
  };
};

module.exports = {
  asArray,
  unwrap,
  aiLevelToNum,
  buildPersonAnalysis,
  buildRolePreview,
  buildRoleSkills,
  buildRoleVerdict,
  buildRoleStrategies,
  buildPositionOutlook,
  buildPositionTasks
};
