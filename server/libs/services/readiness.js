const fp = require('fastify-plugin');
const {
  ROLE_STAGES,
  PERSON_STAGES,
  QUESTIONNAIRE_KINDS,
  assessCompletion,
  materialsFromProfileData,
  getDef,
  stageIndex,
  rollbackPlan,
  questionnaireOf,
  inviteDeleteBlock,
  runProgress,
  runTodos,
  isDraft423Error
} = require('../utils/readiness-stages');
const { summarizeStageOutput } = require('../utils/readiness-summary');
const { normalizeDeadline, digitalsOf } = require('../utils/readiness-publish');
const { buildPersonAnalysis, buildRolePreview, buildPositionOutlook } = require('../utils/readiness-report-map');

const TASK_TYPE = 'Readiness';

const pickContact = value => {
  if (value == null || value === '') {
    return '';
  }
  if (typeof value === 'object') {
    const number = value.number ?? value.phone ?? value.value;
    return number != null ? String(number).trim() : '';
  }
  return String(value).trim();
};

const ALREADY_CONFIRMED_MESSAGE = '问卷已被确认';

const errorText = error => String(error?.message || error?.msg || (typeof error === 'string' ? error : JSON.stringify(error)) || '未知错误');

/** 任务日志里是否出现过 code/HTTP 423（同步受理或异步回调；兼容 options.logs / logs） */
const has423InTaskLogs = task => {
  const logs = [...(Array.isArray(task?.options?.logs) ? task.options.logs : []), ...(Array.isArray(task?.logs) ? task.logs : [])];
  return logs.some(item => {
    const data = item?.data;
    return data && typeof data === 'object' && (Number(data.code) === 423 || Number(data.status) === 423);
  });
};

/** /role/draft 返回 423：岗位输入信息有误（同步抛错、回调 message、任务日志均可识别） */
const isDraftInputError = (error, text, task) => Number(error?.code) === 423 || Number(error) === 423 || /\bcode\s*423\b/i.test(text) || /\bHTTP\s*423\b/i.test(text) || has423InTaskLogs(task);

