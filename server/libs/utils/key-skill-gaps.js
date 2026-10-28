const KEY_SKILL_CATEGORIES = ['tool', 'action', 'knowledge'];

const toTextList = value =>
  (Array.isArray(value) ? value : [])
    .filter(item => typeof item === 'string')
    .map(item => item.trim())
    .filter(Boolean);

const normalizeKeySkillGaps = gaps => {
  if (!Array.isArray(gaps)) {
    return [];
  }
  return gaps
    .map((item, index) => {
      if (!item || typeof item !== 'object') {
        return null;
      }
      const skillFuture = typeof item.skillFuture === 'string' ? item.skillFuture.trim() : '';
      const name = (typeof item.name === 'string' && item.name.trim()) || skillFuture;
      if (!name) {
        return null;
      }
      const rank = Number(item.rank);
      const score = item.score == null || item.score === '' ? NaN : Number(item.score);
      const category = typeof item.category === 'string' ? item.category.trim().toLowerCase() : '';
      return {
        rank: Number.isFinite(rank) ? Math.round(rank) : index + 1,
        category: KEY_SKILL_CATEGORIES.includes(category) ? category : '',
        name: name.slice(0, 200),
        skillNow: toTextList(item.skillNow),
        skillFuture: skillFuture || name,
        evolution: toTextList(item.evolution),
        score: Number.isFinite(score) ? score : null,
        primaryTask: typeof item.primaryTask === 'string' ? item.primaryTask : '',
        alsoOnTasks: toTextList(item.alsoOnTasks)
      };
    })
    .filter(Boolean);
};

const keySkillGapsSchemaHint = [
  {
    rank: 'number',
    category: 'tool|action|knowledge',
    name: 'string (same as skillFuture)',
    skillNow: ['string — current skill(s) evolving into skillFuture; [] when brand new'],
    skillFuture: 'string — skill required after AI reshapes the role',
    evolution: ['string, e.g. "<skillNow> → <skillFuture>" or "（新增）→ <skillFuture>"'],
    score: 'number (priority, higher = more critical)',
    primaryTask: 'string — position task (from position.skill) this skill mainly serves',
    alsoOnTasks: ['string — other related task names']
  }
];

module.exports = {
  KEY_SKILL_CATEGORIES,
  normalizeKeySkillGaps,
  keySkillGapsSchemaHint
};
