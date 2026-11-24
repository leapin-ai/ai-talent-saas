const test = require('node:test');
const assert = require('node:assert/strict');
const { summarizeStageOutput } = require('../../libs/utils/readiness-summary');

test('问卷、发送、答卷阶段按产出计数', () => {
  assert.deepEqual(summarizeStageOutput('manager_questionnaire', { job_id: 'j', result: { questionnaire: [{}, {}, {}], interview: [{}] } }), { questions: 3, interviews: 1 });
  assert.deepEqual(summarizeStageOutput('staff_send', { recipients: ['a', 'b'] }), { recipients: 2 });
  assert.deepEqual(summarizeStageOutput('answers', { answers: { Q01: 'a', Q02: 'b' }, videoAnswers: [{}] }), { answers: 2, videos: 1 });
});

test('技能演进统计任务与技能数（含 levels 中按名称去重的技能）', () => {
  const output = { result: { task_skills: [{ skills: [] }, { skills: ['x', 'y'] }] } };
  assert.deepEqual(summarizeStageOutput('skills', output), { tasks: 2, skills: 2 });
  assert.deepEqual(summarizeStageOutput('skills', { result: { task_skills: [{ skills: [] }] } }), { tasks: 1, skills: 0 });
  const levels = { A1: [{ name: '甲' }, { name: '乙' }], A2: [{ name: '甲' }, { name: '丙' }] };
  assert.deepEqual(summarizeStageOutput('skills', { result: { task_skills: [{ skills: [], levels }] } }), { tasks: 1, skills: 3 });
});

test('评估带上档案完成度；确认带上确认人；缺失字段被丢弃', () => {
  assert.deepEqual(summarizeStageOutput('assess_update', { result: { tasks: [{}], profile_completion_pct: 90 } }), { tasks: 1, completion: 90 });
  assert.deepEqual(summarizeStageOutput('manager_confirm', { confirmedByName: '张三' }), { confirmedBy: '张三' });
  assert.equal(summarizeStageOutput('manager_confirm', { via: 'mail' }), null);
});

test('跳过、未知阶段与空产出返回 null', () => {
  assert.equal(summarizeStageOutput('reassess_confirm', { skipped: true }), null);
  assert.equal(summarizeStageOutput('await_persons', { triggeredAt: 'x' }), null);
  assert.equal(summarizeStageOutput('draft', null), null);
});
