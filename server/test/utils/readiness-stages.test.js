const test = require('node:test');
const assert = require('node:assert/strict');
const stages = require('../../libs/utils/readiness-stages');
const { ROLE_STAGES, PERSON_STAGES, getDef, stageIndex, rollbackPlan, assessCompletion, materialsFromProfileData, personMaterials } = stages;

const run = { id: '1', roleName: '前端工程师', language: 'zh-CN', jd: 'jd', hasStaffQuestionnaire: true };
const person = { id: '9', name: '张三', respondentType: 'employee', materials: {} };
const makeGet = map => (stage, personId) => (map[`${stage}|${personId ?? ''}`] === undefined ? null : map[`${stage}|${personId ?? ''}`]);

test('每个阶段都有定义，auto 阶段带 path 与 buildParams', () => {
  ROLE_STAGES.forEach(stage => assert.ok(getDef('role', stage)));
  PERSON_STAGES.forEach(stage => assert.ok(getDef('person', stage)));
  [...ROLE_STAGES.map(s => getDef('role', s)), ...PERSON_STAGES.map(s => getDef('person', s))]
    .filter(def => def.mode === 'auto')
    .forEach(def => {
      // 本地任务（发布 / 写回岗位）不调 Readiness 上游，走自己的任务类型
      assert.ok(['ReadinessPublish', 'ReadinessRoleApply'].includes(def.taskType) || /^\//.test(def.path));
      assert.equal(typeof def.buildParams, 'function');
    });
});

test('draft 请求入参来自 run', () => {
  assert.deepEqual(getDef('role', 'draft').buildParams({ run }), { language: 'zh-CN', jd: 'jd', role_id: '1', job_title: '前端工程师' });
});

test('revise 后是否进入员工问卷取决于 hasStaffQuestionnaire', () => {
  const next = getDef('role', 'revise').next;
  assert.equal(next({ run }), 'staff_questionnaire');
  assert.equal(next({ run: { ...run, hasStaffQuestionnaire: false } }), 'await_persons');
});

test('assess 按达标线分流到复评或 claims', () => {
  const next = getDef('person', 'assess').next;
  assert.equal(next({ output: { profile_completion_pct: 60 }, threshold: 80 }), 'reassess');
  assert.equal(next({ output: { result: { profile_completion_pct: 85 } }, threshold: 80 }), 'claims');
  assert.equal(next({ output: {}, threshold: 80 }), 'claims');
  assert.equal(assessCompletion({ result: { profile_completion_pct: '70' } }), 70);
  assert.equal(assessCompletion(null), null);
});

test('采集档案 profileData 转为 assess materials，供上游算档案完成度', () => {
  assert.equal(materialsFromProfileData(null), null);
  assert.equal(materialsFromProfileData({}), null);
  const materials = materialsFromProfileData({
    name: '张三',
    linkedin: 'https://www.linkedin.com/in/zhang',
    resumeParsed: { educationList: [{ school: 'A' }] },
    resumes: [{ id: 'f1', filename: 'cv.pdf' }],
    projects: [{ name: '项目甲', role: '开发', description: '做了系统' }]
  });
  assert.match(materials.resume, /educationList/);
  assert.match(materials.resume, /张三/);
  assert.match(materials.projects, /项目甲/);
  assert.equal(materials.reviews, 'https://www.linkedin.com/in/zhang');

  const get = makeGet({
    'staff_questionnaire|': { questionnaire: [{ no: 'S01', question: 'q' }], interview: [] },
    'draft|': { tasks: [] },
    'answers|9': { answers: { S01: 'A' }, profileData: { name: '李四', projects: [{ name: 'P1' }] } }
  });
  const params = getDef('person', 'assess').buildParams({ run, person, persons: [person], get });
  assert.match(params.materials.resume, /李四/);
  assert.match(params.materials.projects, /P1/);
  assert.deepEqual(personMaterials({ person: { materials: { resume: '已有简历' } }, get: () => null }), {
    resume: '已有简历',
    projects: '',
    reviews: ''
  });
});

test('依赖产物缺失时 buildParams 明确报错', () => {
  assert.throws(() => getDef('role', 'manager_questionnaire').buildParams({ run, get: makeGet({}) }), /缺少任务清单/);
  assert.throws(() => getDef('person', 'assess').buildParams({ run, person, persons: [person], get: makeGet({ 'draft|': { tasks: [] } }) }), /缺少员工问卷/);
});

test('manager_questionnaire 使用 revise 之后的最新目录', () => {
  const get = makeGet({ 'draft|': { tasks: ['a'] }, 'revise|': { tasks: ['b'] } });
  assert.deepEqual(getDef('role', 'manager_questionnaire').buildParams({ run, get }).catalog.tasks, ['b']);
});

test('Role 退回：退回到 staff_send 及更早会重置所有参与人', () => {
  const early = rollbackPlan({ scope: 'role', stage: 'manager_questionnaire', runStage: 'await_persons' });
  assert.equal(early.resetPersons, true);
  assert.equal(early.roleStageTarget, 'manager_questionnaire');
  assert.deepEqual(early.roleStages.slice(0, 2), ['manager_questionnaire', 'manager_confirm']);
  assert.ok(early.roleStages.includes('role_report'));

  const late = rollbackPlan({ scope: 'role', stage: 'recall', runStage: 'forecast' });
  assert.equal(late.resetPersons, false);
  assert.deepEqual(late.roleStages, ROLE_STAGES.slice(stageIndex('role', 'recall')));
});

test('Person 退回：只作废该人，报告段已开始时 Role 回到 await_persons', () => {
  const before = rollbackPlan({ scope: 'person', stage: 'assess', runStage: 'await_persons' });
  assert.equal(before.roleStageTarget, null);
  assert.deepEqual(before.roleStages, []);
  assert.equal(before.personStages[0], 'assess');

  const after = rollbackPlan({ scope: 'person', stage: 'assess', runStage: 'forecast' });
  assert.equal(after.roleStageTarget, 'await_persons');
  assert.equal(after.roleStages[0], 'recall');
  assert.equal(after.resetPersons, false);
});

test('role_report 之后进入 role_apply，写回参数含岗位与个人报告', () => {
  assert.equal(getDef('role', 'role_report').next(), 'role_apply');
  assert.equal(getDef('role', 'role_apply').taskType, 'ReadinessRoleApply');
  assert.equal(getDef('role', 'role_apply').next(), 'done');
  const get = makeGet({
    'forecast|': { result: { tasks: [{ task_id: 't1', task: '写代码' }] } },
    'role_report|': { result: { headline: '洞察' } },
    [`person_reports|${person.id}`]: { result: { readiness_score: 40 } },
    [`assess|${person.id}`]: { result: { tasks: [] } }
  });
  const params = getDef('role', 'role_apply').buildParams({
    run: { ...run, positionId: '88' },
    persons: [{ ...person, employeeId: 'e1' }],
    get
  });
  assert.equal(params.positionId, '88');
  assert.equal(params.persons.length, 1);
  assert.equal(params.persons[0].employeeId, 'e1');
  assert.ok(params.forecast);
  assert.ok(params.role_report);
});

test('person_reports 的 skills 取技能演进的 task_skills', () => {
  const taskSkills = [{ task_id: 't1', levels: { A1: [{ name: 'x' }] } }];
  const get = makeGet({
    'forecast|': { result: { tasks: [{ task_id: 't1' }] } },
    'skills|': { result: { language: 'zh-CN', task_skills: taskSkills } },
    [`assess|${person.id}`]: { result: { tasks: [] } }
  });
  const params = getDef('role', 'person_reports').buildParams({ run, person, get, persons: [person] });
  assert.deepEqual(params.skills, taskSkills);
});

test('person_reports 在 skills 为空数组时仍回退到 task_skills', () => {
  const taskSkills = [{ task_id: 't1', levels: { A1: [{ name: 'x' }] } }];
  const get = makeGet({
    'forecast|': { result: { tasks: [{ task_id: 't1' }] } },
    'skills|': { result: { language: 'zh-CN', skills: [], task_skills: taskSkills } },
    [`assess|${person.id}`]: { result: { tasks: [] } }
  });
  const params = getDef('role', 'person_reports').buildParams({ run, person, get, persons: [person] });
  assert.deepEqual(params.skills, taskSkills);
});

test('questionnaireOf 读取补充问卷 reassess.rows', () => {
  const rows = [{ no: 'Q01', type: 'single', question: 'q', options: [{ label: 'a', value: 'A' }] }];
  const result = stages.questionnaireOf({ job_id: 'x', result: { reassess: { rows, meta: {} } } });
  assert.deepStrictEqual(result.questionnaire, rows);
  assert.deepStrictEqual(result.interview, []);
  assert.strictEqual(stages.questionnaireOf({ result: { questionnaire: [{ no: 'Q02' }] } }).questionnaire[0].no, 'Q02');
});

test('inviteDeleteBlock：经理邀请在回收答卷阶段之前可删，之后不可删；参与人邀请答卷提交后不可删', () => {
  const manager = { kind: 'manager' };
  assert.equal(stages.inviteDeleteBlock({ invite: manager, run: { stage: 'manager_send' } }), null);
  assert.equal(stages.inviteDeleteBlock({ invite: manager, run: { stage: 'manager_answers' } }), null);
  assert.ok(stages.inviteDeleteBlock({ invite: manager, run: { stage: 'revise' } }));
  assert.ok(stages.inviteDeleteBlock({ invite: manager, run: { stage: 'await_persons' } }));
  const staff = { kind: 'staff', personId: '1' };
  assert.equal(stages.inviteDeleteBlock({ invite: staff, run: { stage: 'await_persons' }, person: { stage: 'answers' } }), null);
  assert.ok(stages.inviteDeleteBlock({ invite: staff, run: { stage: 'await_persons' }, person: { stage: 'assess' } }));
});

test('runProgress：done 为 100，不开员工问卷时员工问卷阶段不计入', () => {
  assert.equal(stages.runProgress({ stage: 'done', hasStaffQuestionnaire: true }), 100);
  assert.equal(stages.runProgress({ stage: 'draft', hasStaffQuestionnaire: true }), 0);
  assert.equal(stages.runProgress({ stage: 'await_persons', hasStaffQuestionnaire: true }), 61);
  assert.equal(stages.runProgress({ stage: 'await_persons', hasStaffQuestionnaire: false }), 50);
});

test('runTodos：列出失败、Role 人工阶段与参与人人工阶段', () => {
  const todos = stages.runTodos({
    run: { stage: 'manager_answers' },
    persons: [
      { id: '1', name: '张三', stage: 'reassess_confirm' },
      { id: '2', name: '李四', stage: 'assess' },
      { id: '3', name: '王五', stage: 'done' }
    ],
    failed: [{ personId: '2', stage: 'assess' }],
    managerInvites: [{ status: 'answered' }, { status: 'sent' }]
  });
  assert.deepEqual(todos, [
    { type: 'failed', scope: 'person', stage: 'assess', personId: '2', personName: '李四' },
    { type: 'manual', scope: 'role', stage: 'manager_answers', action: 'answers', personId: null, answered: 1, total: 2 },
    { type: 'manual', scope: 'person', stage: 'reassess_confirm', action: 'confirm', personId: '1', personName: '张三' }
  ]);
  assert.deepEqual(stages.runTodos({ run: { stage: 'recall' }, failed: [{ personId: null, stage: 'recall' }] }), [{ type: 'failed', scope: 'role', stage: 'recall', personId: null, personName: '' }]);
});
