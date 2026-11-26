/**
 * Readiness 阶段机（纯函数）
 * 依据 API_OVERVIEW：Role 阶段与 Person 阶段；自动阶段只调一个上游 API，人工阶段阻塞等人操作。
 * 各 Role 之间、同一 Role 下各 Person 之间互相独立，阶段只依赖自己的前置数据。
 *
 * buildParams(ctx)：ctx = { run, person, persons, get }
 *   get(stage, personId?) 返回该阶段当前成功版本的 output（原样），没有则 null
 */
const ROLE_STAGES = [
  'draft',
  'manager_questionnaire',
  'manager_confirm',
  'manager_publish',
  'manager_send',
  'manager_answers',
  'revise',
  'staff_questionnaire',
  'staff_confirm',
  'staff_publish',
  'staff_send',
  'await_persons',
  'recall',
  'skills',
  'forecast',
  'person_reports',
  'role_report',
  'role_apply',
  'done'
];

const PERSON_STAGES = ['pending', 'answers', 'assess', 'reassess', 'reassess_confirm', 'reassess_publish', 'reassess_send', 'reassess_answers', 'assess_update', 'claims', 'done'];

/** 问卷类型 → 涉及的阶段 */
const QUESTIONNAIRE_KINDS = {
  manager: { scope: 'role', questionnaireStage: 'manager_questionnaire', confirmStage: 'manager_confirm', publishStage: 'manager_publish', sendStage: 'manager_send', answersStage: 'manager_answers' },
  staff: { scope: 'role', questionnaireStage: 'staff_questionnaire', confirmStage: 'staff_confirm', publishStage: 'staff_publish', sendStage: 'staff_send', answersStage: 'answers' },
  reassess: { scope: 'person', questionnaireStage: 'reassess', confirmStage: 'reassess_confirm', publishStage: 'reassess_publish', sendStage: 'reassess_send', answersStage: 'reassess_answers' }
};

/** 上游返回可能是 {result: {...}} 或直接是结果体 */
const unwrap = output => {
  if (!output || typeof output !== 'object') {
    return {};
  }
  if (output.result && typeof output.result === 'object' && !Array.isArray(output.result)) {
    return output.result;
  }
  return output;
};

const asArray = value => (Array.isArray(value) ? value : []);

const requireOutput = (value, message) => {
  if (value == null) {
    throw new Error(message);
  }
  return value;
};

const catalogOf = ({ run, get }) => {
  const source = get('revise') || get('draft');
  requireOutput(source, '缺少任务清单（draft/revise 尚未完成）');
  return Object.assign({ language: run.language }, unwrap(source));
};

/** 经理/员工问卷在 questionnaire 下；补充问卷（reassess）的题目在 reassess.rows 下 */
const questionnaireOf = output => {
  const data = unwrap(output);
  const questionnaire = asArray(data.questionnaire).length ? data.questionnaire : asArray(data.reassess?.rows);
  return { questionnaire, interview: asArray(data.interview) };
};

/** 问卷中访谈题数量（须通过 AI 面试回收视频作答） */
const expectedInterviewCountOf = output => questionnaireOf(output).interview.length;

/**
 * 答卷采集是否齐套：无访谈题时问卷答完即可；有访谈题时 videoAnswers 数量须 ≥ 期望访谈题数。
 * 只完成问卷、未采到 AI 视频时返回 false。
 */
const answersCollectionReady = ({ expectedVideos = 0, videoAnswers } = {}) => {
  const expected = Number(expectedVideos) || 0;
  if (expected <= 0) {
    return true;
  }
  return asArray(videoAnswers).length >= expected;
};

const answersOf = output => {
  requireOutput(output, '缺少答卷');
  return output.answers ?? {};
};

/**
 * 采集页 profileData → 上游 /person/assess、/person/claims 的 materials（resume/projects/reviews 文本）。
 * 档案完成度由上游根据 materials 计算；此前只落在 answers.profileData，未提交会导致完成度偏低。
 */
const materialsFromProfileData = profileData => {
  if (!profileData || typeof profileData !== 'object' || Array.isArray(profileData)) {
    return null;
  }
  const resumes = asArray(profileData.resumes);
  const projects = asArray(profileData.projects);
  const resumeParsed = profileData.resumeParsed && typeof profileData.resumeParsed === 'object' ? profileData.resumeParsed : null;
  const { projects: _projects, resumes: _resumes, resumeParsed: _parsed, ...review } = profileData;
  const resumeChunks = [];
  if (resumeParsed) {
    resumeChunks.push(JSON.stringify(resumeParsed));
  }
  if (Object.keys(review).length) {
    resumeChunks.push(JSON.stringify(review));
  }
  if (!resumeChunks.length && resumes.length) {
    resumeChunks.push(JSON.stringify({ resumes }));
  }
  const materials = {
    resume: resumeChunks.join('\n\n'),
    projects: projects.length ? JSON.stringify(projects) : '',
    reviews: review.linkedin ? String(review.linkedin) : ''
  };
  if (!materials.resume && !materials.projects && !materials.reviews) {
    return null;
  }
  return materials;
};

