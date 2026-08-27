const fp = require('fastify-plugin');
const omit = require('lodash/omit');
const dayjs = require('dayjs');
const { requestAssessmentProfileFill, normalizeOutputLanguage } = require('../utils/llm-runner');

const FEATURE_KEY = 'Assessment';
const SHORTEN_TTL_HOURS = 24;
const GENERATE_TASK_TYPE = 'assessment-profile-review';

const pickContact = value => {
  if (value == null || value === '') {
    return '';
  }
  if (typeof value === 'string') {
    return value.trim();
  }
  if (typeof value === 'object') {
    const number = value.number ?? value.phone ?? value.value ?? value.email;
    return number != null ? String(number).trim() : '';
  }
  return String(value).trim();
};

/** 邀请用：无区号时默认补 +86，统一为「+区号 号码」 */
const formatPhoneForInvite = value => {
  if (value == null || value === '') {
    return '';
  }
  if (typeof value === 'object') {
    const code = String(value.code ?? value.countryCode ?? '86').replace(/^\+/, '');
    const national = String(value.number ?? value.phone ?? value.value ?? '').replace(/\s+/g, '');
    if (!national) {
      return '';
    }
    return `+${code} ${national}`;
  }
  const raw = String(value).trim();
  if (!raw) {
    return '';
  }
  // 已是「+区号 号码」
  if (/^\+\d+\s+\S/.test(raw)) {
    return raw;
  }
  // +8613800138000 → +86 13800138000
  const compactCn = raw.match(/^\+86(\d+)$/);
  if (compactCn) {
    return `+86 ${compactCn[1]}`;
  }
  if (raw.startsWith('+')) {
    return raw;
  }
  // 无区号：默认 +86
  return `+86 ${raw.replace(/\s+/g, '')}`;
};

const COMPLETED_INTERVIEW_STATUSES = ['completed', 'ended', 'done', 'submitted'];
const ASSESSMENT_DONE_STATUSES = ['generating', 'submitted', 'approved', 'closed'];

const isInterviewCompleted = status => COMPLETED_INTERVIEW_STATUSES.includes(String(status || '').toLowerCase());

const isAssessmentDoneStatus = status => ASSESSMENT_DONE_STATUSES.includes(status);

const archiveCurrentInterview = row => {
  if (!row.inviteCode && !row.shorten && !row.interviewData?.interviewId) {
    return Object.assign({}, row.interviewData || {});
  }
  const interviewStatus = row.interviewData?.interviewStatus || '';
  const entry = {
    projectId: row.projectId || '',
    projectName: row.projectName || '',
    inviteId: row.inviteId || '',
    inviteCode: row.inviteCode || '',
    shorten: row.shorten || '',
    shortenExpiresAt: row.shortenExpiresAt || null,
    clientUserId: row.clientUserId || '',
    interviewStatus,
    interviewId: row.interviewData?.interviewId || '',
    invitedAt: row.interviewData?.invitedAt || null,
    lastSyncAt: row.interviewData?.lastSyncAt || null,
    assessmentStatus: row.status || '',
    completed: isInterviewCompleted(interviewStatus) || isAssessmentDoneStatus(row.status),
    archivedAt: new Date().toISOString()
  };
  const history = Array.isArray(row.interviewData?.history) ? row.interviewData.history.slice() : [];
  history.unshift(entry);
  return Object.assign({}, row.interviewData || {}, { history });
};

const clearInviteFields = row => {
  row.projectId = null;
  row.projectName = null;
  row.inviteId = null;
  row.inviteCode = null;
  row.shorten = null;
  row.shortenExpiresAt = null;
  row.clientUserId = null;
};

const isShortenValid = row => {
  if (!row?.shorten || !row?.shortenExpiresAt) {
    return false;
  }
  return dayjs(row.shortenExpiresAt).isAfter(dayjs());
};

const buildHistoryPreviousInterview = record => ({
  projectName: record.projectName || '',
  inviteCode: record.inviteCode || '',
  interviewStatus: record.interviewStatus || '',
  interviewId: record.interviewId || '',
  invitedAt: record.invitedAt || record.archivedAt || null,
  lastSyncAt: record.lastSyncAt || null,
  completed: record.completed === true || isInterviewCompleted(record.interviewStatus) || isAssessmentDoneStatus(record.assessmentStatus),
  shortenValid: isShortenValid({ shorten: record.shorten, shortenExpiresAt: record.shortenExpiresAt }),
  fromHistory: true
});

const buildPreviousInterview = row => {
  if (row.inviteCode || row.shorten || row.interviewData?.interviewId) {
    const status = row.interviewData?.interviewStatus || '';
    return {
      projectName: row.projectName || '',
      inviteCode: row.inviteCode || '',
      interviewStatus: status,
      interviewId: row.interviewData?.interviewId || '',
      invitedAt: row.interviewData?.invitedAt || null,
      lastSyncAt: row.interviewData?.lastSyncAt || null,
      completed: isInterviewCompleted(status) || isAssessmentDoneStatus(row.status),
      shortenValid: isShortenValid(row),
      fromHistory: false
    };
  }
  const history = row.interviewData?.history || [];
  if (history.length > 0) {
    return buildHistoryPreviousInterview(history[0]);
  }
  return null;
};

const withAssessmentExtras = (rowPublic, row, setting, services) =>
  Object.assign({}, withInterviewRemote(rowPublic, setting, services), {
    shortenValid: isShortenValid(row),
    previousInterview: buildPreviousInterview(row)
  });

