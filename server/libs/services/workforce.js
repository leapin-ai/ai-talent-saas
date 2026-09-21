const fp = require('fastify-plugin');

const CHANGE_TAGS = ['critical_to_build', 'ai_emerging', 'new', 'increasing', 'stable', 'decreasing'];
const ACTIONS = ['BUILD', 'MOVE', 'BUY', 'AUGMENT'];
const READINESS_STATUS = ['critical', 'gap', 'onTarget', 'above'];

const SKILL_CHANGE_TO_TAG = {
  must_build: 'critical_to_build',
  ai_emerging: 'ai_emerging',
  new: 'new',
  enhanced: 'increasing',
  stable: 'stable',
  declining: 'decreasing'
};

const clampInt = (value, min, max, fallback) => {
  const num = Number(value);
  if (!Number.isFinite(num)) {
    return fallback;
  }
  return Math.min(max, Math.max(min, Math.round(num)));
};

const mapSkillChange = change => SKILL_CHANGE_TO_TAG[change] || 'stable';

module.exports = fp(async (fastify, options) => {
  const { models, services } = fastify[options.name];
  const { Op } = fastify.sequelize.Sequelize;

  const scopeWhere = tenantId => ({
    tenantId,
    status: { [Op.ne]: 'closed' }
  });

  const workforceSummary = async authenticatePayload => {
    const { tenantId } = authenticatePayload;
    const base = scopeWhere(tenantId);
    const [rolesInScope, rolesRequiringChange, highChangeRoles, assessmentsRemaining, samples] = await Promise.all([
      models.position.count({ where: base }),
      models.position.count({
        where: Object.assign({}, base, {
          assessmentStatus: 'completed',
          changeMagnitude: { [Op.in]: ['medium', 'high'] }
        })
      }),
      models.position.count({
        where: Object.assign({}, base, {
          assessmentStatus: 'completed',
          changeMagnitude: 'high'
        })
      }),
      models.position.count({
        where: Object.assign({}, base, {
          assessmentStatus: { [Op.in]: ['pending', 'interviews_in_progress'] }
        })
      }),
      models.position.findAll({
        where: Object.assign({}, base, { changeMagnitude: 'high', assessmentStatus: 'completed' }),
        attributes: ['id', 'name'],
        order: [['updatedAt', 'DESC']],
        limit: 3
      })
    ]);
    return {
      rolesInScope,
      rolesRequiringChange,
      highChangeRoles,
      assessmentsRemaining,
      sampleNames: samples.map(item => item.name).filter(Boolean)
    };
  };

  const markInterviewsInProgress = async ({ tenantId, positionId }) => {
    if (!positionId) {
      return;
    }
    const position = await models.position.findOne({ where: { id: positionId, tenantId } });
    if (!position || position.assessmentStatus === 'completed') {
      return;
    }
    if (position.assessmentStatus !== 'interviews_in_progress') {
      await position.update({ assessmentStatus: 'interviews_in_progress' });
    }
  };

  const markAnalysisCompleted = async position => {
    if (!position) {
      return;
    }
    if (position.assessmentStatus !== 'completed') {
      await position.update({ assessmentStatus: 'completed' });
    }
  };

  const listTasks = async (authenticatePayload, { positionId, changeTag, activityGroup, confidence } = {}) => {
    const { tenantId } = authenticatePayload;
    const where = { tenantId, positionId };
    if (changeTag && CHANGE_TAGS.includes(changeTag)) {
      where.changeTag = changeTag;
    }
    if (activityGroup) {
      where.activityGroup = activityGroup;
    }
    if (confidence) {
      where.confidence = confidence;
    }
    const rows = await models.positionTask.findAll({
      where,
      order: [
        ['sortOrder', 'ASC'],
        ['id', 'ASC']
      ]
    });
    return { pageData: rows.map(row => (row.toJSON ? row.toJSON() : row)) };
  };

  const replaceTasks = async (authenticatePayload, { positionId, tasks = [], outlook, workforceStrategy } = {}) => {
    const { tenantId } = authenticatePayload;
    const position = await models.position.findOne({ where: { id: positionId, tenantId } });
    if (!position) {
      throw new Error('未找到职位');
    }
    const existing = await models.positionTask.findAll({ where: { tenantId, positionId } });
    const byKey = new Map(existing.map(row => [`${row.activityGroup}::${row.title}`, row]));
    const kept = new Set();
    const list = Array.isArray(tasks) ? tasks : [];
    for (let index = 0; index < list.length; index += 1) {
      const item = list[index] || {};
      const title = String(item.title || '').trim();
      if (!title) {
        continue;
      }
      const activityGroup = String(item.activityGroup || 'A01');
      const payload = {
        tenantId,
        positionId,
        activityGroup,
        sortOrder: Number.isFinite(Number(item.sortOrder)) ? Number(item.sortOrder) : index,
        title,
        description: item.description || '',
        importanceNow: clampInt(item.importanceNow, 1, 5, 1),
        importanceFuture: clampInt(item.importanceFuture, 1, 5, 1),
        changeTag: CHANGE_TAGS.includes(item.changeTag) ? item.changeTag : mapSkillChange(item.change),
        confidence: ['high', 'medium', 'low'].includes(item.confidence) ? item.confidence : 'medium',
        workforceAction: ACTIONS.includes(item.workforceAction) ? item.workforceAction : null,
        detail: item.detail && typeof item.detail === 'object' ? item.detail : {}
      };
      const key = `${activityGroup}::${title}`;
      const found = byKey.get(key);
      if (found) {
        await found.update(payload);
        kept.add(String(found.id));
      } else {
        const created = await models.positionTask.create(payload);
        kept.add(String(created.id));
      }
    }
    for (const row of existing) {
      if (!kept.has(String(row.id))) {
        await row.destroy();
      }
    }
    if (outlook && typeof outlook === 'object') {
      await position.update({ outlook });
    }
    if (Array.isArray(workforceStrategy)) {
      await models.positionWorkforceStrategy.destroy({ where: { tenantId, positionId } });
      for (let index = 0; index < workforceStrategy.length; index += 1) {
        const card = workforceStrategy[index] || {};
        if (!ACTIONS.includes(card.action)) {
          continue;
        }
        await models.positionWorkforceStrategy.create({
          tenantId,
          positionId,
          action: card.action,
          title: card.title || card.action,
          detail: card.detail || '',
          peopleCount: card.peopleCount == null ? null : Number(card.peopleCount),
          sortOrder: index
        });
      }
    }
    return listTasks(authenticatePayload, { positionId });
  };

  const tasksFromSkills = skills => {
    if (!Array.isArray(skills)) {
      return [];
    }
    return skills
      .map((skill, index) => {
        const title = typeof skill?.name === 'string' ? skill.name.trim() : '';
        if (!title) {
          return null;
        }
        const items = Array.isArray(skill.contentItems) ? skill.contentItems : [];
        return {
          activityGroup: 'Imported',
          sortOrder: index,
          title,
          description: items
            .map(item => item?.description)
            .filter(Boolean)
            .join('\n'),
          importanceNow: skill.importanceNow,
          importanceFuture: skill.importanceYear,
          change: skill.change,
          confidence: skill.confidence,
          detail: {
            contentItems: items
              .map(item => ({
                title: typeof item?.title === 'string' ? item.title.trim() : '',
                description: typeof item?.description === 'string' ? item.description.trim() : typeof item?.desc === 'string' ? item.desc.trim() : '',
                source: typeof item?.source === 'string' ? item.source.trim() : ''
              }))
              .filter(item => item.title || item.description || item.source),
            whyToday: items[0]?.description || '',
            whyFuture: items[1]?.description || '',
            citations: items.map(item => ({ label: item?.source || item?.title || '' })).filter(item => item.label)
          }
        };
      })
      .filter(Boolean);
  };

  const outlookFromVerdict = verdict => {
    const data = verdict && typeof verdict === 'object' ? verdict : {};
    return {
      summary: data.summary || '',
      drivesSuccessNow: data.today ? [data.today] : [],
      howRoleChanging: data.future ? [data.future] : [],
      aiImpact: data.futureLabel || ''
    };
  };

  const replaceTasksFromAnalysis = async (authenticatePayload, { position, positionPayload }) => {
    const skills = Array.isArray(positionPayload?.skill) ? positionPayload.skill : position.skill;
    const verdict = positionPayload?.verdict || position.verdict;
    const tasks = Array.isArray(positionPayload?.tasks) ? positionPayload.tasks : tasksFromSkills(skills);
    const outlook = positionPayload?.outlook && typeof positionPayload.outlook === 'object' ? positionPayload.outlook : outlookFromVerdict(verdict);
    const workforceStrategy = Array.isArray(positionPayload?.workforceStrategy) ? positionPayload.workforceStrategy : [];
    await replaceTasks(authenticatePayload, {
      positionId: position.id,
      tasks,
      outlook,
      workforceStrategy
    });
    await markAnalysisCompleted(position);
  };

  const listStrategies = async (authenticatePayload, { positionId }) => {
    const rows = await models.positionWorkforceStrategy.findAll({
      where: { tenantId: authenticatePayload.tenantId, positionId },
      order: [['sortOrder', 'ASC']]
    });
    return rows.map(row => (row.toJSON ? row.toJSON() : row));
  };

  const deriveReadinessStatus = (current, required) => {
    if (current >= required && required > 0 && current > required) {
      return 'above';
    }
    if (current >= required) {
      return 'onTarget';
    }
    if (required - current >= 2) {
      return 'critical';
    }
    return 'gap';
  };

  const getTaskReadiness = async (authenticatePayload, { positionId, employeeId, status, activityGroup } = {}) => {
    const { tenantId } = authenticatePayload;
    const where = { tenantId, positionId, employeeId };
    if (status && READINESS_STATUS.includes(status)) {
      where.status = status;
    }
    const rows = await models.employeeTaskReadiness.findAll({
      where,
      include: [{ model: models.positionTask, required: true }],
      order: [['id', 'ASC']]
    });
    const pageData = rows
      .map(row => {
        const plain = row.toJSON ? row.toJSON() : row;
        const task = plain.positionTask || {};
        if (activityGroup && task.activityGroup !== activityGroup) {
          return null;
        }
        return {
          id: plain.id,
          taskId: plain.taskId || plain.positionTaskId,
          current: plain.current,
          required: plain.required,
          status: plain.status,
          confidence: plain.confidence,
          title: task.title,
          activityGroup: task.activityGroup,
          changeTag: task.changeTag,
          importanceNow: task.importanceNow,
          importanceFuture: task.importanceFuture
        };
      })
      .filter(Boolean);
    return { pageData };
  };

  const replaceTaskReadiness = async (authenticatePayload, { positionId, employeeId, rows = [] } = {}) => {
    const { tenantId } = authenticatePayload;
    const list = Array.isArray(rows) ? rows : [];
    for (const item of list) {
      const taskId = item.taskId || item.positionTaskId;
      if (!taskId) {
        continue;
      }
      const current = clampInt(item.current, 0, 5, 0);
      const required = clampInt(item.required, 0, 5, 0);
      const status = READINESS_STATUS.includes(item.status) ? item.status : deriveReadinessStatus(current, required);
      const confidence = ['high', 'medium', 'low'].includes(item.confidence) ? item.confidence : 'medium';
      const found = await models.employeeTaskReadiness.findOne({
        where: { tenantId, employeeId, taskId }
      });
      const payload = { tenantId, positionId, employeeId, taskId, current, required, status, confidence };
      if (found) {
        await found.update(payload);
      } else {
        await models.employeeTaskReadiness.create(payload);
      }
    }
    return getTaskReadiness(authenticatePayload, { positionId, employeeId });
  };

  const importSkillReadiness = async (authenticatePayload, { positionId, employeeId, skills = [] } = {}) => {
    const tasks = await models.positionTask.findAll({
      where: { tenantId: authenticatePayload.tenantId, positionId }
    });
    const byTitle = new Map(tasks.map(task => [String(task.title).toLowerCase(), task]));
    const rows = (Array.isArray(skills) ? skills : [])
      .map(skill => {
        const task = byTitle.get(
          String(skill?.name || '')
            .trim()
            .toLowerCase()
        );
        if (!task) {
          return null;
        }
        return {
          taskId: task.id,
          current: skill.current,
          required: skill.required,
          status: skill.status,
          confidence: 'medium'
        };
      })
      .filter(Boolean);
    if (!rows.length) {
      return { pageData: [], unmapped: true };
    }
    return replaceTaskReadiness(authenticatePayload, { positionId, employeeId, rows });
  };

  const listEvidence = async (authenticatePayload, { employeeId, sourceType } = {}) => {
    const where = { tenantId: authenticatePayload.tenantId, employeeId };
    if (sourceType) {
      where.sourceType = sourceType;
    }
    const rows = await models.evidenceItem.findAll({
      where,
      order: [
        ['capturedAt', 'DESC'],
        ['id', 'DESC']
      ]
    });
    return { pageData: rows.map(row => (row.toJSON ? row.toJSON() : row)), totalCount: rows.length };
  };

  const checklistItem = (key, label, done) => ({ key, label, done: !!done });

  const recomputeProfileCompletion = async ({ tenantId, employeeId, assessment } = {}) => {
    const employee = await models.employee.findOne({
      where: { id: employeeId, tenantId },
      include: [models.profile]
    });
    if (!employee) {
      return null;
    }
    const profile = employee.profile || {};
    const options = employee.options || {};
    const profileData = assessment?.profileData || {};
    const projects = profileData.projects || profile.options?.projects || [];
    const linkedin = profileData.linkedin || options.linkedin || '';
    const hasContact = !!(employee.name && (employee.phone || employee.email));
    const resumes = employee.resumes || profileData.resumes || [];
    const hasCv = Array.isArray(resumes) ? resumes.length > 0 : !!employee.currentResumeId;
    const hasInterview = !!(assessment?.clientUserId || assessment?.interviewData?.interviewId);
    const approved = assessment?.status === 'approved' || assessment?.status === 'submitted';
    const checklist = [
      checklistItem('basic', '基础信息', hasContact),
      checklistItem('cv', 'CV', hasCv),
      checklistItem('linkedin', 'LinkedIn', !!linkedin),
      checklistItem('project', '项目经历', Array.isArray(projects) && projects.length > 0),
      checklistItem('ai_interview', 'AI 面试', hasInterview),
      checklistItem('approved', '审核通过', approved)
    ];
    const done = checklist.filter(item => item.done).length;
    const percent = Math.round((done / checklist.length) * 100);
    employee.profileCompletionPercent = percent;
    employee.profileCompletionChecklist = checklist;
    employee.changed('profileCompletionChecklist', true);
    await employee.save();
    return { percent, checklist };
  };

  const seedEvidenceFromEmployee = async ({ tenantId, employee, assessment }) => {
    if (!employee) {
      return;
    }
    const existing = await models.evidenceItem.count({ where: { tenantId, employeeId: employee.id } });
    if (existing > 0) {
      return;
    }
    const creates = [];
    const resumes = Array.isArray(assessment?.profileData?.resumes) ? assessment.profileData.resumes : [];
    resumes.forEach(file => {
      creates.push({
        tenantId,
        employeeId: employee.id,
        sourceType: 'cv',
        title: file.filename || file.name || 'CV',
        summary: '',
        fileId: file.id || file.fileId || null,
        capturedAt: new Date()
      });
    });
    if (assessment?.clientUserId) {
      creates.push({
        tenantId,
        employeeId: employee.id,
        sourceType: 'ai_interview',
        title: 'AI Interview',
        summary: '',
        uri: String(assessment.clientUserId),
        capturedAt: new Date()
      });
    }
    if (creates.length) {
      await models.evidenceItem.bulkCreate(creates);
    }
  };

  Object.assign(services, {
    workforce: {
      workforceSummary,
      markInterviewsInProgress,
      markAnalysisCompleted,
      listTasks,
      replaceTasks,
      replaceTasksFromAnalysis,
      tasksFromSkills,
      outlookFromVerdict,
      listStrategies,
      getTaskReadiness,
      replaceTaskReadiness,
      importSkillReadiness,
      listEvidence,
      recomputeProfileCompletion,
      seedEvidenceFromEmployee
    }
  });
});