/** 参与人 materials：库内已有优先，否则从员工答卷阶段的 profileData 推导 */
const personMaterials = ctx => {
  const base = Object.assign({ resume: '', projects: '', reviews: '' }, ctx.person?.materials || {});
  const fromProfile = materialsFromProfileData(ctx.get?.('answers', ctx.person?.id)?.profileData);
  if (!fromProfile) {
    return base;
  }
  return {
    resume: base.resume || fromProfile.resume || '',
    projects: base.projects || fromProfile.projects || '',
    reviews: base.reviews || fromProfile.reviews || ''
  };
};

const tasksBrief = catalog => asArray(catalog.tasks).map(item => ({ task_id: item.task_id, task: item.task }));

/** 人工跳过补充问卷确认时写入的标记（reassess_confirm 阶段的 output） */
const isSupplementSkipped = output => Boolean(output && output.skipped === true);

const latestAssess = (get, personId) => get('assess_update', personId) || get('assess', personId);

const assessCompletion = output => {
  const data = unwrap(output);
  const value = data.profile_completion_pct ?? data.completion_pct ?? data.profile?.completion_pct;
  const pct = Number(value);
  return value == null || !Number.isFinite(pct) ? null : pct;
};

const personBase = ({ run, person }) => ({ language: run.language, person_id: String(person.id), role_id: String(run.id) });

/** 发布任务类型：不调 Readiness 上游，而是把确认后的问卷写入 AI 面试（建题、转数字人、建项目并开启） */
const PUBLISH_TASK_TYPE = 'ReadinessPublish';

/** 写回岗位：把 forecast / role_report（及个人报告）落到 position 与档案就绪度 */
const APPLY_TASK_TYPE = 'ReadinessRoleApply';

/** 确认后发布：题目取当前问卷版本，截止日期取确认时填写的值 */
const publishParams = kind => ctx => {
  const info = QUESTIONNAIRE_KINDS[kind];
  const personId = info.scope === 'person' ? ctx.person.id : undefined;
  const { questionnaire, interview } = questionnaireOf(requireOutput(ctx.get(info.questionnaireStage, personId), '缺少问卷'));
  const confirm = requireOutput(ctx.get(info.confirmStage, personId), '缺少问卷确认信息');
  requireOutput(confirm.deadline, '确认信息缺少问卷截止日期');
  requireOutput(confirm.digitalId, '确认信息缺少数字人，请回退到“确认问卷”重新确认并选择数字人');
  return { kind, roleName: ctx.run.roleName, language: ctx.run.language, deadline: confirm.deadline, digitalId: String(confirm.digitalId), questionnaireVersion: confirm.questionnaireVersion ?? null, questionnaire, interview };
};

