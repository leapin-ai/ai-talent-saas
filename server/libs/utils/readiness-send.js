/** 批量发送问卷的纯函数：收件人整理、按邮箱聚合、Role 可发送性判定 */
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const isValidEmail = value => EMAIL_PATTERN.test(String(value || '').trim());

/** 收件人：[{ name, email, employeeId? }]，按邮箱（不区分大小写）去重，返回有效与无效两组 */
const normalizeRecipients = list => {
  const valid = [];
  const invalid = [];
  const seen = new Set();
  (Array.isArray(list) ? list : []).forEach(item => {
    const email = String(item?.email || '')
      .trim()
      .toLowerCase();
    const name = String(item?.name || '').trim();
    const employeeId = item?.employeeId == null || item.employeeId === '' ? null : String(item.employeeId);
    if (!email) {
      return;
    }
    if (!isValidEmail(email)) {
      invalid.push({ name, email });
      return;
    }
    if (seen.has(email)) {
      return;
    }
    seen.add(email);
    valid.push({ name: name || email, email, employeeId });
  });
  return { valid, invalid };
};

/**
 * 将 [{ email, name, runId, roleName, url }] 按邮箱聚合：同一邮箱一封邮件，items 里列出所有 Role 的链接
 */
const groupItemsByEmail = entries => {
  const groups = new Map();
  entries.forEach(entry => {
    const key = String(entry.email).toLowerCase();
    if (!groups.has(key)) {
      groups.set(key, { email: key, name: entry.name || key, items: [] });
    }
    const group = groups.get(key);
    if (!group.items.some(item => String(item.runId) === String(entry.runId) && item.url === entry.url)) {
      group.items.push({ runId: String(entry.runId), name: entry.roleName, url: entry.url });
    }
  });
  return [...groups.values()];
};

/**
 * Role 之间互相独立：未到发送阶段（如尚未确认）的 Role 只被跳过，不影响其它 Role。
 * eligible(run) 判定由调用方给出，返回 { eligible, skipped }
 */
const classifyRuns = (runs, check) => {
  const eligible = [];
  const skipped = [];
  runs.forEach(run => {
    const reason = check(run);
    if (reason) {
      skipped.push({ runId: String(run.id), roleName: run.roleName, reason });
    } else {
      eligible.push(run);
    }
  });
  return { eligible, skipped };
};

module.exports = { isValidEmail, normalizeRecipients, groupItemsByEmail, classifyRuns };
