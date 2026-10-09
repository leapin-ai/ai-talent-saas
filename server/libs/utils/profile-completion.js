/** 档案完成度派生字段：不属于员工可编辑字段，写 reviewData.employee / 员工表前须剔除 */
const PROFILE_COMPLETION_FIELDS = ['profileCompletionPercent', 'profileCompletionChecklist', 'profileCompletionEstimate', 'profileCompletionOverride'];

/** 人工完成度：0–100 整数；空 / 非法返回 null（表示按规则自动计算） */
const normalizeProfileCompletionPercent = value => {
  if (value == null || value === '') {
    return null;
  }
  const num = Number(typeof value === 'string' ? value.replace(/%\s*$/, '').trim() : value);
  if (!Number.isFinite(num)) {
    return null;
  }
  return Math.min(100, Math.max(0, Math.round(num)));
};

module.exports = {
  PROFILE_COMPLETION_FIELDS,
  normalizeProfileCompletionPercent
};