const roleDefs = {
  draft: {
    mode: 'auto',
    path: '/role/draft',
    buildParams: ({ run }) => ({ language: run.language, jd: run.jd, role_id: String(run.id), job_title: run.roleName }),
    next: () => 'manager_questionnaire'
  },
  manager_questionnaire: {
    mode: 'auto',
    path: '/role/question/manager',
    buildParams: ctx => ({ language: ctx.run.language, catalog: catalogOf(ctx) }),
    next: () => 'manager_confirm'
  },
  manager_confirm: { mode: 'manual', action: 'confirm', next: () => 'manager_publish' },
  manager_publish: { mode: 'auto', taskType: PUBLISH_TASK_TYPE, buildParams: publishParams('manager'), next: () => 'manager_send' },
  manager_send: { mode: 'manual', action: 'send', next: () => 'manager_answers' },
  manager_answers: { mode: 'manual', action: 'answers', next: () => 'revise' },
  revise: {
    mode: 'auto',
    path: '/role/revise',
    buildParams: ctx => {
      const { questionnaire, interview } = questionnaireOf(requireOutput(ctx.get('manager_questionnaire'), '缺少经理问卷'));
      return {
        language: ctx.run.language,
        catalog: Object.assign({ language: ctx.run.language }, unwrap(requireOutput(ctx.get('draft'), '缺少 draft 结果'))),
        questionnaire,
        interview,
        answers: answersOf(ctx.get('manager_answers'))
      };
    },
    next: ({ run }) => (run.hasStaffQuestionnaire ? 'staff_questionnaire' : 'await_persons')
  },
  staff_questionnaire: {
    mode: 'auto',
    path: '/role/question/staff',
    buildParams: ctx => ({ language: ctx.run.language, catalog: catalogOf(ctx) }),
    next: () => 'staff_confirm'
  },
  staff_confirm: { mode: 'manual', action: 'confirm', next: () => 'staff_publish' },
  staff_publish: { mode: 'auto', taskType: PUBLISH_TASK_TYPE, buildParams: publishParams('staff'), next: () => 'staff_send' },
  staff_send: { mode: 'manual', action: 'send', next: () => 'await_persons' },
  await_persons: { mode: 'manual', action: 'trigger', next: () => 'recall' },
  recall: {
    mode: 'auto',
    path: '/role/recall',
    buildParams: ctx => ({ language: ctx.run.language, tasks: tasksBrief(catalogOf(ctx)), role_name: ctx.run.roleName }),
    next: () => 'skills'
  },
  skills: {
    mode: 'auto',
    path: '/role/skills',
    buildParams: ctx => ({
      language: ctx.run.language,
      catalog: catalogOf(ctx),
      internal: ctx.persons.flatMap(person => asArray(unwrap(ctx.get('claims', person.id)).internal)),
      external: asArray(unwrap(requireOutput(ctx.get('recall'), '缺少外部证据（recall 尚未完成）')).external)
    }),
    next: () => 'forecast'
  },
  forecast: {
    mode: 'auto',
    path: '/role/forecast',
    buildParams: ctx => ({
      language: ctx.run.language,
      tasks: asArray(catalogOf(ctx).tasks),
      role_name: ctx.run.roleName,
      role_id: String(ctx.run.id),
      internal: ctx.persons.flatMap(person => asArray(unwrap(ctx.get('claims', person.id)).internal)),
      external: asArray(unwrap(requireOutput(ctx.get('recall'), '缺少外部证据（recall 尚未完成）')).external)
    }),
    next: () => 'person_reports'
  },
  // 每个 Person 一次 /person/report，Role 阶段在全部完成后进入 role_report
  person_reports: {
    mode: 'auto',
    fanOut: true,
    path: '/person/report',
    buildParams: ctx => {
      const forecast = unwrap(requireOutput(ctx.get('forecast'), '缺少岗位预测（forecast 尚未完成）'));
      const skills = unwrap(requireOutput(ctx.get('skills'), '缺少技能演进（skills 尚未完成）'));
      return Object.assign(personBase(ctx), {
        tasks: asArray(forecast.tasks),
        assess: unwrap(requireOutput(latestAssess(ctx.get, ctx.person.id), '缺少个人评估')),
        // 技能演进产出字段是 task_skills；skills/tasks 仅作兼容兜底（空数组不算有值）
        skills: asArray([skills.task_skills, skills.skills, skills.tasks].find(item => asArray(item).length)),
        role_name: ctx.run.roleName
      });
    },
    next: () => 'role_report'
  },
  role_report: {
    mode: 'auto',
    path: '/role/report',
    buildParams: ctx => {
      const forecast = unwrap(requireOutput(ctx.get('forecast'), '缺少岗位预测（forecast 尚未完成）'));
      return {
        language: ctx.run.language,
        tasks: asArray(forecast.tasks),
        role_name: ctx.run.roleName,
        role_id: String(ctx.run.id),
        assess: ctx.persons
          .map(person => latestAssess(ctx.get, person.id))
          .filter(Boolean)
          .map(unwrap)
      };
    },
    next: () => 'role_apply'
  },
  // 本地写回：岗位任务 / outlook / 策略，以及参与人 skillAnalysis
  role_apply: {
    mode: 'auto',
    taskType: APPLY_TASK_TYPE,
    buildParams: ctx => {
      const forecast = requireOutput(ctx.get('forecast'), '缺少岗位预测（forecast 尚未完成）');
      const roleReport = requireOutput(ctx.get('role_report'), '缺少岗位报告（role_report 尚未完成）');
      return {
        positionId: ctx.run.positionId ? String(ctx.run.positionId) : null,
        forecast,
        role_report: roleReport,
        persons: ctx.persons
          .filter(person => person.employeeId)
          .map(person => ({
            personId: String(person.id),
            employeeId: String(person.employeeId),
            name: person.name || '',
            report: ctx.get('person_reports', person.id),
            assess: latestAssess(ctx.get, person.id)
          }))
      };
    },
    next: () => 'done'
  },
  done: { mode: 'end' }
};

