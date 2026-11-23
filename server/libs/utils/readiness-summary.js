/**
 * 阶段产出 → 详情页展示用的数量摘要（只含计数等小字段，避免把整份 output 下发给列表）。
 * 返回 { key: value }，key 由前端翻译；无可展示内容时返回 null。
 */
const asArray = value => (Array.isArray(value) ? value : []);
const resultOf = output => (output.result && typeof output.result === 'object' && !Array.isArray(output.result) ? output.result : output);
const sumOf = (list, pick) => list.reduce((total, item) => total + asArray(pick(item)).length, 0);
// 技能按 A1–A5 等级分布在 levels 里，同一技能在多个等级重复出现，按名称去重计数
const skillCountOf = taskSkills =>
  taskSkills.reduce((total, item) => {
    const names = new Set([...asArray(item?.skills), ...Object.values(item?.levels || {}).flatMap(asArray)].map(skill => (skill && typeof skill === 'object' ? skill.name || skill.skill_id : skill)));
    return total + names.size;
  }, 0);

const SUMMARIZERS = {
  draft: result => ({ tasks: asArray(result.tasks).length }),
  revise: result => ({ tasks: asArray(result.tasks).length }),
  manager_questionnaire: result => ({ questions: asArray(result.questionnaire).length, interviews: asArray(result.interview).length }),
  staff_questionnaire: result => ({ questions: asArray(result.questionnaire).length, interviews: asArray(result.interview).length }),
  reassess: result => ({ supplements: asArray(result.reassess?.rows).length }),
  manager_confirm: (result, output) => ({ confirmedBy: output.confirmedByName || output.confirmedByEmail }),
  staff_confirm: (result, output) => ({ confirmedBy: output.confirmedByName || output.confirmedByEmail }),
  reassess_confirm: (result, output) => ({ confirmedBy: output.confirmedByName || output.confirmedByEmail }),
  manager_publish: (result, output) => ({ questions: asArray(output.questionnaireFields).length }),
  staff_publish: (result, output) => ({ questions: asArray(output.questionnaireFields).length }),
  reassess_publish: (result, output) => ({ questions: asArray(output.questionnaireFields).length }),
  manager_send: (result, output) => ({ recipients: asArray(output.recipients).length }),
  staff_send: (result, output) => ({ recipients: asArray(output.recipients).length }),
  reassess_send: (result, output) => ({ recipients: asArray(output.recipients).length }),
  manager_answers: (result, output) => ({ answers: Object.keys(output.answers || {}).length, videos: asArray(output.videoAnswers).length }),
  answers: (result, output) => ({ answers: Object.keys(output.answers || {}).length, videos: asArray(output.videoAnswers).length }),
  reassess_answers: (result, output) => ({ answers: Object.keys(output.answers || {}).length, videos: asArray(output.videoAnswers).length }),
  assess: result => ({ tasks: asArray(result.tasks).length, completion: result.profile_completion_pct }),
  assess_update: result => ({ tasks: asArray(result.tasks).length, completion: result.profile_completion_pct }),
  claims: result => ({ claims: asArray(result.internal).length }),
  recall: result => ({ tasks: asArray(result.external).length, evidence: sumOf(asArray(result.external), item => item?.evidence) }),
  skills: result => ({ tasks: asArray(result.task_skills).length, skills: skillCountOf(asArray(result.task_skills)) }),
  forecast: result => ({ tasks: asArray(result.tasks).length })
};

const summarizeStageOutput = (stage, output) => {
  const summarize = SUMMARIZERS[stage];
  if (!summarize || !output || typeof output !== 'object' || output.skipped === true) {
    return null;
  }
  const entries = Object.entries(summarize(resultOf(output), output)).filter(([, value]) => value !== undefined && value !== null && value !== '');
  return entries.length ? Object.fromEntries(entries) : null;
};

module.exports = { summarizeStageOutput };
