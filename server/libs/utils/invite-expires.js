const DEFAULT_PROJECT_TIMEZONE = 'Asia/Shanghai';

const resolveProjectTimeZone = projectOrTimeZone => {
  if (typeof projectOrTimeZone === 'string' && projectOrTimeZone) {
    return projectOrTimeZone;
  }
  return (projectOrTimeZone && (projectOrTimeZone.timeZone || projectOrTimeZone.timezone)) || DEFAULT_PROJECT_TIMEZONE;
};

const toProjectCalendarDay = (value, projectOrTimeZone) => {
  if (value == null || value === '') {
    return null;
  }
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  const tz = resolveProjectTimeZone(projectOrTimeZone);
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date);
  const map = {};
  parts.forEach(part => {
    if (part.type !== 'literal') {
      map[part.type] = part.value;
    }
  });
  return `${map.year}-${map.month}-${map.day}`;
};

const isExpiresAfterProjectEndDay = (expires, endTime, projectOrTimeZone) => {
  const expiresDay = toProjectCalendarDay(expires, projectOrTimeZone);
  const endDay = toProjectCalendarDay(endTime, projectOrTimeZone);
  if (!expiresDay || !endDay) {
    return false;
  }
  return expiresDay > endDay;
};

const isExpiresBeforeToday = (expires, projectOrTimeZone) => {
  const expiresDay = toProjectCalendarDay(expires, projectOrTimeZone);
  const today = toProjectCalendarDay(new Date(), projectOrTimeZone);
  if (!expiresDay || !today) {
    return false;
  }
  return expiresDay < today;
};

const assertInviteExpiresWithinProject = ({ expires, project, endTime, timeZone } = {}) => {
  const end = endTime != null ? endTime : project && project.endTime;
  const tz = timeZone || project;
  if (expires == null || expires === '' || end == null || end === '') {
    return;
  }
  if (isExpiresAfterProjectEndDay(expires, end, tz)) {
    const error = new Error('邀请截止日期不能晚于项目盘点结束日');
    error.statusCode = 400;
    error.code = 400;
    throw error;
  }
};

module.exports = {
  DEFAULT_PROJECT_TIMEZONE,
  resolveProjectTimeZone,
  toProjectCalendarDay,
  isExpiresAfterProjectEndDay,
  isExpiresBeforeToday,
  assertInviteExpiresWithinProject
};