const personDefs = {
  pending: { mode: 'wait' },
  answers: { mode: 'manual', action: 'answers', next: () => 'assess' },
  assess: {
    mode: 'auto',
    path: '/person/assess',
    buildParams: ctx => {
      const { questionnaire, interview } = questionnaireOf(requireOutput(ctx.get('staff_questionnaire'), '缺少员工问卷'));
      return Object.assign(personBase(ctx), {
        catalog: catalogOf(ctx),
        respondent_type: ctx.person.respondentType || 'employee',
        materials: personMaterials(ctx),
        questionnaire,
        interview,
        answers: answersOf(ctx.get('answers', ctx.person.id))
      });
    },
    next: ({ output, threshold }) => {
      const pct = assessCompletion(output);
      return pct !== null && pct < threshold ? 'reassess' : 'claims';
    }
  },
  reassess: {
    mode: 'auto',
    path: '/person/question/reassess',
    buildParams: ctx => {
      const { questionnaire, interview } = questionnaireOf(requireOutput(ctx.get('staff_questionnaire'), '缺少员工问卷'));
      return Object.assign(personBase(ctx), {
        catalog: catalogOf(ctx),
        assess: unwrap(requireOutput(ctx.get('assess', ctx.person.id), '缺少第一次评估')),
        questionnaire,
        interview,
        answers: answersOf(ctx.get('answers', ctx.person.id))
      });
    },
    next: () => 'reassess_confirm'
  },
  reassess_confirm: { mode: 'manual', action: 'confirm', next: () => 'reassess_publish' },
  reassess_publish: { mode: 'auto', taskType: PUBLISH_TASK_TYPE, buildParams: publishParams('reassess'), next: () => 'reassess_send' },
  reassess_send: { mode: 'manual', action: 'send', next: () => 'reassess_answers' },
  reassess_answers: { mode: 'manual', action: 'answers', next: () => 'assess_update' },
  assess_update: {
    mode: 'auto',
    path: '/person/assess/update',
    buildParams: ctx => {
      const base = Object.assign(personBase(ctx), {
        catalog: catalogOf(ctx),
        assess: unwrap(requireOutput(ctx.get('assess', ctx.person.id), '缺少第一次评估'))
      });
      // 人工跳过补充问卷：不带补卷题目与答卷
      if (isSupplementSkipped(ctx.get('reassess_confirm', ctx.person.id))) {
        return Object.assign(base, { questionnaire: [], answers: {} });
      }
      const reassessQ = questionnaireOf(requireOutput(ctx.get('reassess', ctx.person.id), '缺少补问卷'));
      return Object.assign(base, {
        questionnaire: reassessQ.questionnaire,
        answers: answersOf(ctx.get('reassess_answers', ctx.person.id))
      });
    },
    // 质量达标规则文档未给出：v1 按更新成功即进入 claims
    next: () => 'claims'
  },
  claims: {
    mode: 'auto',
    path: '/person/claims',
    buildParams: ctx => {
      const { questionnaire, interview } = questionnaireOf(requireOutput(ctx.get('staff_questionnaire'), '缺少员工问卷'));
      return Object.assign(personBase(ctx), {
        catalog: catalogOf(ctx),
        respondent_type: ctx.person.respondentType || 'employee',
        questionnaire,
        interview,
        answers: answersOf(ctx.get('answers', ctx.person.id)),
        materials: personMaterials(ctx)
      });
    },
    next: () => 'done'
  },
  done: { mode: 'end' }
};

const getDef = (scope, stage) => {
  const def = (scope === 'person' ? personDefs : roleDefs)[stage];
  if (!def) {
    throw new Error(`未知阶段：${scope}/${stage}`);
  }
  return def;
};

const stageIndex = (scope, stage) => (scope === 'person' ? PERSON_STAGES : ROLE_STAGES).indexOf(stage);

/** 邀请的所属阶段已过、不能再删除的原因；可删返回 null。经理邀请看 Role 阶段，参与人邀请看参与人阶段 */
const INVITE_PERSON_DELETABLE_STAGES = ['pending', 'answers'];
const inviteDeleteBlock = ({ invite, run, person }) => {
  if (person) {
    return INVITE_PERSON_DELETABLE_STAGES.includes(person.stage) ? null : '该参与人已提交答卷，不能删除';
  }
  const info = QUESTIONNAIRE_KINDS[invite.kind];
  if (info && info.scope === 'role' && run && stageIndex('role', run.stage) > stageIndex('role', info.answersStage)) {
    return '该问卷对应的阶段已完成，不能删除';
  }
  return null;
};

