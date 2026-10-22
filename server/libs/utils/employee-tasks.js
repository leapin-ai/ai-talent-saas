const normalizeTitle = value =>
  String(value || '')
    .trim()
    .toLowerCase();

// 个人任务 = 岗位任务 − AI 新兴任务
const resolveEmployeeTargetTasks = positionSkill =>
  (Array.isArray(positionSkill) ? positionSkill : [])
    .filter(item => item && typeof item.name === 'string' && item.name.trim() && item.change !== 'ai_emerging')
    .map(item => ({
      id: item.id ? String(item.id) : undefined,
      name: item.name.trim(),
      activityCode: item.activityCode || '',
      activityTitle: item.activityTitle || '',
      required: item.importanceYear ?? item.importanceFuture
    }));

// AI 返回的 skills 只保留目标任务并改回岗位原标题；缺失的任务补为 unknown
const alignSkillsToTargetTasks = (skills, targetTasks) => {
  if (!Array.isArray(targetTasks) || !targetTasks.length) {
    return skills;
  }
  const byName = new Map();
  const byId = new Map();
  (Array.isArray(skills) ? skills : []).forEach(skill => {
    if (!skill || typeof skill !== 'object') {
      return;
    }
    const key = normalizeTitle(skill.name || skill.title);
    if (key && !byName.has(key)) {
      byName.set(key, skill);
    }
    if (skill.id && !byId.has(String(skill.id))) {
      byId.set(String(skill.id), skill);
    }
  });
  return targetTasks.map(task => {
    const matched = byName.get(normalizeTitle(task.name)) || (task.id ? byId.get(task.id) : null);
    if (matched) {
      return Object.assign({}, matched, { id: task.id || matched.id, name: task.name });
    }
    return { id: task.id, name: task.name, current: 0, required: Number(task.required) || 0, status: 'unknown' };
  });
};

module.exports = {
  resolveEmployeeTargetTasks,
  alignSkillsToTargetTasks
};
