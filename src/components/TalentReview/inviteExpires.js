export const DEFAULT_PROJECT_TIMEZONE = 'Asia/Shanghai';

export const resolveProjectTimeZone = projectOrTimeZone => {
  if (typeof projectOrTimeZone === 'string' && projectOrTimeZone) {
    return projectOrTimeZone;
  }
  return (projectOrTimeZone && (projectOrTimeZone.timeZone || projectOrTimeZone.timezone)) || DEFAULT_PROJECT_TIMEZONE;
};

export const toProjectCalendarDay = (value, projectOrTimeZone) => {
  if (value == null || value === '') {
    return null;
  }
  const date = value && typeof value.toDate === 'function' ? value.toDate() : value instanceof Date ? value : new Date(value);
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

export const isExpiresAfterProjectEndDay = (expires, endTime, projectOrTimeZone) => {
  const expiresDay = toProjectCalendarDay(expires, projectOrTimeZone);
  const endDay = toProjectCalendarDay(endTime, projectOrTimeZone);
  if (!expiresDay || !endDay) {
    return false;
  }
  return expiresDay > endDay;
};

/** DatePicker：项目时区下今天之前不可选，结束日 D 可选、D+1 及之后不可选 */
export const disableInviteExpiresDate = (date, project) => {
  if (!date) {
    return false;
  }
  const tz = resolveProjectTimeZone(project);
  const day = toProjectCalendarDay(date, tz);
  const today = toProjectCalendarDay(new Date(), tz);
  if (day && today && day < today) {
    return true;
  }
  if (project && project.endTime && isExpiresAfterProjectEndDay(date, project.endTime, tz)) {
    return true;
  }
  return false;
};

/** 结束日已过时仍回填结束日，不改成今天+7以免越界发送 */
export const defaultInviteExpires = endTime => (endTime ? endTime : undefined);

export const isInviteExpiresInvalid = (expires, project) => {
  if (!expires || !project || !project.endTime) {
    return false;
  }
  return isExpiresAfterProjectEndDay(expires, project.endTime, project);
};