const toPublicAssessment = row => {
  if (!row) {
    return null;
  }
  const plain = row.get ? row.get({ plain: true }) : row;
  return {
    id: plain.id,
    status: plain.status,
    projectId: plain.projectId || '',
    projectName: plain.projectName || '',
    inviteId: plain.inviteId || '',
    inviteCode: plain.inviteCode || '',
    shorten: plain.shorten || '',
    shortenExpiresAt: plain.shortenExpiresAt || null,
    clientUserId: plain.clientUserId || '',
    profileData: plain.profileData || {},
    reviewData: plain.reviewData || {},
    generateTaskId: plain.generateTaskId || '',
    interviewData: plain.interviewData || {},
    createdAt: plain.createdAt,
    updatedAt: plain.updatedAt
  };
};

const withInterviewRemote = (rowPublic, setting, services) =>
  Object.assign({}, rowPublic, {
    cdnUrl: setting.cdnUrl || '',
    version: setting.version || '',
    apiUrl: setting.apiUrl || '',
    ajaxBaseUrl: setting.apiUrl ? services.aiInterview.getAjaxBaseUrl(setting.apiUrl) : ''
  });

module.exports = fp(async (fastify, options) => {
  const { models, services } = fastify[options.name];

  const ensureGenerateTask = async row => {
    if (!row?.id) {
      return null;
    }
    if (row.generateTaskId) {
      try {
        const existing = await fastify.task.services.detail({ id: row.generateTaskId });
        if (existing && ['pending', 'running', 'waiting'].includes(existing.status)) {
          return existing;
        }
      } catch (e) {
        // 任务不存在则重建
      }
    }

    const profileData = row.profileData && typeof row.profileData === 'object' ? row.profileData : {};
    let employee = null;
    try {
      const employeeRow = await models.employee.findOne({
        where: { tenantId: row.tenantId, tenantUserId: row.tenantUserId },
        include: [models.profile]
      });
      employee = employeeRow ? employeeRow.get({ plain: true }) : null;
    } catch (e) {
      employee = null;
    }

    const resumes = pickResumeFiles(profileData, employee);
    const resumeParsed = await resolveResumeParsed(profileData, resumes);
    const { resumes: _omitResumes, resumeParsed: _omitParsed, ...submittedInfo } = profileData;
    const resumeFileIds = resumes
      .map(item => item?.id || item?.ossId || item?.fileId)
      .filter(Boolean)
      .map(String);

    const profileName = submittedInfo.name || profileData.name || '';
    const task = await fastify.task.services.create({
      type: GENERATE_TASK_TYPE,
      targetId: String(row.id),
      targetType: 'assessment',
      runnerType: 'manual',
      input: {
        name: profileName ? `完善档案生成审核：${profileName}` : `完善档案生成审核：${row.tenantUserId}`,
        assessmentId: row.id,
        tenantId: row.tenantId,
        tenantUserId: row.tenantUserId,
        // 员工填写信息（不含简历附件/解析缓存字段）
        submittedInfo,
        // 简历解析数据
        resumeParsed: resumeParsed || null,
        // 简历附件
        resumes,
        resumeFileIds
      }
    });
    row.generateTaskId = task.id;
    await row.save();
    return task;
  };

  const enterGenerating = async row => {
    row.status = 'generating';
    await row.save();
    await ensureGenerateTask(row);
    return row;
  };

  const findMine = async authenticatePayload => {
    const { tenantId, id: tenantUserId } = authenticatePayload;
    if (!tenantId || !tenantUserId) {
      return null;
    }
    return models.assessment.findOne({
      where: { tenantId, tenantUserId }
    });
  };

  const saveProfile = async (authenticatePayload, { profileData }) => {
    const { tenantId, id: tenantUserId } = authenticatePayload;
    if (!tenantId || !tenantUserId) {
      throw new Error('未登录租户用户');
    }
    const payload = profileData && typeof profileData === 'object' ? profileData : {};
    let row = await findMine(authenticatePayload);
    if (!row) {
      row = await models.assessment.create({
        tenantId,
        tenantUserId,
        profileData: payload,
        status: 'pending'
      });
    } else {
      row.profileData = Object.assign({}, row.profileData || {}, payload);
      row.changed('profileData', true);
      if (isAssessmentDoneStatus(row.status)) {
        // 生成中/已提交/已通过/已关闭，不再回退
      } else if (!isShortenValid(row)) {
        row.status = 'pending';
      }
      await row.save();
    }
    return toPublicAssessment(row);
  };

  const syncInterviewStatus = async (authenticatePayload, row) => {
    if (!row?.projectId || !(row.inviteCode || row.shorten)) {
      return row;
    }
    if (isAssessmentDoneStatus(row.status)) {
      return row;
    }
    try {
      const list = await services.aiInterview.getInterviewList({
        tenantId: authenticatePayload.tenantId,
        projectId: row.projectId,
        currentPage: 1,
        perPage: 5,
        filter: row.inviteCode ? { code: row.inviteCode } : undefined
      });
      const interview =
        (list?.pageData || []).find(item => {
          if (row.inviteCode && item.code === row.inviteCode) {
            return true;
          }
          if (row.clientUserId && (item.clientUserId === row.clientUserId || item.user?.id === row.clientUserId)) {
            return true;
          }
          return false;
        }) || list?.pageData?.[0];
      if (!interview) {
        return row;
      }
      const interviewStatus = interview.status || interview.interviewStatus;
      row.interviewData = Object.assign({}, row.interviewData || {}, {
        lastSyncAt: new Date().toISOString(),
        interviewStatus,
        interviewId: interview.id || interview.interviewId,
        candidateName: interview.name || interview.user?.name || row.interviewData?.candidateName || '',
        interviewUpdatedAt: interview.updatedAt || interview.updated_at || row.interviewData?.interviewUpdatedAt || null
      });
      row.changed('interviewData', true);
      if (isInterviewCompleted(interviewStatus)) {
        await row.save();
        await enterGenerating(row);
      } else if (row.shorten && row.status === 'pending') {
        row.status = 'interviewing';
        await row.save();
      } else {
        await row.save();
      }
    } catch (e) {
      fastify.log.warn(e, 'sync AI interview status failed');
    }
    return row;
  };

  const detail = async authenticatePayload => {
    let row = await findMine(authenticatePayload);
    if (!row) {
      return null;
    }
    row = await syncInterviewStatus(authenticatePayload, row);
    if (row.status === 'generating' && !row.generateTaskId) {
      await ensureGenerateTask(row);
      row = await findMine(authenticatePayload);
    }
    const setting = await services.aiInterview.detail({ tenantId: authenticatePayload.tenantId });
    return withAssessmentExtras(toPublicAssessment(row), row, setting, services);
  };

  const ensureInvite = async (authenticatePayload, { forceNew = false } = {}) => {
    let row = await findMine(authenticatePayload);
    if (!row) {
      throw new Error('请先完善档案并保存评估记录');
    }

    row = await syncInterviewStatus(authenticatePayload, row);
    if (isAssessmentDoneStatus(row.status)) {
      const setting = await services.aiInterview.detail({ tenantId: authenticatePayload.tenantId });
      return withAssessmentExtras(toPublicAssessment(row), row, setting, services);
    }

    if (forceNew && (row.inviteCode || row.shorten || row.interviewData?.interviewId)) {
      row.interviewData = archiveCurrentInterview(row);
      row.changed('interviewData', true);
      clearInviteFields(row);
      row.status = 'pending';
      await row.save();
    }

    if (!forceNew && isShortenValid(row)) {
      const setting = await services.aiInterview.detail({ tenantId: authenticatePayload.tenantId });
      if (row.status === 'pending') {
        row.status = 'interviewing';
        await row.save();
      }
      return withAssessmentExtras(toPublicAssessment(row), row, setting, services);
    }

    const { binding, setting } = await services.aiInterview.getFeatureBinding({
      tenantId: authenticatePayload.tenantId,
      key: FEATURE_KEY
    });

    const profile = row.profileData || {};
    const name = profile.name || profile.nameEn || 'Candidate';
    const email = pickContact(profile.email) || pickContact(profile.personalEmail);
    const phone = formatPhoneForInvite(profile.phone);
    if (!email && !phone) {
      throw new Error('档案中需要手机号或邮箱才能发起 AI 面试');
    }

    const expires = dayjs().add(SHORTEN_TTL_HOURS, 'hour').toISOString();
    const invite = await services.aiInterview.inviteCandidate({
      tenantId: authenticatePayload.tenantId,
      projectId: binding.projectId,
      name,
      email,
      phone,
      description: `Assessment / tenantUser:${authenticatePayload.id}`,
      expires
    });

    if (!invite?.shorten) {
      throw new Error('AI 面试系统未返回免登录 shorten');
    }

    row.projectId = binding.projectId;
    row.projectName = binding.projectName || '';
    row.inviteId = invite.inviteId || '';
    row.inviteCode = invite.inviteCode || '';
    row.shorten = invite.shorten;
    row.shortenExpiresAt = invite.expires ? new Date(invite.expires) : dayjs(expires).toDate();
    row.clientUserId = invite.clientUserId || '';
    row.status = 'interviewing';
    row.interviewData = Object.assign({}, row.interviewData || {}, {
      invitedAt: new Date().toISOString(),
      inviteExpires: invite.expires || expires
    });
    row.changed('interviewData', true);
    await row.save();

    return withAssessmentExtras(toPublicAssessment(row), row, setting, services);
  };

  const acceptPrevious = async (authenticatePayload, { forceCompleted = false } = {}) => {
    let row = await findMine(authenticatePayload);
    if (!row) {
      throw new Error('评估记录不存在');
    }

    row = await syncInterviewStatus(authenticatePayload, row);
    const previous = buildPreviousInterview(row);
    if (!previous) {
      throw new Error('没有可沿用的面试记录');
    }

    if (previous.fromHistory) {
      const record = row.interviewData.history[0];
      row.projectId = record.projectId || null;
      row.projectName = record.projectName || null;
      row.inviteId = record.inviteId || null;
      row.inviteCode = record.inviteCode || null;
      row.shorten = record.shorten || null;
      row.shortenExpiresAt = record.shortenExpiresAt ? new Date(record.shortenExpiresAt) : null;
      row.clientUserId = record.clientUserId || null;
      const history = Array.isArray(row.interviewData.history) ? row.interviewData.history.slice(1) : [];
      row.interviewData = Object.assign({}, row.interviewData, {
        history,
        interviewStatus: record.interviewStatus || (forceCompleted || previous.completed ? 'completed' : ''),
        interviewId: record.interviewId,
        invitedAt: record.invitedAt,
        lastSyncAt: record.lastSyncAt
      });
      row.changed('interviewData', true);
    }

    const interviewCompleted = forceCompleted || previous.completed || isAssessmentDoneStatus(row.status) || isInterviewCompleted(row.interviewData?.interviewStatus);

    if (interviewCompleted) {
      if (!isInterviewCompleted(row.interviewData?.interviewStatus)) {
        row.interviewData = Object.assign({}, row.interviewData || {}, {
          interviewStatus: 'completed'
        });
        row.changed('interviewData', true);
      }
      await row.save();
      await enterGenerating(row);
    } else if (isShortenValid(row)) {
      row.status = 'interviewing';
      await row.save();
    } else {
      throw new Error('上次面试记录已失效，请重新面试');
    }

    const setting = await services.aiInterview.detail({ tenantId: authenticatePayload.tenantId });
    return withAssessmentExtras(toPublicAssessment(row), row, setting, services);
  };

  const restart = async authenticatePayload => {
    const row = await findMine(authenticatePayload);
    if (!row) {
      throw new Error('评估记录不存在');
    }
    if (row.status !== 'generating') {
      throw new Error('仅生成中状态可重新生成');
    }
    row.interviewData = archiveCurrentInterview(row);
    row.changed('interviewData', true);
    clearInviteFields(row);
    row.status = 'pending';
    await row.save();

    const setting = await services.aiInterview.detail({ tenantId: authenticatePayload.tenantId });
    return withAssessmentExtras(toPublicAssessment(row), row, setting, services);
  };

  const enrichAssessmentRow = (row, employee) => {
    const publicRow = toPublicAssessment(row);
    const profileData = publicRow.profileData || {};
    return Object.assign({}, publicRow, {
      tenantUserId: row.tenantUserId,
      employeeId: employee?.id || null,
      name: profileData.name || employee?.name || '',
      phone: pickContact(profileData.phone) || employee?.phone || '',
      email: pickContact(profileData.email) || employee?.email || ''
    });
  };

  const findById = async (authenticatePayload, id) => {
    const { tenantId } = authenticatePayload;
    if (!tenantId || !id) {
      return null;
    }
    return models.assessment.findOne({
      where: { tenantId, id }
    });
  };

  const loadEmployeeByTenantUserId = async (tenantId, tenantUserId) => {
    if (!tenantUserId) {
      return null;
    }
    return models.employee.findOne({
      where: { tenantId, tenantUserId },
      attributes: ['id', 'name', 'tenantUserId', 'email', 'phone']
    });
  };

  const list = async (authenticatePayload, { filter = {}, perPage = 20, currentPage = 1 } = {}) => {
    const { tenantId } = authenticatePayload;
    if (!tenantId) {
      throw new Error('未登录租户用户');
    }
    const { Op } = fastify.sequelize.Sequelize;
    const whereQuery = { tenantId };

    if (filter.status) {
      whereQuery.status = filter.status;
    }

    if (filter.keyword) {
      const keyword = `%${String(filter.keyword).trim()}%`;
      const matchedEmployees = await models.employee.findAll({
        where: {
          tenantId,
          [Op.or]: [{ name: { [Op.like]: keyword } }, { email: { [Op.like]: keyword } }, { phone: { [Op.like]: keyword } }]
        },
        attributes: ['tenantUserId']
      });
      const matchedIds = matchedEmployees.map(item => item.tenantUserId).filter(Boolean);
      if (matchedIds.length === 0) {
        return { pageData: [], totalCount: 0 };
      }
      whereQuery.tenantUserId = { [Op.in]: matchedIds };
    }

    const pageSize = Math.min(Math.max(Number(perPage) || 20, 1), 100);
    const page = Math.max(Number(currentPage) || 1, 1);
    const { count, rows } = await models.assessment.findAndCountAll({
      where: whereQuery,
      offset: pageSize * (page - 1),
      limit: pageSize,
      order: [
        ['updatedAt', 'DESC'],
        ['id', 'DESC']
      ]
    });

    const tenantUserIds = [...new Set(rows.map(row => row.tenantUserId).filter(Boolean))];
    const employees =
      tenantUserIds.length > 0
        ? await models.employee.findAll({
            where: { tenantId, tenantUserId: { [Op.in]: tenantUserIds } },
            attributes: ['id', 'name', 'tenantUserId', 'email', 'phone']
          })
        : [];
    const employeeMap = new Map(employees.map(item => [item.tenantUserId, item.get({ plain: true })]));

    return {
      pageData: rows.map(row => enrichAssessmentRow(row, employeeMap.get(row.tenantUserId))),
      totalCount: count
    };
  };

  const getDetail = async (authenticatePayload, { id }) => {
    const row = await findById(authenticatePayload, id);
    if (!row) {
      throw new Error('申请记录不存在');
    }
    const { tenantId } = authenticatePayload;
    const employeeRow = await models.employee.findOne({
      where: { tenantId, tenantUserId: row.tenantUserId },
      include: [models.profile]
    });
    const employee = employeeRow ? employeeRow.get({ plain: true }) : null;
    const enriched = enrichAssessmentRow(row, employee);

    const draftSource = row.reviewData && Object.keys(row.reviewData).length > 0 ? row.reviewData : null;
    const mapped = mapProfileDataToEmployeeDraft(row.profileData || {}, employee);
    const draft = draftSource
      ? {
          employee: draftSource.employee || mapped,
          profile: draftSource.profile || mapped.profile
        }
      : {
          employee: mapped,
          profile: mapped.profile
        };

    const profileDetail = await buildProfileDetail(authenticatePayload, {
      assessmentId: row.id,
      employee,
      draft
    });

    return Object.assign({}, enriched, { profileDetail });
  };

  /** 生成中 → 已提交（兼容旧路径；正式流程走 completeGenerate） */
  const markSubmitted = async authenticatePayload => {
    let row = await findMine(authenticatePayload);
    if (!row) {
      throw new Error('评估记录不存在');
    }
    row = await syncInterviewStatus(authenticatePayload, row);
    if (row.status === 'submitted' || row.status === 'approved') {
      return toPublicAssessment(row);
    }
    const canSubmit = row.status === 'generating' || (row.status === 'interviewing' && isInterviewCompleted(row.interviewData?.interviewStatus));
    if (!canSubmit) {
      throw new Error('仅生成中状态可提交申请');
    }
    row.status = 'submitted';
    await row.save();
    return toPublicAssessment(row);
  };

  const buildProfileUpdateFromAssessment = profileData => {
    const data = profileData && typeof profileData === 'object' ? profileData : {};
    const payload = {};
    if (data.skills != null) {
      payload.skills = data.skills;
    }
    if (data.intentionPosition != null) {
      payload.intentionPosition = data.intentionPosition;
    }
    if (data.workPreference != null) {
      payload.workPreference = data.workPreference;
    }
    if (data.linkedin) {
      payload.options = { linkedin: data.linkedin };
    }
    return payload;
  };

  const mapProfileDataToEmployeeDraft = (profileData = {}, employee = null) => {
    const data = profileData && typeof profileData === 'object' ? profileData : {};
    const base = employee || {};
    return {
      name: (typeof data.name === 'string' && data.name.trim()) || base.name || '',
      phone: pickContact(data.phone) || base.phone || '',
      email: pickContact(data.email) || base.email || '',
      personalEmail: base.personalEmail || '',
      gender: base.gender || data.gender || '',
      description: base.description || '',
      city: base.city || data.city || '',
      address: base.address || data.address || '',
      college: base.college || data.college || '',
      major: base.major || data.major || '',
      degree: base.degree != null ? base.degree : data.degree,
      status: base.status || 'ACTIVE',
      tenantOrgIds: Array.isArray(base.tenantOrgIds) ? base.tenantOrgIds : [],
      options: Object.assign({}, base.options || {}),
      profile: {
        skills: data.skills || base.profile?.skills || {},
        intentionPosition: data.intentionPosition || base.profile?.intentionPosition || [],
        workPreference: data.workPreference || base.profile?.workPreference || {},
        options: Object.assign({}, base.profile?.options || {}, data.linkedin ? { linkedin: data.linkedin } : {})
      }
    };
  };

  const pickResumeFiles = (profileData, employee) => {
    const fromProfile = Array.isArray(profileData?.resumes) ? profileData.resumes.filter(item => item && (item.id || item.ossId || item.fileId)) : [];
    if (fromProfile.length) {
      return fromProfile;
    }
    const fromEmployee = Array.isArray(employee?.resumes) ? employee.resumes.filter(item => item && (item.id || item.ossId || item.fileId)) : [];
    return fromEmployee;
  };

  const resolveResumeParsed = async (profileData, resumes) => {
    if (profileData?.resumeParsed && typeof profileData.resumeParsed === 'object') {
      return profileData.resumeParsed;
    }
    const fileId = resumes[0]?.id || resumes[0]?.ossId || resumes[0]?.fileId;
    if (!fileId) {
      return null;
    }
    try {
      const file = await fastify.fileManager.services.getFileInstance({ id: fileId });
      const hash = file?.hash;
      if (!hash) {
        return null;
      }
      const cached = await models.resume.findOne({ where: { fileMD5: hash } });
      return cached ? cached.get({ plain: true }) : null;
    } catch (e) {
      fastify.log.warn(e, 'load resume parse cache failed');
      return null;
    }
  };

  /** 生成任务右侧 TalentProfile 用的档案详情（合并 draft，含 enums） */
  const buildProfileDetail = async (authenticatePayload, { assessmentId, employee, draft }) => {
    let base = null;
    if (employee?.id) {
      const detailRow = await services.employee.detail(authenticatePayload, { id: employee.id });
      base = detailRow.get ? detailRow.get({ plain: true }) : detailRow;
    } else {
      base = {
        id: `draft-${assessmentId}`,
        name: '',
        status: 'PRE_EMPLOYEE',
        profile: {},
        performances: [],
        options: {},
        tenantOrgIds: [],
        orgEnums: [],
        positionEnums: [],
        aiSuggest: null
      };
    }

    const empDraft = Object.assign({}, draft?.employee || {});
    delete empDraft.profile;
    const profileDraft = draft?.profile || {};

    const merged = Object.assign({}, base, empDraft, {
      id: base.id,
      options: Object.assign({}, base.options || {}, empDraft.options || {}),
      tenantOrgIds: Array.isArray(empDraft.tenantOrgIds) ? empDraft.tenantOrgIds : base.tenantOrgIds || [],
      profile: Object.assign({}, base.profile || {}, profileDraft, {
        options: Object.assign({}, base.profile?.options || {}, profileDraft.options || {})
      }),
      performances: base.performances || [],
      aiSuggest: base.aiSuggest || null
    });

    const positionId = merged.options?.position;
    const normalizePositionRef = item => {
      if (item == null || item === '') return null;
      if (typeof item === 'object') {
        return item.id || item.name || item.value || null;
      }
      return item;
    };
    const intentionRefs = (merged.profile?.intentionPosition || []).map(normalizePositionRef).filter(Boolean);
    const positionIds = [typeof positionId === 'object' && positionId ? positionId.id : positionId, ...intentionRefs].filter(Boolean);
    const positionNames = [...intentionRefs, ...(merged.profile?.promotionHistory || []).map(item => item.occupation)].filter(Boolean);

    let positionEnums = base.positionEnums || [];
    if (positionIds.length || positionNames.length) {
      positionEnums = await services.position.enums(authenticatePayload, {
        ids: positionIds,
        names: positionNames
      });
    }

    const orgIds = Array.isArray(merged.tenantOrgIds) ? merged.tenantOrgIds : [];
    let orgEnums = base.orgEnums || [];
    if (orgIds.length) {
      orgEnums = await fastify.tenant.services.org.enums(authenticatePayload, { ids: orgIds });
    }

    merged.positionEnums = positionEnums;
    merged.orgEnums = orgEnums;
    return merged;
  };

  const toReviewData = profileDetail => {
    if (!profileDetail) {
      return { employee: {}, profile: {} };
    }
    const { profile, performances, orgEnums, positionEnums, aiSuggest, createdAt, updatedAt, deletedAt, ...employee } = profileDetail;
    if (employee.id != null && String(employee.id).startsWith('draft-')) {
      delete employee.id;
    }
    const cleanProfile = omit(profile || {}, ['id', 'employeeId', 'tenantId', 'createdAt', 'updatedAt', 'deletedAt']);
    return {
      employee,
      profile: cleanProfile
    };
  };

  const getGenerateTaskContext = async (userInfo, { taskId }) => {
    if (!taskId) {
      throw new Error('任务ID不能为空');
    }
    const task = await fastify.task.services.detail({ id: taskId });
    if (!task) {
      throw new Error('任务不存在');
    }
    if (task.type !== GENERATE_TASK_TYPE) {
      throw new Error('任务类型不正确');
    }
    const tenantId = task.input?.tenantId;
    const assessmentId = task.input?.assessmentId || task.targetId;
    if (!tenantId || !assessmentId) {
      throw new Error('任务缺少评估上下文');
    }
    const row = await models.assessment.findOne({ where: { id: assessmentId, tenantId } });
    if (!row) {
      throw new Error('申请记录不存在');
    }
    const employeeRow = await models.employee.findOne({
      where: { tenantId, tenantUserId: row.tenantUserId },
      include: [models.profile]
    });
    const employee = employeeRow ? employeeRow.get({ plain: true }) : null;
    const assessment = enrichAssessmentRow(row, employee);
    const draftSource = row.reviewData && Object.keys(row.reviewData).length > 0 ? row.reviewData : null;
    const mapped = mapProfileDataToEmployeeDraft(row.profileData || {}, employee);
    const draft = draftSource
      ? {
          employee: draftSource.employee || mapped,
          profile: draftSource.profile || mapped.profile
        }
      : {
          employee: mapped,
          profile: mapped.profile
        };

    const authenticatePayload = Object.assign({}, userInfo, { tenantId });
    const profileDetail = await buildProfileDetail(authenticatePayload, {
      assessmentId,
      employee,
      draft
    });

    const resumes = pickResumeFiles(row.profileData || {}, employee);
    const resumeParsed = await resolveResumeParsed(row.profileData || {}, resumes);
    const { resumes: _r, resumeParsed: _rp, ...submittedProfileData } = row.profileData || {};

    return {
      task: {
        id: task.id,
        status: task.status,
        type: task.type,
        input: task.input || {}
      },
      assessment,
      employee,
      draft,
      profileDetail,
      resumes,
      resumeParsed,
      submittedInfo: submittedProfileData
    };
  };

  /** 完成生成任务：写入 reviewData，状态改为 submitted，并完成手动任务 */
  const completeGenerate = async (userInfo, { taskId, reviewData }) => {
    if (!taskId) {
      throw new Error('任务ID不能为空');
    }
    const task = await fastify.task.services.detail({ id: taskId });
    if (!task) {
      throw new Error('任务不存在');
    }
    if (task.type !== GENERATE_TASK_TYPE) {
      throw new Error('任务类型不正确');
    }
    if (task.status !== 'pending') {
      throw new Error('任务已处理，请勿重复完成');
    }

    const tenantId = task.input?.tenantId;
    const assessmentId = task.input?.assessmentId || task.targetId;
    const row = await models.assessment.findOne({ where: { id: assessmentId, tenantId } });
    if (!row) {
      throw new Error('申请记录不存在');
    }
    if (row.status !== 'generating' && row.status !== 'submitted') {
      throw new Error('仅生成中状态可完成生成任务');
    }

    const payload = reviewData && typeof reviewData === 'object' ? reviewData : {};
    const employeePart = payload.employee && typeof payload.employee === 'object' ? payload.employee : payload;
    const name = typeof employeePart.name === 'string' ? employeePart.name.trim() : '';
    const phone = pickContact(employeePart.phone);
    const email = pickContact(employeePart.email);
    if (!name) {
      throw new Error('请填写姓名');
    }
    if (!phone && !email) {
      throw new Error('请至少填写手机号或邮箱');
    }

    row.reviewData = {
      employee: Object.assign({}, employeePart, { name, phone, email }),
      profile: payload.profile && typeof payload.profile === 'object' ? payload.profile : mapProfileDataToEmployeeDraft(row.profileData || {}).profile
    };
    row.changed('reviewData', true);
    row.status = 'submitted';
    row.generateTaskId = task.id;
    await row.save();

    await fastify.task.services.complete({
      id: task.id,
      userId: userInfo?.id,
      status: 'success',
      output: {
        assessmentId: row.id,
        tenantId,
        reviewData: row.reviewData
      }
    });

    return toPublicAssessment(row);
  };

  const buildAiFillSchemaHint = () => ({
    employee: {
      name: 'string',
      phone: 'string|object',
      email: 'string',
      gender: 'M|F|N|string',
      description: 'string',
      city: 'string',
      address: 'string',
      college: 'string',
      major: 'string',
      degree: 'number|string',
      options: 'object'
    },
    profile: {
      skills: { work_related: ['string'], cert_mapped: ['string'], interest_strength: ['string'] },
      intentionPosition: ['string'],
      workPreference: 'object',
      options: { linkedin: 'string' }
    }
  });

  const shapeDraftForAi = profileDetail => {
    if (!profileDetail) {
      return { employee: {}, profile: {} };
    }
    if (profileDetail.employee || profileDetail.profile) {
      return {
        employee: profileDetail.employee && typeof profileDetail.employee === 'object' ? profileDetail.employee : {},
        profile: profileDetail.profile && typeof profileDetail.profile === 'object' ? profileDetail.profile : {}
      };
    }
    const { profile, performances, orgEnums, positionEnums, aiSuggest, createdAt, updatedAt, deletedAt, ...employee } = profileDetail;
    return {
      employee,
      profile: profile || {}
    };
  };

  const normalizeAiFillResult = (raw, draft, profileDetail) => {
    const data = raw && typeof raw === 'object' ? raw : {};
    const empRaw = data.employee && typeof data.employee === 'object' ? data.employee : data;
    const profileRaw = data.profile && typeof data.profile === 'object' ? data.profile : {};
    const draftEmployee = draft?.employee && typeof draft.employee === 'object' ? draft.employee : {};
    const draftProfile = draft?.profile && typeof draft.profile === 'object' ? draft.profile : {};
    const base = profileDetail || {};

    const pickStr = (...values) => {
      for (const value of values) {
        if (typeof value === 'string' && value.trim()) {
          return value.trim();
        }
      }
      return '';
    };

    const employee = Object.assign({}, base, draftEmployee, empRaw, {
      id: base.id,
      name: pickStr(empRaw.name, draftEmployee.name, base.name),
      phone: empRaw.phone != null && empRaw.phone !== '' ? empRaw.phone : (draftEmployee.phone ?? base.phone ?? ''),
      email: pickStr(empRaw.email, draftEmployee.email, base.email),
      gender: pickStr(empRaw.gender, draftEmployee.gender, base.gender),
      description: pickStr(empRaw.description, draftEmployee.description, base.description),
      city: pickStr(empRaw.city, draftEmployee.city, base.city),
      address: pickStr(empRaw.address, draftEmployee.address, base.address),
      college: pickStr(empRaw.college, draftEmployee.college, base.college),
      major: pickStr(empRaw.major, draftEmployee.major, base.major),
      degree: empRaw.degree != null ? empRaw.degree : (draftEmployee.degree ?? base.degree),
      options: Object.assign({}, base.options || {}, draftEmployee.options || {}, empRaw.options || {}),
      orgEnums: base.orgEnums,
      positionEnums: base.positionEnums,
      performances: base.performances || [],
      aiSuggest: base.aiSuggest || null
    });

    const profile = Object.assign({}, base.profile || {}, draftProfile, profileRaw, {
      skills: profileRaw.skills || draftProfile.skills || base.profile?.skills || {},
      intentionPosition: Array.isArray(profileRaw.intentionPosition) ? profileRaw.intentionPosition : Array.isArray(draftProfile.intentionPosition) ? draftProfile.intentionPosition : base.profile?.intentionPosition || [],
      workPreference: Object.assign({}, base.profile?.workPreference || {}, draftProfile.workPreference || {}, profileRaw.workPreference || {}),
      options: Object.assign({}, base.profile?.options || {}, draftProfile.options || {}, profileRaw.options || {})
    });

    return Object.assign({}, employee, { profile });
  };

  /** AI 填充档案草稿：不落库，仅返回可写回右侧 TalentProfile 的数据 */
  const aiFillGenerate = async (userInfo, { taskId, draft, language, resumeParsed, submittedInfo }) => {
    if (!taskId) {
      throw new Error('任务ID不能为空');
    }
    const context = await getGenerateTaskContext(userInfo, { taskId });
    const outputLanguage = normalizeOutputLanguage(language || 'zh-CN');
    const promptContext = {
      outputLanguage,
      assessment: {
        id: context.assessment?.id,
        name: context.assessment?.name,
        phone: context.assessment?.phone,
        email: context.assessment?.email,
        projectName: context.assessment?.projectName
      },
      resumes: (context.resumes || []).map(item => ({
        id: item.id || item.ossId || item.fileId,
        filename: item.filename || item.originalName || item.name
      })),
      resumeParsed: resumeParsed || context.resumeParsed || null,
      submittedInfo: submittedInfo || context.submittedInfo || null
    };

    const draftPayload = shapeDraftForAi(draft);
    const raw = await requestAssessmentProfileFill(fastify, {
      schema: buildAiFillSchemaHint(),
      context: promptContext,
      draft: draftPayload,
      language: outputLanguage
    });

    return {
      language: outputLanguage,
      data: normalizeAiFillResult(raw, draftPayload, context.profileDetail)
    };
  };

  const approve = async (authenticatePayload, { id }) => {
    const { tenantId } = authenticatePayload;
    const row = await findById(authenticatePayload, id);
    if (!row) {
      throw new Error('申请记录不存在');
    }
    if (row.status !== 'submitted') {
      throw new Error('仅已提交状态可通过');
    }

    const reviewEmployee = row.reviewData?.employee || {};
    const reviewProfile = row.reviewData?.profile || {};
    const profileData = row.profileData || {};
    const name = (typeof reviewEmployee.name === 'string' && reviewEmployee.name.trim()) || (typeof profileData.name === 'string' ? profileData.name.trim() : '');
    const phone = pickContact(reviewEmployee.phone) || pickContact(profileData.phone);
    const email = pickContact(reviewEmployee.email) || pickContact(profileData.email);
    if (!name) {
      throw new Error('申请缺少有效姓名');
    }
    if (!phone && !email) {
      throw new Error('申请缺少有效手机号或邮箱');
    }

    const employeeFields = Object.assign({}, reviewEmployee, {
      name,
      phone: phone || '',
      email: email || ''
    });
    delete employeeFields.id;
    delete employeeFields.tenantId;
    delete employeeFields.tenantUserId;
    delete employeeFields.profile;

    let employee = await models.employee.findOne({
      where: { tenantId, tenantUserId: row.tenantUserId }
    });

    if (!employee) {
      employee = await services.employee.create(
        authenticatePayload,
        Object.assign({}, employeeFields, {
          tenantUserId: row.tenantUserId,
          status: employeeFields.status || 'ACTIVE'
        })
      );
    } else {
      const updates = Object.assign({}, employeeFields, { id: employee.id });
      if (!updates.phone && !updates.email) {
        updates.phone = employee.phone || '';
        updates.email = employee.email || '';
      }
      await services.employee.save(authenticatePayload, updates);
    }

    const rawProfileUpdate = Object.keys(reviewProfile).length > 0 ? reviewProfile : buildProfileUpdateFromAssessment(profileData);
    const profileUpdate = omit(rawProfileUpdate || {}, ['id', 'employeeId', 'tenantId', 'createdAt', 'updatedAt', 'deletedAt']);
    if (profileUpdate && Object.keys(profileUpdate).length > 0) {
      if (profileUpdate.options) {
        const existingProfile = await models.profile.findOne({
          where: { employeeId: employee.id, tenantId }
        });
        profileUpdate.options = Object.assign({}, existingProfile?.options || {}, profileUpdate.options);
      }
      // id 必须放在最后，避免 profile.id（档案主键）覆盖员工 id
      await services.employee.saveProfile(authenticatePayload, Object.assign({}, profileUpdate, { id: employee.id }));
    }

    row.status = 'approved';
    await row.save();

    const linked = await loadEmployeeByTenantUserId(tenantId, row.tenantUserId);
    return enrichAssessmentRow(row, linked ? linked.get({ plain: true }) : { id: employee.id, name, phone, email, tenantUserId: row.tenantUserId });
  };

  const reject = async (authenticatePayload, { id }) => {
    const row = await findById(authenticatePayload, id);
    if (!row) {
      throw new Error('申请记录不存在');
    }
    if (row.status !== 'submitted') {
      throw new Error('仅已提交状态可拒绝');
    }
    row.status = 'closed';
    await row.save();
    const employee = await loadEmployeeByTenantUserId(authenticatePayload.tenantId, row.tenantUserId);
    return enrichAssessmentRow(row, employee ? employee.get({ plain: true }) : null);
  };

  const saveReviewData = async (authenticatePayload, { id, reviewData, profileDetail }) => {
    const row = await findById(authenticatePayload, id);
    if (!row) {
      throw new Error('申请记录不存在');
    }
    if (row.status !== 'submitted') {
      throw new Error('仅已提交状态可编辑审核档案');
    }
    const payload = reviewData && typeof reviewData === 'object' ? reviewData : toReviewData(profileDetail);
    const employeePart = payload.employee && typeof payload.employee === 'object' ? payload.employee : {};
    const profilePart = payload.profile && typeof payload.profile === 'object' ? payload.profile : {};
    const name = typeof employeePart.name === 'string' ? employeePart.name.trim() : '';
    const phone = pickContact(employeePart.phone);
    const email = pickContact(employeePart.email);
    if (!name) {
      throw new Error('请填写姓名');
    }
    if (!phone && !email) {
      throw new Error('请至少填写手机号或邮箱');
    }
    row.reviewData = {
      employee: Object.assign({}, employeePart, { name, phone, email }),
      profile: profilePart
    };
    row.changed('reviewData', true);
    await row.save();
    return getDetail(authenticatePayload, { id: row.id });
  };

  Object.assign(services, {
    assessment: {
      saveProfile,
      detail,
      ensureInvite,
      acceptPrevious,
      restart,
      list,
      getDetail,
      markSubmitted,
      getGenerateTaskContext,
      completeGenerate,
      aiFillGenerate,
      saveReviewData,
      approve,
      reject
    }
  });
});