module.exports = fp(async (fastify, options) => {
  const { models } = fastify[options.name];
  const { Op } = fastify.sequelize.Sequelize;
  const threshold = () => Number(fastify.config.READINESS_COMPLETION_THRESHOLD) || 80;
  const idOrNull = value => (value == null || value === '' ? null : String(value));

  const findRun = async ({ tenantId, id }) => {
    const run = await models.readinessRun.findOne({ where: { id: String(id), tenantId } });
    if (!run) {
      throw new Error('流程不存在');
    }
    return run;
  };

  const findPerson = async ({ run, personId }) => {
    const person = await models.readinessRunPerson.findOne({ where: { id: String(personId), runId: String(run.id), tenantId: run.tenantId } });
    if (!person) {
      throw new Error('参与人不存在');
    }
    return person;
  };

  const loadPersons = run => models.readinessRunPerson.findAll({ where: { runId: String(run.id), tenantId: run.tenantId }, order: [['id', 'ASC']] });

  /** 当前成功版本的 output 映射，用于组装下一步请求 */
  const loadContext = async run => {
    const [persons, rows] = await Promise.all([loadPersons(run), models.readinessStageData.findAll({ where: { runId: String(run.id), isCurrent: true, status: 'succeeded' } })]);
    const map = new Map();
    rows.forEach(row => map.set(`${row.stage}|${row.personId ?? ''}`, row.output));
    const get = (stage, personId) => {
      const value = map.get(`${stage}|${personId == null ? '' : personId}`);
      return value === undefined ? null : value;
    };
    return { persons, get };
  };

  /** 使某 run+person+stage 的当前版本失效；运行中的任务一并取消 */
  const supersede = async ({ runId, personId, stages, allPersons = false }) => {
    const where = { runId: String(runId), stage: { [Op.in]: stages }, isCurrent: true };
    if (!allPersons) {
      where.personId = idOrNull(personId);
    }
    const rows = await models.readinessStageData.findAll({ where });
    for (const row of rows) {
      if (row.status === 'running' && row.taskId) {
        try {
          await fastify.task.services.cancel({ id: row.taskId });
        } catch (e) {
          fastify.log.warn(`readiness cancel task ${row.taskId} failed: ${e.message}`);
        }
      }
      await row.update({ isCurrent: false, status: row.status === 'running' ? 'superseded' : row.status });
    }
  };

  const createStageData = async ({ run, personId, stage, source, input, output, status, taskId, error, operatorId }) => {
    const last = await models.readinessStageData.max('version', { where: { runId: String(run.id), stage, personId: idOrNull(personId) } });
    return models.readinessStageData.create({
      tenantId: run.tenantId,
      runId: String(run.id),
      personId: idOrNull(personId),
      stage,
      version: (Number(last) || 0) + 1,
      isCurrent: true,
      status,
      source,
      input: input || {},
      output: output === undefined ? null : output,
      taskId,
      error,
      operatorId: idOrNull(operatorId)
    });
  };

  const createManualData = async ({ run, personId, stage, output, operatorId }) => {
    await supersede({ runId: run.id, personId, stages: [stage] });
    return createStageData({ run, personId, stage, source: 'manual', output, status: 'succeeded', operatorId });
  };

  /** 派生状态：有失败 → failed；有运行中 → running；Role 到 done → done；否则等人操作 → blocked */
  const refreshStatus = async runInput => {
    const run = await models.readinessRun.findByPk(runInput.id);
    // 已取消（含 draft 423 按取消收尾）不再被阶段状态改写
    if (!run || run.status === 'canceled') {
      return;
    }
    const [rows, persons] = await Promise.all([
      models.readinessStageData.findAll({ where: { runId: String(run.id), isCurrent: true, status: { [Op.in]: ['running', 'failed'] } }, attributes: ['status', 'personId', 'stage'] }),
      loadPersons(run)
    ]);
    const runStatus = rows.some(row => row.status === 'failed') ? 'failed' : rows.some(row => row.status === 'running') ? 'running' : run.stage === 'done' ? 'done' : 'blocked';
    await run.update({ status: runStatus });
    for (const person of persons) {
      // 只看参与人自己的阶段；个人报告（person_reports）是 Role 阶段按人展开执行，它失败不代表这个人的流程失败
      const own = rows.filter(row => row.personId && String(row.personId) === String(person.id) && PERSON_STAGES.includes(row.stage));
      const status = own.some(row => row.status === 'failed') ? 'failed' : own.some(row => row.status === 'running') ? 'running' : person.stage === 'done' ? 'done' : person.stage === 'pending' ? 'pending' : 'blocked';
      if (status !== person.status) {
        await person.update({ status });
      }
    }
    return run;
  };

  const kick = task => {
    fastify.task.services
      .claimTask(task)
      .then(claimed => (claimed ? fastify.task.services.processSystemTask(claimed, { claimed: true }) : null))
      .catch(e => fastify.log.error(`readiness task ${task.id} run failed: ${e.message}`));
  };

  /** 创建一次 Readiness 任务并记录阶段数据（running）；组装请求失败则直接记录 failed 版本 */
  const startTask = async ({ run, person, stage, def }) => {
    const personId = person ? String(person.id) : null;
    const ctx = await loadContext(run);
    let params;
    try {
      params = def.buildParams({ run, person, persons: ctx.persons, get: ctx.get });
    } catch (e) {
      await supersede({ runId: run.id, personId, stages: [stage] });
      await createStageData({ run, personId, stage, source: 'api', input: { path: def.path }, status: 'failed', error: errorText(e) });
      return;
    }
    await supersede({ runId: run.id, personId, stages: [stage] });
    const data = await createStageData({ run, personId, stage, source: 'api', input: { path: def.path, params }, status: 'running' });
    const task = await fastify.task.services.create({
      type: def.taskType || TASK_TYPE,
      targetId: String(data.id),
      targetType: 'readiness-stage',
      runnerType: 'system',
      input: {
        name: `Readiness ${stage}：${run.roleName}${person ? ` / ${person.name}` : ''}`,
        path: def.path,
        params,
        tenantId: String(run.tenantId),
        runId: String(run.id),
        stageDataId: String(data.id),
        personId,
        stage
      }
    });
    await data.update({ taskId: String(task.id) });
    kick(task);
  };

  const enterPerson = async (runInput, personInput, stage) => {
    const run = await models.readinessRun.findByPk(runInput.id);
    const person = await models.readinessRunPerson.findByPk(personInput.id);
    const def = getDef('person', stage);
    await person.update({ stage });
    if (def.mode === 'auto') {
      await startTask({ run, person, stage, def });
    }
    await refreshStatus(run);
  };

  const enterRole = async (runInput, stage) => {
    const run = await models.readinessRun.findByPk(runInput.id);
    const def = getDef('role', stage);
    await run.update({ stage });
    if (def.mode === 'auto') {
      if (def.fanOut) {
        const targets = (await loadPersons(run)).filter(person => person.stage === 'done');
        if (!targets.length) {
          await enterRole(run, def.next({ run }));
          return;
        }
        for (const person of targets) {
          await startTask({ run, person, stage, def });
        }
      } else {
        await startTask({ run, stage, def });
      }
    }
    await refreshStatus(run);
  };

  // ---------- Readiness 任务回调 ----------

  const onTaskSuccess = async ({ task, result }) => {
    const data = task.input?.stageDataId ? await models.readinessStageData.findByPk(task.input.stageDataId) : null;
    if (!data || !data.isCurrent || data.status !== 'running') {
      fastify.log.info(`readiness task ${task.id} 的阶段数据已失效，忽略回调`);
      return;
    }
    await data.update({ status: 'succeeded', output: result == null ? {} : result });
    const run = await models.readinessRun.findByPk(data.runId);
    if (!run) {
      return;
    }
    const output = result == null ? {} : result;

    if (data.stage === 'person_reports') {
      const def = getDef('role', 'person_reports');
      if (run.stage !== 'person_reports') {
        return;
      }
      const targets = (await loadPersons(run)).filter(person => person.stage === 'done');
      const done = await models.readinessStageData.count({ where: { runId: String(run.id), stage: 'person_reports', isCurrent: true, status: 'succeeded', personId: { [Op.in]: targets.map(item => String(item.id)) } } });
      if (done >= targets.length) {
        const [moved] = await models.readinessRun.update({ stage: 'role_report' }, { where: { id: run.id, stage: 'person_reports' } });
        if (moved === 1) {
          await enterRole(run, def.next());
          return;
        }
      }
      await refreshStatus(run);
      return;
    }

    if (data.personId) {
      const person = await models.readinessRunPerson.findByPk(data.personId);
      if (!person || person.stage !== data.stage) {
        return;
      }
      if (['assess', 'assess_update'].includes(data.stage)) {
        const pct = assessCompletion(output);
        if (pct !== null) {
          await person.update({ profileCompletionPct: Math.round(pct) });
        }
      }
      const def = getDef('person', data.stage);
      await enterPerson(run, person, def.next({ output, threshold: threshold() }));
      return;
    }

    if (run.stage !== data.stage) {
      return;
    }
    const def = getDef('role', data.stage);
    await enterRole(run, def.next({ run, output }));
  };

  const onTaskFailed = async ({ task, error }) => {
    const data = task.input?.stageDataId ? await models.readinessStageData.findByPk(task.input.stageDataId) : null;
    if (!data || !data.isCurrent || data.status !== 'running') {
      return;
    }
    const message = errorText(error);
    await data.update({ status: 'failed', error: message });
    const run = await models.readinessRun.findByPk(data.runId);
    if (!run) {
      return;
    }
    // 回调失败时 error 往往只有 message，再读一次任务日志识别 code 423
    let taskForCheck = task;
    if (task?.id && fastify.task?.models?.task) {
      try {
        taskForCheck = (await fastify.task.models.task.findByPk(task.id)) || task;
      } catch (e) {
        taskForCheck = task;
      }
    }
    // draft + 423：与取消类似 — 流程 canceled（列表无待办、不可操作），岗位评估为失败
    if (data.stage === 'draft' && !data.personId && isDraftInputError(error, message, taskForCheck)) {
      if (!isDraft423Error(message)) {
        await data.update({ error: `Readiness 返回 code 423：${message}` });
      }
      await run.update({ status: 'canceled' });
      if (run.positionId) {
        await models.position.update({ assessmentStatus: 'error' }, { where: { id: String(run.positionId), tenantId: run.tenantId } });
      }
      return;
    }
    await refreshStatus(run);
  };

  // 任务管理页取消任务：框架通过 cancelHandler 回调，阶段记为失败（可重试 / 退回）
  const onTaskCanceled = ({ task }) => onTaskFailed({ task, error: '任务已在任务管理中取消' });

  // ---------- 创建 / 查询 ----------

  /**
   * 创建时选的租户成员：补全姓名、邮箱与关联员工 ID。
   * 成员不存在、无邮箱的进入 unresolved，由调用方决定是否报错。
   */
  const resolveCreateMembers = async (tenantId, recipients = []) => {
    const list = Array.isArray(recipients) ? recipients : [];
    const ids = [...new Set(list.filter(item => item?.tenantUserId).map(item => String(item.tenantUserId)))];
    if (!ids.length) {
      return { resolved: list.filter(item => item?.email), unresolved: [] };
    }
    const users = await fastify.tenant.models.user.findAll({ where: { id: { [Op.in]: ids }, tenantId }, attributes: ['id', 'name', 'email'] });
    const employees = await models.employee.findAll({ where: { tenantUserId: { [Op.in]: ids }, tenantId }, attributes: ['id', 'tenantUserId', 'email', 'name', 'nameEn'] });
    const userMap = new Map(users.map(user => [String(user.id), user]));
    const employeeMap = new Map(employees.map(item => [String(item.tenantUserId), item]));
    const unresolved = [];
    const resolved = list.flatMap(item => {
      if (!item?.tenantUserId) {
        const email = String(item?.email || '').trim();
        return email ? [{ name: item.name || '', email, employeeId: item.employeeId || null, tenantUserId: null }] : [];
      }
      const key = String(item.tenantUserId);
      const user = userMap.get(key);
      const employee = employeeMap.get(key);
      const memberName = user?.name || employee?.name || employee?.nameEn || item.name || '';
      const email = String(user?.email || pickContact(employee?.email) || '').trim();
      if (!user) {
        unresolved.push({ name: memberName, reason: '成员不存在' });
        return [];
      }
      if (!email) {
        unresolved.push({ name: memberName, reason: '未填写邮箱' });
        return [];
      }
      return [{ name: memberName, email, employeeId: employee ? String(employee.id) : null, tenantUserId: key }];
    });
    return { resolved, unresolved };
  };

  const findOngoingRun = async ({ tenantId, positionId, roleName }) => {
    const where = { tenantId, status: { [Op.notIn]: ['done', 'canceled'] } };
    if (positionId) {
      where.positionId = String(positionId);
    } else if (roleName) {
      where.roleName = String(roleName).trim();
      where.positionId = null;
    } else {
      return null;
    }
    return models.readinessRun.findOne({ where, order: [['createdAt', 'DESC']], attributes: ['id', 'roleName', 'status', 'stage'] });
  };

  /** 取消单个就绪度流程：停任务、作废阶段与邀请，标记 canceled；关联岗位评估状态回到待启动 */
  const cancelRunEntity = async run => {
    if (!run || run.status === 'canceled') {
      return run;
    }
    if (run.status === 'done') {
      throw new Error('已完成的流程不能取消');
    }
    const tenantId = String(run.tenantId);
    const rows = await models.readinessStageData.findAll({
      where: { runId: String(run.id), isCurrent: true }
    });
    for (const row of rows) {
      if (row.status === 'running' && row.taskId) {
        try {
          await fastify.task.services.cancel({ id: row.taskId });
        } catch (e) {
          fastify.log.warn(`readiness cancel task ${row.taskId} failed: ${e.message}`);
        }
      }
      if (row.isCurrent) {
        await row.update({ isCurrent: false, status: row.status === 'running' ? 'superseded' : row.status });
      }
    }
    if (models.readinessInvite) {
      const invites = await models.readinessInvite.findAll({
        where: { runId: String(run.id), tenantId, isCurrent: true },
        attributes: ['id', 'collectInviteId']
      });
      const { services } = fastify[options.name];
      for (const invite of invites) {
        if (!invite.collectInviteId || !services.talentCollectInvite?.cancel) {
          continue;
        }
        try {
          await services.talentCollectInvite.cancel({ tenantId }, { id: String(invite.collectInviteId) });
        } catch (e) {
          fastify.log.warn(`cancel collect invite ${invite.collectInviteId} failed: ${e.message}`);
        }
      }
      await models.readinessInvite.update({ isCurrent: false }, { where: { runId: String(run.id), tenantId, isCurrent: true } });
    }
    await run.update({ status: 'canceled' });
    if (run.positionId) {
      const position = await models.position.findOne({ where: { id: String(run.positionId), tenantId } });
      if (position && ['interviews_in_progress', 'error'].includes(position.assessmentStatus)) {
        await position.update({ assessmentStatus: 'pending' });
      }
    }
    return run;
  };

  /**
   * 租户取消岗位就绪度分析（访谈进行中 / 评估错误）：
   * 取消进行中任务、作废当前阶段与邀请，流程标记 canceled，岗位回到待启动。
   */
  const cancelByPosition = async ({ tenantId }, { positionId }) => {
    if (!positionId) {
      throw new Error('岗位ID不能为空');
    }
    const position = await models.position.findOne({ where: { id: String(positionId), tenantId } });
    if (!position) {
      throw new Error('岗位不存在');
    }
    if (!['interviews_in_progress', 'error'].includes(position.assessmentStatus)) {
      throw new Error('仅「访谈进行中」或「失败」的岗位可取消分析');
    }

    const run = await findOngoingRun({ tenantId, positionId: String(positionId) });
    if (run) {
      const fullRun = await models.readinessRun.findByPk(run.id);
      await cancelRunEntity(fullRun);
    } else if (position.assessmentStatus !== 'pending') {
      await position.update({ assessmentStatus: 'pending' });
    }
    return { positionId: String(position.id), runId: run ? String(run.id) : null };
  };

  /** Admin / 详情页：按流程 ID 取消（非已完成） */
  const cancel = async ({ tenantId }, { id }) => {
    const run = await findRun({ tenantId, id });
    await cancelRunEntity(run);
    return { id: String(run.id), status: 'canceled' };
  };

  const createRun = async ({ tenantId, userId }, { positionId, language, jd, roleName, hasStaffQuestionnaire = true, employeeIds = [], managers = [], employees = [] } = {}) => {
    let position = null;
    if (positionId) {
      position = await models.position.findOne({ where: { id: String(positionId), tenantId } });
      if (!position) {
        throw new Error('岗位不存在');
      }
    }
    const name = String(roleName || position?.name || '').trim();
    const jdText = String(jd || [position?.description, position?.requirement].filter(Boolean).join('\n\n')).trim();
    if (!name) {
      throw new Error('岗位名称不能为空');
    }
    if (!jdText) {
      throw new Error('岗位描述为空，无法生成流程');
    }

    const ongoing = await findOngoingRun({ tenantId, positionId: idOrNull(positionId), roleName: positionId ? null : name });
    if (ongoing) {
      // 评估失败（如 draft 423）后「岗位重建」：先取消失败中的流程再新建
      if (position && position.assessmentStatus === 'error') {
        const fullRun = await models.readinessRun.findByPk(ongoing.id);
        if (fullRun) {
          await cancelRunEntity(fullRun);
        }
      } else {
        throw new Error(`该岗位已有正在进行的就绪度评估（${ongoing.roleName}，状态：${ongoing.status}），请完成后再新建`);
      }
    }

    if ((managers || []).length > 1) {
      throw new Error('经理问卷最多只能选择一位经理');
    }
    const managerResult = await resolveCreateMembers(tenantId, managers);
    if (managerResult.unresolved.length) {
      throw new Error(`经理无法添加：${managerResult.unresolved.map(item => `${item.name || '未知'}（${item.reason}）`).join('；')}`);
    }
    if (managerResult.resolved.length > 1) {
      throw new Error('经理问卷最多只能选择一位经理');
    }

    // 兼容旧入参 employeeIds；优先使用 TenantUserSelect 的 employees
    let personSeeds = [];
    if (hasStaffQuestionnaire) {
      if (employees.length) {
        const employeeResult = await resolveCreateMembers(tenantId, employees);
        if (employeeResult.unresolved.length) {
          throw new Error(`员工无法添加：${employeeResult.unresolved.map(item => `${item.name || '未知'}（${item.reason}）`).join('；')}`);
        }
        personSeeds = employeeResult.resolved;
      } else if (employeeIds.length) {
        const rows = await models.employee.findAll({ where: { id: { [Op.in]: employeeIds.map(String) }, tenantId } });
        personSeeds = rows.map(employee => ({
          name: employee.name || employee.nameEn || '',
          email: pickContact(employee.email),
          employeeId: String(employee.id),
          tenantUserId: employee.tenantUserId ? String(employee.tenantUserId) : null
        }));
      }
    }

    const resolvedLanguage = language === 'en-US' || language === 'zh-CN' ? language : position?.language || 'zh-CN';
    const run = await models.readinessRun.create({
      tenantId,
      positionId: idOrNull(positionId),
      roleName: name,
      language: resolvedLanguage,
      jd: jdText,
      hasStaffQuestionnaire: !!hasStaffQuestionnaire,
      managerRecipients: managerResult.resolved,
      stage: 'draft',
      status: 'running',
      createdUserId: idOrNull(userId)
    });
    for (const person of personSeeds) {
      await models.readinessRunPerson.create({
        tenantId,
        runId: String(run.id),
        employeeId: idOrNull(person.employeeId),
        name: person.name || '',
        email: person.email || '',
        respondentType: 'employee',
        materials: { resume: '', projects: '', reviews: '' }
      });
    }
    await enterRole(run, 'draft');
    // 岗位列表「待启动 / 已完成」依赖 assessmentStatus；新建或重建流程后进入访谈进行中
    if (position && position.assessmentStatus !== 'interviews_in_progress') {
      await position.update({ assessmentStatus: 'interviews_in_progress' });
    }
    return { id: run.id };
  };

  const list = async ({ tenantId }, { currentPage = 1, perPage = 20, filter = {} } = {}) => {
    const where = { tenantId };
    if (filter.status) {
      where.status = filter.status;
    }
    if (filter.stage) {
      where.stage = filter.stage;
    }
    if (filter.language === 'zh-CN' || filter.language === 'en-US') {
      where.language = filter.language;
    }
    if (filter.keyword) {
      where.roleName = { [Op.iLike]: `%${filter.keyword}%` };
    }
    const { rows, count } = await models.readinessRun.findAndCountAll({ where, order: [['createdAt', 'DESC']], offset: perPage * (currentPage - 1), limit: perPage });
    const runIds = rows.map(row => String(row.id));
    const positionIds = [
      ...new Set(
        rows
          .map(row => row.positionId)
          .filter(Boolean)
          .map(String)
      )
    ];
    const [persons, failedRows, managerInvites, positions] = rows.length
      ? await Promise.all([
          models.readinessRunPerson.findAll({ where: { runId: { [Op.in]: runIds }, tenantId }, attributes: ['id', 'runId', 'stage', 'name', 'status'] }),
          models.readinessStageData.findAll({ where: { runId: { [Op.in]: runIds }, isCurrent: true, status: 'failed' }, attributes: ['runId', 'personId', 'stage', 'error', 'taskId'] }),
          models.readinessInvite.findAll({ where: { runId: { [Op.in]: runIds }, kind: 'manager', isCurrent: true }, attributes: ['runId', 'status'] }),
          positionIds.length ? models.position.findAll({ where: { id: { [Op.in]: positionIds }, tenantId }, attributes: ['id', 'assessmentStatus'] }) : []
        ])
      : [[], [], [], []];
    const groupBy = list => list.reduce((map, item) => map.set(String(item.runId), [...(map.get(String(item.runId)) || []), item]), new Map());
    const personsByRun = groupBy(persons);
    const failedByRun = groupBy(failedRows);
    const invitesByRun = groupBy(managerInvites);
    const positionStatusById = new Map(positions.map(item => [String(item.id), item.assessmentStatus]));

    // 旧数据：阶段 error 文案可能不含 423，再查任务日志里的 code
    const draftTaskIds = failedRows.filter(item => item.stage === 'draft' && !item.personId && item.taskId && !isDraft423Error(item.error)).map(item => String(item.taskId));
    const task423Ids = new Set();
    if (draftTaskIds.length && fastify.task?.models?.task) {
      const tasks = await fastify.task.models.task.findAll({ where: { id: { [Op.in]: draftTaskIds } }, attributes: ['id', 'options'] });
      tasks.forEach(task => {
        const logs = task.options?.logs || [];
        if (logs.some(item => item?.data && (Number(item.data.code) === 423 || Number(item.data.status) === 423))) {
          task423Ids.add(String(task.id));
        }
      });
    }

    return {
      totalCount: count,
      pageData: rows.map(row => {
        const run = row.toJSON();
        const runPersons = personsByRun.get(String(run.id)) || [];
        const failed = failedByRun.get(String(run.id)) || [];
        const draft423 = failed.some(item => item.stage === 'draft' && !item.personId && (isDraft423Error(item.error) || (item.taskId && task423Ids.has(String(item.taskId)))));
        const positionError = run.positionId && positionStatusById.get(String(run.positionId)) === 'error';
        // 岗位输入 423：无待办、卡片浅红失败样式；岗位已标 error 或 draft 错误/任务含 423 均识别
        const inputError = !!(draft423 || (positionError && (run.stage === 'draft' || run.status === 'canceled')));
        if (inputError && run.status === 'failed') {
          models.readinessRun.update({ status: 'canceled' }, { where: { id: run.id } }).catch(e => fastify.log.warn(`heal draft-423 run ${run.id}: ${e.message}`));
          if (run.positionId && !positionError) {
            models.position.update({ assessmentStatus: 'error' }, { where: { id: String(run.positionId), tenantId } }).catch(() => null);
          }
          run.status = 'canceled';
        }
        return Object.assign(run, {
          personCount: runPersons.length,
          personDoneCount: runPersons.filter(person => person.stage === 'done').length,
          progress: runProgress(run),
          inputError,
          todos: runTodos({ run, persons: runPersons, failed, managerInvites: invitesByRun.get(String(run.id)) || [], inputError })
        });
      })
    };
  };

  const STAGE_SUMMARY_ATTRIBUTES = ['id', 'runId', 'personId', 'stage', 'version', 'isCurrent', 'status', 'source', 'taskId', 'error', 'operatorId', 'createdAt', 'updatedAt'];

  const flowDescription = () => ({
    roleStages: ROLE_STAGES.map(key => ({ key, mode: getDef('role', key).mode, action: getDef('role', key).action || null, fanOut: !!getDef('role', key).fanOut })),
    personStages: PERSON_STAGES.map(key => ({ key, mode: getDef('person', key).mode, action: getDef('person', key).action || null }))
  });

  const detail = async ({ tenantId }, { id }) => {
    const run = await findRun({ tenantId, id });
    const confirmStages = Object.values(QUESTIONNAIRE_KINDS).map(info => info.confirmStage);
    const [persons, stageData, invites, confirmMails, confirmRows, outputRows] = await Promise.all([
      loadPersons(run),
      models.readinessStageData.findAll({ where: { runId: String(run.id) }, attributes: STAGE_SUMMARY_ATTRIBUTES, order: [['id', 'ASC']] }),
      models.readinessInvite.findAll({ where: { runId: String(run.id) }, attributes: { exclude: ['answers'] }, order: [['id', 'ASC']] }),
      models.readinessSendBatch.findAll({ where: { tenantId, kind: { [Op.like]: 'confirm:%' } }, order: [['id', 'ASC']] }).then(rows => rows.filter(row => (row.runIds || []).map(String).includes(String(run.id)))),
      models.readinessStageData.findAll({ where: { runId: String(run.id), stage: { [Op.in]: confirmStages }, status: 'succeeded' }, order: [['id', 'ASC']] }),
      models.readinessStageData.findAll({ where: { runId: String(run.id), isCurrent: true, status: 'succeeded' }, attributes: ['id', 'stage', 'output'] })
    ]);
    /**
     * 确认邮件是否已确认：按本批中属于当前 run 的 targets 核对；
     * 同一 Role / 参与人、同一问卷版本的确认记录（以确认时的版本为准）；全部命中才算已确认。
     */
    const confirmOf = mail => {
      const legacyKind = String(mail.kind || '').replace('confirm:', '');
      const targets =
        Array.isArray(mail.result?.targets) && mail.result.targets.length
          ? mail.result.targets.filter(item => !item.runId || String(item.runId) === String(run.id))
          : [
              {
                kind: legacyKind,
                personId: mail.result?.personId || null,
                questionnaireVersion: mail.result?.questionnaireVersion
              }
            ];
      if (!targets.length) {
        return { confirmed: false, confirmedAt: null };
      }
      let confirmedAt = null;
      for (const target of targets) {
        const info = QUESTIONNAIRE_KINDS[target.kind];
        if (!info) {
          return { confirmed: false, confirmedAt: null };
        }
        const personId = target.personId ? String(target.personId) : null;
        const version = Number(target.questionnaireVersion);
        const rows = confirmRows.filter(row => row.stage === info.confirmStage && (row.personId ? String(row.personId) : null) === personId && Number(row.output?.questionnaireVersion) === version);
        const row = rows.filter(item => item.isCurrent).pop();
        if (!row) {
          return { confirmed: false, confirmedAt: null };
        }
        confirmedAt = row.output?.confirmedAt || confirmedAt;
      }
      return { confirmed: true, confirmedAt };
    };
    const skippedIds = new Set(confirmRows.filter(row => row.output?.skipped === true).map(row => String(row.id)));
    const summaries = new Map(outputRows.map(row => [String(row.id), summarizeStageOutput(row.stage, row.output)]));
    return {
      run: run.toJSON(),
      persons: persons.map(item => item.toJSON()),
      // 不下发 output，只带计数摘要；人工跳过补充问卷的记录在这里带出标记，供前端把后续阶段置灰
      stageData: stageData.map(item => ({ ...item.toJSON(), skipped: skippedIds.has(String(item.id)), summary: summaries.get(String(item.id)) || null })),
      // deletable：邀请对应的阶段未过才能删除
      invites: invites.map(item => ({ ...item.toJSON(), deletable: !inviteDeleteBlock({ invite: item, run, person: persons.find(person => String(person.id) === String(item.personId)) }) })),
      confirmMails: confirmMails.map(item => ({ ...item.toJSON(), ...confirmOf(item) })),
      flow: flowDescription(),
      allPersonsDone: persons.length > 0 && persons.every(person => person.stage === 'done')
    };
  };

  const stageDataDetail = async ({ tenantId }, { id }) => {
    const row = await models.readinessStageData.findOne({ where: { id: String(id), tenantId } });
    if (!row) {
      throw new Error('阶段数据不存在');
    }
    let task = null;
    if (row.taskId) {
      try {
        const current = await fastify.task.services.detail({ id: row.taskId });
        task = { id: current.id, status: current.status, error: current.error, logs: current.options?.logs || [], startedAt: current.startedAt, completedAt: current.completedAt };
      } catch (e) {
        task = null;
      }
    }
    // 答卷阶段附上对应问卷，前端把回答填回题目展示；员工采集档案若未写入 output 则从采集邀请回填
    const kindEntry = Object.entries(QUESTIONNAIRE_KINDS).find(([, item]) => item.answersStage === row.stage);
    const kindKey = kindEntry?.[0];
    const kind = kindEntry?.[1];
    let questionnaire = null;
    let output = row.output;
    if (kind) {
      const source = await models.readinessStageData.findOne({
        where: { runId: String(row.runId), stage: kind.questionnaireStage, personId: kind.scope === 'person' ? row.personId : null, isCurrent: true, status: 'succeeded' }
      });
      questionnaire = source ? questionnaireOf(source.output) : null;
      if (!output?.profileData && models.talentCollectInvite && models.readinessInvite) {
        const invite = await models.readinessInvite.findOne({
          where: {
            runId: String(row.runId),
            kind: kindKey,
            personId: idOrNull(row.personId),
            isCurrent: true,
            collectInviteId: { [Op.ne]: null }
          },
          order: [['id', 'DESC']]
        });
        if (invite?.collectInviteId) {
          const collect = await models.talentCollectInvite.findByPk(String(invite.collectInviteId));
          const profileData = collect?.profileData;
          if (profileData && typeof profileData === 'object' && Object.keys(profileData).length) {
            output = Object.assign({}, output || {}, { profileData });
          }
        }
      }
    }
    return Object.assign(row.toJSON(), { output, task, questionnaire });
  };

  // ---------- 人工动作 ----------

  const assertRoleStage = (run, stage) => {
    if (run.stage !== stage) {
      throw new Error(`当前阶段为 ${run.stage}，不能执行该操作`);
    }
  };

  const currentQuestionnaireVersion = async ({ run, kind, personId }) => {
    const info = QUESTIONNAIRE_KINDS[kind];
    const row = await models.readinessStageData.findOne({ where: { runId: String(run.id), stage: info.questionnaireStage, personId: idOrNull(info.scope === 'person' ? personId : null), isCurrent: true, status: 'succeeded' } });
    return row ? row.version : null;
  };

  /**
   * 确认问卷：逐个 Role/Person 独立确认。确认须同时填写问卷截止日期，确认后自动进入「发布」阶段（把题目写入 AI 面试并开启项目）。
   * 管理员在后台直接确认、收件人在邮件里的免登录页确认，都走这里；先到先得，后到的确认会因阶段已推进而被拒绝。
   * operator：{ userId, via: 'admin' | 'email', name, email }
   */
  const confirmQuestionnaire = async ({ tenantId, runId, kind, personId, deadline, digitalId, questionnaireVersion, operator }) => {
    const info = QUESTIONNAIRE_KINDS[kind];
    if (!info) {
      throw new Error('问卷类型不正确');
    }
    const normalizedDeadline = normalizeDeadline(deadline);
    if (!idOrNull(digitalId)) {
      throw new Error('请选择数字人');
    }
    const run = await findRun({ tenantId, id: runId });
    const person = info.scope === 'person' ? await findPerson({ run, personId }) : null;
    const version = await currentQuestionnaireVersion({ run, kind, personId: person?.id });
    if (version == null) {
      throw new Error('问卷尚未生成');
    }
    if (questionnaireVersion != null && Number(questionnaireVersion) !== Number(version)) {
      throw new Error('问卷已更新，请使用最新的确认邮件');
    }
    const output = {
      confirmedAt: new Date().toISOString(),
      confirmedBy: idOrNull(operator?.userId),
      confirmedByName: operator?.name || '',
      confirmedByEmail: operator?.email || '',
      via: operator?.via || 'admin',
      questionnaireVersion: version,
      deadline: normalizedDeadline,
      digitalId: String(digitalId)
    };
    const nextStage = getDef(info.scope, info.confirmStage).next();
    // 原子抢占：只有仍停留在确认阶段的那一次能推进，避免多位收件人同时确认时重复发布
    const [moved] =
      info.scope === 'role'
        ? await models.readinessRun.update({ stage: nextStage }, { where: { id: run.id, stage: info.confirmStage } })
        : await models.readinessRunPerson.update({ stage: nextStage }, { where: { id: person.id, stage: info.confirmStage } });
    if (moved !== 1) {
      const current = info.scope === 'role' ? (await models.readinessRun.findByPk(run.id)).stage : (await models.readinessRunPerson.findByPk(person.id)).stage;
      throw new Error(stageIndex(info.scope, current) > stageIndex(info.scope, info.confirmStage) ? ALREADY_CONFIRMED_MESSAGE : `当前阶段为 ${current}，不能确认`);
    }
    await createManualData({ run, personId: person?.id, stage: info.confirmStage, output, operatorId: operator?.userId });
    if (info.scope === 'role') {
      await enterRole(run, nextStage);
    } else {
      await enterPerson(run, person, nextStage);
    }
    return output;
  };

  const confirm = async ({ tenantId, userId }, { runId, kind, personId, deadline, digitalId }) => {
    await confirmQuestionnaire({ tenantId, runId, kind, personId, deadline, digitalId, operator: { userId, via: 'admin' } });
    return {};
  };

  /**
   * 人工跳过补充问卷：参与人停在「确认补充问卷」时，不发补卷、不收答卷，直接进入「更新个人评估」（补卷题与答卷均为空）。
   * 用原子抢占保证只推进一次；阶段数据记一条带 skipped 标记的人工版本，回退到此阶段时会被作废。
   */
  const skipReassessConfirm = async ({ tenantId, userId }, { runId, personId }) => {
    const run = await findRun({ tenantId, id: runId });
    const person = await findPerson({ run, personId });
    const info = QUESTIONNAIRE_KINDS.reassess;
    if (person.stage !== info.confirmStage) {
      throw new Error(`参与人当前阶段为 ${person.stage}，不能跳过补充问卷确认`);
    }
    // 跳过 = 越过发布、发送、回收三段，直接到 reassess_answers 的下一阶段（更新个人评估）
    const nextStage = getDef('person', info.answersStage).next();
    const [moved] = await models.readinessRunPerson.update({ stage: nextStage }, { where: { id: person.id, stage: info.confirmStage } });
    if (moved !== 1) {
      throw new Error('参与人阶段已变化，请刷新后重试');
    }
    await createManualData({
      run,
      personId: person.id,
      stage: info.confirmStage,
      output: { skipped: true, skippedAt: new Date().toISOString(), skippedBy: idOrNull(userId) },
      operatorId: userId
    });
    await enterPerson(run, person, nextStage);
    return {};
  };

  /** AI 面试客户已分配的数字人，确认问卷时从中选择（与流程语言一致的排在前面） */
  const listDigitals = async ({ tenantId }, { runId } = {}) => {
    const { services } = fastify[options.name];
    const setting = await services.talentReviewSetting.detail({ tenantId });
    if (!setting.clientId) {
      throw new Error('AI面试设置中缺少客户信息，请在 AI面试设置里重新保存连接');
    }
    const run = runId ? await findRun({ tenantId, id: runId }) : null;
    let result;
    try {
      result = await services.aiInterview.adminListDigitals({ tenantId, clientId: setting.clientId });
    } catch (e) {
      const msg = errorText(e);
      throw new Error(/fetch failed/i.test(msg) ? '无法连接 AI 面试服务获取数字人列表，请检查该租户「AI面试设置」中的接口地址与密钥是否可用' : `获取数字人列表失败：${msg}`);
    }
    const digitals = digitalsOf(result?.pageData);
    return { pageData: run ? [...digitals.filter(item => item.language === run.language), ...digitals.filter(item => item.language !== run.language)] : digitals };
  };

  /** 录入/同步答卷后推进：manager → revise；staff → assess；reassess → assess_update */
  /** 当前阶段是否已有成功的答卷（personId 为空表示 Role 级） */
  const hasCurrentAnswers = async ({ run, stage, personId }) => {
    const count = await models.readinessStageData.count({ where: { runId: String(run.id), stage, personId: idOrNull(personId), isCurrent: true, status: 'succeeded' } });
    return count > 0;
  };

  /** 保存答卷到当前阶段，不推进；经理答卷只保留先到的一份，之后的收件人答卷报“已回收”（由调用方记为失败项） */
  const saveAnswers = async ({ tenantId, userId }, { runId, kind, personId, answers, videoAnswers, profileData }) => {
    const info = QUESTIONNAIRE_KINDS[kind];
    if (!info) {
      throw new Error('问卷类型不正确');
    }
    const hasQuestionnaire = answers != null && typeof answers === 'object' && Object.keys(answers).length > 0;
    const hasVideo = Array.isArray(videoAnswers) && videoAnswers.length > 0;
    if (!hasQuestionnaire && !hasVideo) {
      throw new Error('答卷不能为空');
    }
    const run = await findRun({ tenantId, id: runId });
    const output = { answers: answers || {}, videoAnswers: videoAnswers || [] };
    if (profileData && typeof profileData === 'object' && Object.keys(profileData).length) {
      output.profileData = profileData;
    }
    if (kind === 'manager') {
      assertRoleStage(run, info.answersStage);
      if (await hasCurrentAnswers({ run, stage: info.answersStage })) {
        throw new Error('经理答卷已回收，不再重复保存');
      }
      await createManualData({ run, stage: info.answersStage, output, operatorId: userId });
      return {};
    }
    const person = await findPerson({ run, personId });
    if (person.stage !== info.answersStage) {
      throw new Error(`参与人当前阶段为 ${person.stage}，不能提交答卷`);
    }
    if (await hasCurrentAnswers({ run, stage: info.answersStage, personId: person.id })) {
      throw new Error('该参与人答卷已回收，不再重复保存');
    }
    // 采集档案写入 person.materials，供 /person/assess 计算档案完成度
    const materials = materialsFromProfileData(profileData);
    if (materials) {
      await person.update({ materials: Object.assign({ resume: '', projects: '', reviews: '' }, person.materials || {}, materials) });
    }
    await createManualData({ run, personId: person.id, stage: info.answersStage, output, operatorId: userId });
    return {};
  };

  /** 确认答卷并进入下一阶段：要求当前阶段已有答卷 */
  const advanceAnswers = async ({ tenantId }, { runId, kind, personId }) => {
    const info = QUESTIONNAIRE_KINDS[kind];
    if (!info) {
      throw new Error('问卷类型不正确');
    }
    const run = await findRun({ tenantId, id: runId });
    if (kind === 'manager') {
      assertRoleStage(run, info.answersStage);
      if (!(await hasCurrentAnswers({ run, stage: info.answersStage }))) {
        throw new Error('尚未回收到经理答卷，不能进入下一阶段');
      }
      await enterRole(run, getDef('role', info.answersStage).next());
      return {};
    }
    const person = await findPerson({ run, personId });
    if (person.stage !== info.answersStage) {
      throw new Error(`参与人当前阶段为 ${person.stage}，不能确认答卷`);
    }
    if (!(await hasCurrentAnswers({ run, stage: info.answersStage, personId: person.id }))) {
      throw new Error('尚未回收到该参与人的答卷，不能进入下一阶段');
    }
    await enterPerson(run, person, getDef('person', info.answersStage).next());
    return {};
  };

  /** 录入答卷并继续：保存后直接推进（手工录入的一步到位） */
  const submitAnswers = async (authenticatePayload, body) => {
    await saveAnswers(authenticatePayload, body);
    return advanceAnswers(authenticatePayload, body);
  };

  /** 发送完成：manager/reassess 推进阶段；staff 逐人进入 answers，Role 进入 await_persons */
  const completeSend = async ({ run: runInput, kind, personId, output, userId }) => {
    const info = QUESTIONNAIRE_KINDS[kind];
    const run = await models.readinessRun.findByPk(runInput.id);
    if (kind === 'manager') {
      assertRoleStage(run, info.sendStage);
      await createManualData({ run, stage: info.sendStage, output, operatorId: userId });
      await enterRole(run, getDef('role', info.sendStage).next());
      return;
    }
    if (kind === 'reassess') {
      const person = await findPerson({ run, personId });
      await createManualData({ run, personId: person.id, stage: info.sendStage, output, operatorId: userId });
      await enterPerson(run, person, getDef('person', info.sendStage).next());
      return;
    }
    const person = await findPerson({ run, personId });
    if (person.stage === 'pending') {
      await enterPerson(run, person, 'answers');
    }
    if (run.stage === 'staff_send') {
      await createManualData({ run, stage: 'staff_send', output, operatorId: userId });
      await enterRole(run, getDef('role', 'staff_send').next());
    }
  };

  /** 人工触发报告生成：要求全部参与人已完成 */
  const triggerReports = async ({ tenantId, userId }, { runId }) => {
    const run = await findRun({ tenantId, id: runId });
    assertRoleStage(run, 'await_persons');
    const persons = await loadPersons(run);
    const unfinished = persons.filter(person => person.stage !== 'done');
    if (unfinished.length) {
      throw new Error(`仍有 ${unfinished.length} 位参与人未完成：${unfinished.map(item => item.name).join('、')}`);
    }
    await createManualData({ run, stage: 'await_persons', output: { triggeredAt: new Date().toISOString() }, operatorId: userId });
    await enterRole(run, getDef('role', 'await_persons').next());
    return {};
  };

  // ---------- 退回 / 重试 ----------

  const invalidateInvites = async ({ run, kinds, personId }) => {
    const where = { runId: String(run.id), kind: { [Op.in]: kinds }, isCurrent: true };
    if (personId) {
      where.personId = String(personId);
    }
    await models.readinessInvite.update({ isCurrent: false }, { where });
  };

  /**
   * 退回到某阶段重新执行：目标阶段及其下游的当前版本置为历史，重新执行后版本 +1。
   * scope=role：退回到 staff_send 及更早，所有参与人一并重置；scope=person：只重置该人，Role 报告段若已开始则整体作废。
   */
  const rollback = async ({ tenantId, userId }, { runId, scope = 'role', personId, stage }) => {
    const run = await findRun({ tenantId, id: runId });
    if (!['role', 'person'].includes(scope)) {
      throw new Error('scope 不正确');
    }
    const person = scope === 'person' ? await findPerson({ run, personId }) : null;
    const index = stageIndex(scope, stage);
    if (index < 0) {
      throw new Error('阶段不存在');
    }
    const currentIndex = stageIndex(scope, person ? person.stage : run.stage);
    if (index > currentIndex || (scope === 'person' && stage === 'pending')) {
      throw new Error('只能退回到已经到达过的阶段');
    }
    const plan = rollbackPlan({ scope, stage, runStage: run.stage });

    if (scope === 'role') {
      await supersede({ runId: run.id, stages: plan.roleStages, allPersons: true });
      if (plan.roleStages.includes('manager_send')) {
        await invalidateInvites({ run, kinds: ['manager'] });
      }
      if (plan.resetPersons) {
        const persons = await loadPersons(run);
        await supersede({ runId: run.id, stages: PERSON_STAGES, allPersons: true });
        await invalidateInvites({ run, kinds: ['staff', 'reassess'] });
        for (const item of persons) {
          await item.update({ stage: 'pending', status: 'pending', profileCompletionPct: null });
        }
      }
      await enterRole(run, stage);
    } else {
      await supersede({ runId: run.id, personId: person.id, stages: plan.personStages });
      if (plan.personStages.includes('reassess_send')) {
        await invalidateInvites({ run, kinds: ['reassess'], personId: person.id });
      }
      if (plan.personStages.includes('answers')) {
        await invalidateInvites({ run, kinds: ['staff'], personId: person.id });
      }
      if (plan.roleStageTarget) {
        await supersede({ runId: run.id, stages: plan.roleStages, allPersons: true });
        await run.update({ stage: plan.roleStageTarget });
      }
      await enterPerson(run, person, stage);
    }
    void userId;
    return {};
  };

  /** 重试失败阶段：person_reports 只重跑该人的报告，其它阶段退回到该阶段重跑 */
  const retry = async (auth, { runId, scope = 'role', personId, stage }) => {
    if (stage === 'person_reports' && personId) {
      const run = await findRun({ tenantId: auth.tenantId, id: runId });
      const person = await findPerson({ run, personId });
      await startTask({ run, person, stage, def: getDef('role', 'person_reports') });
      await refreshStatus(run);
      return {};
    }
    return rollback(auth, { runId, scope, personId, stage });
  };

  Object.assign(fastify[options.name].services, {
    readiness: {
      onTaskSuccess,
      onTaskFailed,
      onTaskCanceled,
      createRun,
      cancel,
      cancelByPosition,
      list,
      detail,
      stageDataDetail,
      confirm,
      skipReassessConfirm,
      submitAnswers,
      saveAnswers,
      advanceAnswers,
      completeSend,
      triggerReports,
      rollback,
      retry,
      findRun,
      findPerson,
      loadPersons,
      questionnaireVersion: currentQuestionnaireVersion,
      confirmQuestionnaire,
      listDigitals,
      ALREADY_CONFIRMED_MESSAGE
    }
  });
});
