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
    const formatActivityGroup = (code, title) => {
      const c = String(code || '')
        .trim()
        .slice(0, 32);
      const t = String(title || '')
        .trim()
        .slice(0, 160);
      if (c && t) {
        return `${c} · ${t}`.slice(0, 200);
      }
      return (c || t).slice(0, 200);
    };
    return skills
      .map((skill, index) => {
        const title = typeof skill?.name === 'string' ? skill.name.trim() : '';
        if (!title) {
          return null;
        }
        const items = Array.isArray(skill.contentItems) ? skill.contentItems : [];
        const activityGroup = formatActivityGroup(skill.activityCode, skill.activityTitle) || 'Imported';
        return {
          activityGroup,
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

  const normalizeAiEfficiencyGain = value => {
    if (value == null || value === '') {
      return null;
    }
    const num = Number(String(value).trim().replace(/%$/, ''));
    if (!Number.isFinite(num)) {
      return null;
    }
    return Math.max(0, Math.min(100, Math.round(num)));
  };

  const outlookFromVerdict = verdict => {
    const data = verdict && typeof verdict === 'object' ? verdict : {};
    return {
      summary: data.summary || '',
      drivesSuccessNow: data.today ? [data.today] : [],
      howRoleChanging: data.future ? [data.future] : [],
      aiImpact: data.futureLabel || '',
      aiEfficiencyGain: normalizeAiEfficiencyGain(data.aiEfficiencyGain)
    };
  };

  const replaceTasksFromAnalysis = async (authenticatePayload, { position, positionPayload, skipAssessmentStatusUpdate = false }) => {
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
    // 经理邀请触发的 AI 岗位分析：只落分析产物，不改职位列表「状态」(assessmentStatus)
    if (!skipAssessmentStatusUpdate) {
      await markAnalysisCompleted(position);
    }
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

  const listEvidence = async (authenticatePayload, { employeeId, sourceType, taskId } = {}) => {
    const { tenantId } = authenticatePayload;
    if (!employeeId) {
      throw new Error('员工ID不能为空');
    }
    const where = { tenantId, employeeId };
    if (sourceType) {
      where.sourceType = sourceType;
    }

    let rows;
    if (taskId && models.evidenceTaskLink) {
      const links = await models.evidenceTaskLink.findAll({
        where: { tenantId, positionTaskId: String(taskId) },
        include: [
          {
            model: models.evidenceItem,
            required: true,
            where: { tenantId, employeeId }
          }
        ],
        order: [['id', 'DESC']]
      });
      rows = links.map(link => {
        const plain = link.toJSON ? link.toJSON() : link;
        const item = plain.evidenceItem || {};
        return Object.assign({}, item, {
          linkId: plain.id,
          taskId: String(taskId)
        });
      });
    } else {
      rows = await models.evidenceItem.findAll({
        where,
        order: [
          ['capturedAt', 'DESC'],
          ['id', 'DESC']
        ]
      });
      rows = rows.map(row => (row.toJSON ? row.toJSON() : row));
    }

    return { pageData: rows, totalCount: rows.length };
  };

  const SOURCE_TYPES = ['cv', 'linkedin', 'ai_interview', 'interview', 'project', 'certification', 'jd', 'performance', 'external', 'profile'];

  const normalizeEvidenceItem = item => {
    if (!item || typeof item !== 'object') {
      return null;
    }
    const summary = typeof item.summary === 'string' ? item.summary.trim() : '';
    const title = typeof item.title === 'string' ? item.title.trim() : '';
    if (!summary && !title) {
      return null;
    }
    const sourceType = SOURCE_TYPES.includes(item.sourceType) ? item.sourceType : 'profile';
    return {
      id: item.id ? String(item.id) : null,
      sourceType,
      title: title || summary.slice(0, 80),
      summary: summary || title,
      fileId: item.fileId ? String(item.fileId) : null,
      uri: item.uri ? String(item.uri) : null,
      confidence: ['high', 'medium', 'low'].includes(item.confidence) ? item.confidence : null
    };
  };

  /**
   * 替换某任务下的证据：写入/更新证据项，并重建 task 关联。
   */
  const replaceTaskEvidence = async (authenticatePayload, { employeeId, taskId, items = [] } = {}) => {
    const { tenantId } = authenticatePayload;
    if (!employeeId || !taskId) {
      throw new Error('员工与任务不能为空');
    }
    const employee = await models.employee.findByPk(employeeId);
    if (!employee || String(employee.tenantId) !== String(tenantId)) {
      throw new Error('未找到员工');
    }
    const task = await models.positionTask.findByPk(String(taskId));
    if (!task || String(task.tenantId) !== String(tenantId)) {
      throw new Error('未找到岗位任务');
    }

    const list = (Array.isArray(items) ? items : []).map(normalizeEvidenceItem).filter(Boolean);

    const existingLinks = await models.evidenceTaskLink.findAll({
      where: { tenantId, positionTaskId: String(taskId) },
      include: [
        {
          model: models.evidenceItem,
          required: false,
          where: { employeeId: String(employeeId) }
        }
      ]
    });

    const keepEvidenceIds = new Set();
    const nextLinks = [];

    for (const item of list) {
      let evidence;
      if (item.id) {
        evidence = await models.evidenceItem.findOne({
          where: { id: item.id, tenantId, employeeId: String(employeeId) }
        });
      }
      if (evidence) {
        await evidence.update({
          sourceType: item.sourceType,
          title: item.title,
          summary: item.summary,
          fileId: item.fileId,
          uri: item.uri,
          confidence: item.confidence,
          capturedAt: evidence.capturedAt || new Date()
        });
      } else {
        evidence = await models.evidenceItem.create({
          tenantId,
          employeeId: String(employeeId),
          sourceType: item.sourceType,
          title: item.title,
          summary: item.summary,
          fileId: item.fileId,
          uri: item.uri,
          confidence: item.confidence,
          capturedAt: new Date()
        });
      }
      keepEvidenceIds.add(String(evidence.id));
      nextLinks.push(String(evidence.id));
    }

    for (const link of existingLinks) {
      const plain = link.toJSON ? link.toJSON() : link;
      const evidenceId = String(plain.evidenceItemId || plain.evidenceItem?.id || '');
      const belongsToEmployee = plain.evidenceItem && String(plain.evidenceItem.employeeId) === String(employeeId);
      if (!belongsToEmployee && plain.evidenceItem) {
        continue;
      }
      // 无 include 命中时仍按 evidenceItemId 查属主
      if (!plain.evidenceItem && evidenceId) {
        const owned = await models.evidenceItem.findOne({
          where: { id: evidenceId, tenantId, employeeId: String(employeeId) }
        });
        if (!owned) {
          continue;
        }
      }
      if (!keepEvidenceIds.has(evidenceId)) {
        await link.destroy();
      }
    }

    for (const evidenceId of nextLinks) {
      const found = await models.evidenceTaskLink.findOne({
        where: { tenantId, evidenceItemId: evidenceId, positionTaskId: String(taskId) }
      });
      if (!found) {
        await models.evidenceTaskLink.create({
          tenantId,
          evidenceItemId: evidenceId,
          positionTaskId: String(taskId)
        });
      }
    }

    return listEvidence(authenticatePayload, { employeeId, taskId });
  };

  /**
   * 保存员工通用证据（档案来源区）；可选关联多个 taskIds。
   */
  const saveEvidence = async (authenticatePayload, { employeeId, id, sourceType, title, summary, fileId, uri, confidence, taskIds } = {}) => {
    const { tenantId } = authenticatePayload;
    if (!employeeId) {
      throw new Error('员工ID不能为空');
    }
    const employee = await models.employee.findByPk(employeeId);
    if (!employee || String(employee.tenantId) !== String(tenantId)) {
      throw new Error('未找到员工');
    }
    const normalized = normalizeEvidenceItem({ id, sourceType, title, summary, fileId, uri, confidence });
    if (!normalized) {
      throw new Error('请填写证据标题或摘要');
    }

    let row;
    if (normalized.id) {
      row = await models.evidenceItem.findOne({
        where: { id: normalized.id, tenantId, employeeId: String(employeeId) }
      });
      if (!row) {
        throw new Error('证据不存在');
      }
      await row.update({
        sourceType: normalized.sourceType,
        title: normalized.title,
        summary: normalized.summary,
        fileId: normalized.fileId,
        uri: normalized.uri,
        confidence: normalized.confidence
      });
    } else {
      row = await models.evidenceItem.create({
        tenantId,
        employeeId: String(employeeId),
        sourceType: normalized.sourceType,
        title: normalized.title,
        summary: normalized.summary,
        fileId: normalized.fileId,
        uri: normalized.uri,
        confidence: normalized.confidence,
        capturedAt: new Date()
      });
    }

    const linkTaskIds = Array.isArray(taskIds) ? taskIds.map(String).filter(Boolean) : [];
    for (const taskId of linkTaskIds) {
      const found = await models.evidenceTaskLink.findOne({
        where: { tenantId, evidenceItemId: row.id, positionTaskId: taskId }
      });
      if (!found) {
        await models.evidenceTaskLink.create({
          tenantId,
          evidenceItemId: row.id,
          positionTaskId: taskId
        });
      }
    }

    return row.toJSON ? row.toJSON() : row;
  };

  const removeEvidence = async (authenticatePayload, { id, employeeId } = {}) => {
    const { tenantId } = authenticatePayload;
    if (!id) {
      throw new Error('证据ID不能为空');
    }
    const where = { id: String(id), tenantId };
    if (employeeId) {
      where.employeeId = String(employeeId);
    }
    const row = await models.evidenceItem.findOne({ where });
    if (!row) {
      throw new Error('证据不存在');
    }
    await row.destroy();
    return { id: String(id) };
  };

  const checklistItem = (key, label, done) => ({ key, label, done: !!done });

  const hasText = value => {
    if (typeof value === 'string') {
      return value.trim().length > 0;
    }
    if (value && typeof value === 'object') {
      const number = value.number ?? value.phone ?? value.value ?? value.email;
      return number != null && String(number).trim().length > 0;
    }
    return false;
  };

  const hasContent = value => {
    if (Array.isArray(value)) {
      return value.some(item => hasContent(item) || hasText(item));
    }
    if (value && typeof value === 'object') {
      return Object.values(value).some(item => hasContent(item) || hasText(item) || (typeof item === 'number' && Number.isFinite(item)));
    }
    return hasText(value) || (typeof value === 'number' && Number.isFinite(value));
  };

  /**
   * 完善档案生成审核结束后，按本次提交内容估算档案完成度。
   * 六项等权：基础信息、简历、填写信息、AI 面试、就绪度、成长建议。
   */
  const recomputeProfileCompletion = async ({ tenantId, employeeId, assessment } = {}) => {
    const employee = await models.employee.findOne({
      where: { id: employeeId, tenantId },
      include: [models.profile]
    });
    if (!employee) {
      return null;
    }
    const review = assessment?.reviewData && typeof assessment.reviewData === 'object' ? assessment.reviewData : {};
    const reviewEmployee = review.employee && typeof review.employee === 'object' ? review.employee : {};
    const reviewProfile = review.profile && typeof review.profile === 'object' ? review.profile : {};
    const profileData = assessment?.profileData && typeof assessment.profileData === 'object' ? assessment.profileData : {};
    const interview = assessment?.interviewData && typeof assessment.interviewData === 'object' ? assessment.interviewData : {};
    const resumes = employee.resumes || profileData.resumes || [];
    const skillAnalysis = review.skillAnalysis && typeof review.skillAnalysis === 'object' ? review.skillAnalysis : {};
    const aiSuggest = review.aiSuggest && typeof review.aiSuggest === 'object' ? review.aiSuggest : {};

    const hasBasic = hasText(reviewEmployee.name || employee.name) && (hasText(reviewEmployee.phone) || hasContent(reviewEmployee.phone) || hasText(reviewEmployee.email) || hasText(employee.phone) || hasText(employee.email));
    const hasCv = (Array.isArray(resumes) && resumes.length > 0) || !!employee.currentResumeId || hasContent(profileData.resumeParsed);
    const hasSubmittedInfo =
      hasText(reviewEmployee.description) || hasText(reviewEmployee.city) || hasText(reviewEmployee.college) || hasText(reviewEmployee.major) || hasContent(reviewProfile.skills) || hasContent(reviewProfile.intentionPosition);
    const hasInterview = !!(interview.interviewId || hasContent(interview.answers) || hasContent(interview.questionnaire) || (Array.isArray(interview.history) && interview.history.length > 0) || assessment?.clientUserId);
    const hasReadiness = skillAnalysis.readiness != null && skillAnalysis.readiness !== '' && Number.isFinite(Number(skillAnalysis.readiness));
    const hasSuggest = hasContent(aiSuggest.shortTerm) || hasContent(aiSuggest.longTerm) || hasContent(aiSuggest.matchPosition);

    const checklist = [
      checklistItem('basic', '基础信息', hasBasic),
      checklistItem('cv', '简历', hasCv),
      checklistItem('submitted', '填写信息', hasSubmittedInfo),
      checklistItem('ai_interview', 'AI 面试', hasInterview),
      checklistItem('readiness', '就绪度', hasReadiness),
      checklistItem('suggest', '成长建议', hasSuggest)
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
      replaceTaskEvidence,
      saveEvidence,
      removeEvidence,
      recomputeProfileCompletion,
      seedEvidenceFromEmployee
    }
  });
});
