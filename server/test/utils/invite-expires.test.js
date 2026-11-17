const test = require('node:test');
const assert = require('node:assert/strict');
const { DEFAULT_PROJECT_TIMEZONE, toProjectCalendarDay, isExpiresAfterProjectEndDay, assertInviteExpiresWithinProject } = require('../../libs/utils/invite-expires');

test('default timezone is Asia/Shanghai', () => {
  assert.equal(DEFAULT_PROJECT_TIMEZONE, 'Asia/Shanghai');
});

test('end day D is allowed and D+1 is rejected in project timezone', () => {
  const project = { endTime: '2026-12-19T16:00:00.000Z', timeZone: 'Asia/Shanghai' };
  // 2026-12-19 23:59:59 CST = 2026-12-19T15:59:59.000Z
  const onEndDay = '2026-12-19T15:59:59.000Z';
  const nextDay = '2026-12-19T16:00:00.000Z'; // 2026-12-20 00:00 CST
  assert.equal(toProjectCalendarDay(onEndDay, project), '2026-12-19');
  assert.equal(toProjectCalendarDay(project.endTime, project), '2026-12-20');
  // Use a CST calendar end of 2026-12-19 as project end: 2026-12-19T15:59:59.000Z
  const endOnD = { endTime: '2026-12-19T15:59:59.000Z', timeZone: 'Asia/Shanghai' };
  assert.equal(toProjectCalendarDay(endOnD.endTime, endOnD), '2026-12-19');
  assert.equal(isExpiresAfterProjectEndDay(onEndDay, endOnD.endTime, endOnD), false);
  assert.equal(isExpiresAfterProjectEndDay('2026-12-20T00:00:00+08:00', endOnD.endTime, endOnD), true);
  assert.equal(isExpiresAfterProjectEndDay(nextDay, endOnD.endTime, endOnD), true);
  assert.doesNotThrow(() => assertInviteExpiresWithinProject({ expires: onEndDay, project: endOnD }));
  assert.throws(() => assertInviteExpiresWithinProject({ expires: '2026-12-20T16:00:00.000Z', project: endOnD }), /不能晚于项目盘点结束日/);
});

test('same instant may fall on different calendar days across timezones', () => {
  const ts = '2026-12-19T16:00:00.000Z';
  assert.equal(toProjectCalendarDay(ts, 'Asia/Shanghai'), '2026-12-20');
  assert.equal(toProjectCalendarDay(ts, 'UTC'), '2026-12-19');
});

test('missing expires or endTime is not treated as overflow', () => {
  const project = { endTime: '2026-12-19T15:59:59.000Z', timeZone: 'Asia/Shanghai' };
  assert.equal(isExpiresAfterProjectEndDay(null, project.endTime, project), false);
  assert.doesNotThrow(() => assertInviteExpiresWithinProject({ expires: undefined, project }));
  assert.doesNotThrow(() => assertInviteExpiresWithinProject({ expires: '2026-12-20T00:00:00+08:00', project: { timeZone: 'Asia/Shanghai' } }));
});