/**
 * 退回计划：返回被作废的阶段集合，以及对其它对象的影响。
 * Role 退回：自身及其后阶段作废；退回到 staff_send 及更早，所有 Person 与其问卷邀请一并重置（题目变了，旧答卷无效）。
 * Person 退回：该人自身该阶段及其后作废；若 Role 已进入报告段，报告段整体作废并回到 await_persons。
 */
const rollbackPlan = ({ scope, stage, runStage }) => {
  if (scope === 'person') {
    const index = stageIndex('person', stage);
    const reportsStarted = stageIndex('role', runStage) > stageIndex('role', 'await_persons');
    return {
      personStages: PERSON_STAGES.slice(index),
      roleStages: reportsStarted ? ROLE_STAGES.slice(stageIndex('role', 'recall')) : [],
      roleStageTarget: reportsStarted ? 'await_persons' : null,
      resetPersons: false
    };
  }
  const index = stageIndex('role', stage);
  return {
    personStages: [],
    roleStages: ROLE_STAGES.slice(index),
    roleStageTarget: stage,
    resetPersons: index <= stageIndex('role', 'staff_send')
  };
};

/** 不开员工问卷时，员工问卷相关阶段不计入进度 */
const STAFF_ROLE_STAGES = ['staff_questionnaire', 'staff_confirm', 'staff_publish', 'staff_send'];

/** 列表进度：Role 阶段推进到第几步（done 为 100） */
const runProgress = run => {
  if (run.stage === 'done') {
    return 100;
  }
  const steps = ROLE_STAGES.filter(stage => stage !== 'done' && (run.hasStaffQuestionnaire || !STAFF_ROLE_STAGES.includes(stage)));
  const index = steps.indexOf(run.stage);
  return index < 0 ? 0 : Math.round((index / steps.length) * 100);
};

/** draft 阶段错误文案是否为岗位输入 423（同步/回调落库后均可识别） */
const isDraft423Error = text => /\bcode\s*423\b/i.test(String(text || '')) || /\bHTTP\s*423\b/i.test(String(text || ''));

/**
 * 列表待办：失败阶段、Role 当前人工阶段、处在人工阶段的参与人。
 * 返回 [{ type: 'failed'|'manual', scope, stage, action?, personId?, personName?, answered?, total? }]
 * draft 423 / 已取消：不返回待办（与取消一致，不可重试）
 */
const runTodos = ({ run, persons = [], failed = [], managerInvites = [], inputError = false } = {}) => {
  if (run.status === 'canceled' || inputError) {
    return [];
  }
  const nameOf = personId => persons.find(person => String(person.id) === String(personId))?.name || '';
  const todos = failed.map(item => ({
    type: 'failed',
    scope: item.personId ? 'person' : 'role',
    stage: item.stage,
    personId: item.personId ? String(item.personId) : null,
    personName: item.personId ? nameOf(item.personId) : ''
  }));
  if (run.stage !== 'done' && !failed.some(item => !item.personId)) {
    const def = getDef('role', run.stage);
    if (def.mode === 'manual') {
      const todo = { type: 'manual', scope: 'role', stage: run.stage, action: def.action || null, personId: null };
      if (run.stage === 'manager_answers' && managerInvites.length) {
        Object.assign(todo, { answered: managerInvites.filter(item => item.status === 'answered').length, total: managerInvites.length });
      }
      todos.push(todo);
    }
  }
  persons.forEach(person => {
    if (person.stage === 'done' || failed.some(item => String(item.personId) === String(person.id))) {
      return;
    }
    const def = getDef('person', person.stage);
    if (def.mode === 'manual') {
      todos.push({ type: 'manual', scope: 'person', stage: person.stage, action: def.action || null, personId: String(person.id), personName: person.name || '' });
    }
  });
  return todos;
};

module.exports = {
  PUBLISH_TASK_TYPE,
  APPLY_TASK_TYPE,
  ROLE_STAGES,
  PERSON_STAGES,
  QUESTIONNAIRE_KINDS,
  unwrap,
  questionnaireOf,
  expectedInterviewCountOf,
  answersCollectionReady,
  assessCompletion,
  materialsFromProfileData,
  personMaterials,
  getDef,
  stageIndex,
  inviteDeleteBlock,
  rollbackPlan,
  runProgress,
  runTodos,
  isDraft423Error
};
