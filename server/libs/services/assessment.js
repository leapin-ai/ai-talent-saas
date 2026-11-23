const fp = require('fastify-plugin');
const omit = require('lodash/omit');
const { requestAssessmentProfileFill, normalizeOutputLanguage } = require('../utils/llm-runner');
const { extractInterviewSignals, runTalentInsightFill } = require('../utils/talent-insight');
const { mergeVideoTranscriptsIntoInterview } = require('../utils/merge-video-transcripts');
const { PROFILE_COMPLETION_FIELDS, normalizeProfileCompletionPercent } = require('../utils/profile-completion');

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

module.exports = fp(async (fastify, options) => {
  const { models, services } = fastify[options.name];

  const ensureGenerateTask = async (row, { forceNew = false } = {}) => {
    if (!row?.id) {
      return null;
    }
    if (row.generateTaskId) {
      try {
        const existing = await fastify.task.services.detail({ id: row.generateTaskId });
        if (existing && ['pending', 'running', 'waiting'].includes(existing.status)) {
          if (!forceNew) {
            return existing;
          }
          if (['pending', 'running'].includes(existing.status) && fastify.task?.services?.cancel) {
            try {
              await fastify.task.services.cancel({ id: row.generateTaskId });
            } catch (e) {
              fastify.log.warn({ err: e, taskId: row.generateTaskId }, 'cancel assessment generate task failed');
            }
          }
        }
      } catch (e) {
        // 任务不存在则重建
      }
    }

    const profileData = row.profileData && typeof row.profileData === 'object' ? row.profileData : {};
    let employee = null;
    try {
      if (row.tenantUserId) {
        const employeeRow = await models.employee.findOne({
          where: { tenantId: row.tenantId, tenantUserId: row.tenantUserId },
          include: [models.profile]
        });
        employee = employeeRow ? employeeRow.get({ plain: true }) : null;
      } else if (row.interviewData?.collectInviteId && models.talentCollectInvite) {
        const invite = await models.talentCollectInvite.findByPk(String(row.interviewData.collectInviteId));
        if (invite?.employeeId) {
          const employeeRow = await models.employee.findByPk(invite.employeeId, {
            include: [models.profile]
          });
          employee = employeeRow ? employeeRow.get({ plain: true }) : null;
        }
      } else if (row.interviewData?.employeeId) {
        const employeeRow = await models.employee.findOne({
          where: { id: String(row.interviewData.employeeId), tenantId: row.tenantId },
          include: [models.profile]
        });
        employee = employeeRow ? employeeRow.get({ plain: true }) : null;
      }
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

    const profileName = submittedInfo.name || profileData.name || employee?.name || '';
    const task = await fastify.task.services.create({
      type: GENERATE_TASK_TYPE,
      targetId: String(row.id),
      targetType: 'assessment',
      runnerType: 'manual',
      input: {
        name: profileName ? `完善档案生成审核：${profileName}` : `完善档案生成审核：${row.tenantUserId || row.interviewData?.collectInviteId || row.id}`,
        assessmentId: row.id,
        tenantId: row.tenantId,
        tenantUserId: row.tenantUserId || null,
        collectInviteId: row.interviewData?.collectInviteId ? String(row.interviewData.collectInviteId) : null,
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

  const enterGenerating = async (row, { forceNew = false } = {}) => {
    row.status = 'generating';
    await row.save();
    await ensureGenerateTask(row, { forceNew });
    return row;
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

  const loadEmployeeByTenantUserId = async (tenantId, tenantUserId) => {
    if (!tenantUserId) {
      return null;
    }
    return models.employee.findOne({
      where: { tenantId, tenantUserId },
      attributes: ['id', 'name', 'tenantUserId', 'email', 'phone']
    });
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

    const empDraft = omit(draft?.employee || {}, ['profile', ...PROFILE_COMPLETION_FIELDS]);
    const profileDraft = draft?.profile || {};

    const merged = Object.assign({}, base, empDraft, {
      id: base.id,
      options: Object.assign({}, base.options || {}, empDraft.options || {}),
      tenantOrgIds: Array.isArray(empDraft.tenantOrgIds) ? empDraft.tenantOrgIds : base.tenantOrgIds || [],
      profile: Object.assign({}, base.profile || {}, profileDraft, {
        options: Object.assign({}, base.profile?.options || {}, profileDraft.options || {})
      }),
      performances: base.performances || [],
      aiSuggest: draft?.aiSuggest || base.aiSuggest || null,
      skillAnalysisDraft: draft?.skillAnalysis || null,
      profileCompletionOverride: normalizeProfileCompletionPercent(draft?.profileCompletionPercent)
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
    let employee = null;
    try {
      if (row.tenantUserId) {
        const employeeRow = await models.employee.findOne({
          where: { tenantId, tenantUserId: row.tenantUserId },
          include: [models.profile]
        });
        employee = employeeRow ? employeeRow.get({ plain: true }) : null;
      } else if (row.interviewData?.collectInviteId && models.talentCollectInvite) {
        const invite = await models.talentCollectInvite.findByPk(String(row.interviewData.collectInviteId));
        if (invite?.employeeId) {
          const employeeRow = await models.employee.findByPk(invite.employeeId, {
            include: [models.profile]
          });
          employee = employeeRow ? employeeRow.get({ plain: true }) : null;
        }
      } else if (row.interviewData?.employeeId) {
        const employeeRow = await models.employee.findOne({
          where: { id: String(row.interviewData.employeeId), tenantId },
          include: [models.profile]
        });
        employee = employeeRow ? employeeRow.get({ plain: true }) : null;
      }
    } catch (e) {
      employee = null;
    }
    const assessment = enrichAssessmentRow(row, employee);
    const draftSource = row.reviewData && Object.keys(row.reviewData).length > 0 ? row.reviewData : null;
    const mapped = mapProfileDataToEmployeeDraft(row.profileData || {}, employee);
    const draft = draftSource
      ? {
          employee: draftSource.employee || mapped,
          profile: draftSource.profile || mapped.profile,
          aiSuggest: draftSource.aiSuggest || null,
          skillAnalysis: draftSource.skillAnalysis || null,
          profileCompletionPercent: draftSource.profileCompletionPercent ?? null
        }
      : {
          employee: mapped,
          profile: mapped.profile,
          aiSuggest: null,
          skillAnalysis: null,
          profileCompletionPercent: null
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

    let interview = null;
    let interviewError = null;
    let apiHost = '';
    let cdnUrl = '';
    let version = '';
    let videoTranscripts = null;
    let videoAsrStatus = null;
    let exportPosition = null;
    let exportCompany = null;
    let interviewId = row.clientUserId || row.interviewData?.interviewId || null;
    try {
      const companyRow = await fastify.tenant.services.company.detail({ tenantId });
      if (companyRow) {
        exportCompany = {
          id: companyRow.id,
          name: companyRow.name || '',
          fullName: companyRow.fullName || '',
          logo: companyRow.logo || null,
          industry: companyRow.industry || '',
          scale: companyRow.scale || '',
          address: companyRow.address || '',
          phone: companyRow.phone || '',
          email: companyRow.email || '',
          website: companyRow.website || '',
          foundedDate: companyRow.foundedDate || null,
          description: companyRow.description || '',
          companyTags: companyRow.companyTags || []
        };
      }
    } catch (e) {
      exportCompany = null;
    }
    try {
      const setting = await services.aiInterview.detail({ tenantId });
      cdnUrl = setting?.cdnUrl || '';
      version = setting?.version || '';
      apiHost = setting?.apiUrl ? services.aiInterview.getAjaxBaseUrl(setting.apiUrl) : '';

      // 采集邀请触发的任务：assessment 上可能尚未回写 clientUserId，从邀请记录解析
      let collectInviteRow = null;
      if (row.interviewData?.collectInviteId && models.talentCollectInvite) {
        collectInviteRow = await models.talentCollectInvite.findByPk(String(row.interviewData.collectInviteId));
      }
      if (!interviewId && collectInviteRow) {
        const invite = collectInviteRow;
        if (invite.clientUserId) {
          interviewId = String(invite.clientUserId);
        } else if (invite.interviewId) {
          interviewId = String(invite.interviewId);
        } else if (invite.projectId) {
          const listRes = await services.aiInterview.getInterviewList({
            tenantId,
            projectId: invite.projectId,
            currentPage: 1,
            perPage: 20,
            filter: invite.inviteCode ? { code: invite.inviteCode } : undefined
          });
          const matched =
            (listRes?.pageData || []).find(item => {
              if (invite.inviteCode && item.code === invite.inviteCode) {
                return true;
              }
              if (invite.email && (item.email === invite.email || item.user?.email === invite.email)) {
                return true;
              }
              if (invite.phone && (item.phone === invite.phone || item.user?.phone === invite.phone)) {
                return true;
              }
              return false;
            }) || listRes?.pageData?.[0];
          interviewId = matched?.id || matched?.clientUserId || matched?.interviewId || null;
          if (interviewId) {
            interviewId = String(interviewId);
          }
        }
        if (interviewId && !row.clientUserId) {
          row.clientUserId = interviewId;
          row.interviewData = Object.assign({}, row.interviewData || {}, {
            interviewId: row.interviewData?.interviewId || interviewId
          });
          row.changed('interviewData', true);
          await row.save();
        }
      }

      if (collectInviteRow?.interviewData?.videoTranscripts) {
        videoTranscripts = collectInviteRow.interviewData.videoTranscripts;
        videoAsrStatus = collectInviteRow.interviewData.videoAsrStatus || null;
      }

      const positionId = collectInviteRow?.positionId || task.input?.positionId || null;
      if (positionId && services.position?.detail) {
        const positionRow = await services.position.detail({ tenantId }, { id: String(positionId) });
        const plain = positionRow?.get ? positionRow.get({ plain: true }) : positionRow;
        if (plain) {
          exportPosition = {
            id: plain.id,
            name: plain.name,
            description: plain.description || '',
            requirement: plain.requirement || '',
            developmentGoal: plain.developmentGoal || '',
            tenantOrgId: plain.tenantOrgId ?? null,
            language: plain.language || null,
            locationType: plain.locationType || null,
            location: plain.location || {},
            capacity: plain.capacity || '',
            salary: plain.salary || {},
            status: plain.status || null,
            orgEnums: positionRow.getDataValue?.('orgEnums') || plain.orgEnums || []
          };
        }
      }

      if (!interviewId) {
        interviewError = '缺少面试 clientUserId';
      } else {
        const interviewRaw = await services.aiInterview.getInterviewDetail({ tenantId, id: interviewId });
        interview = mergeVideoTranscriptsIntoInterview(interviewRaw, videoTranscripts);
      }
    } catch (error) {
      interviewError = error?.message || '拉取面试详情失败';
    }

    // 历史评估邀请只带入库数据，不逐条拉 AI 面试详情
    let collectInvites = [];
    let questionnaires = [];
    if (employee?.id) {
      const inviteRows = await models.talentCollectInvite.findAll({
        where: { tenantId, employeeId: String(employee.id), inviteType: 'employee' },
        order: [['createdAt', 'ASC']]
      });
      collectInvites = inviteRows.map(item => ({
        id: item.id,
        positionId: item.positionId,
        projectName: item.projectName || '',
        status: item.status,
        invitedAt: item.createdAt,
        completedAt: item.interviewData?.completedAt || null,
        profileData: item.profileData || {},
        videoTranscripts: item.interviewData?.videoTranscripts || null
      }));
      questionnaires = await services.employeeQuestionnaire.listSubmitted({ tenantId, employeeId: employee.id });
    }

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
      submittedInfo: submittedProfileData,
      position: exportPosition,
      company: exportCompany,
      interview,
      interviewError,
      videoTranscripts,
      videoAsrStatus,
      collectInvites,
      questionnaires,
      apiHost,
      cdnUrl,
      version
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
    const isReviewShape = payload.employee && typeof payload.employee === 'object';
    const employeePart = isReviewShape ? payload.employee : payload;
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
      employee: Object.assign({}, omit(employeePart, PROFILE_COMPLETION_FIELDS), { name, phone, email }),
      profile: payload.profile && typeof payload.profile === 'object' ? payload.profile : mapProfileDataToEmployeeDraft(row.profileData || {}).profile,
      aiSuggest: payload.aiSuggest && typeof payload.aiSuggest === 'object' ? payload.aiSuggest : null,
      skillAnalysis: payload.skillAnalysis && typeof payload.skillAnalysis === 'object' ? payload.skillAnalysis : null,
      // 扁平 payload 顶层的 profileCompletionPercent 是员工表旧值，不当作人工完成度
      profileCompletionPercent: isReviewShape ? normalizeProfileCompletionPercent(payload.profileCompletionPercent) : null
    };
    row.changed('reviewData', true);
    row.status = 'submitted';
    row.generateTaskId = task.id;
    await row.save();
    try {
      let employeeId = null;
      const linked = await loadEmployeeByTenantUserId(tenantId, row.tenantUserId);
      if (linked?.id) {
        employeeId = linked.id;
      } else if (row.interviewData?.collectInviteId && models.talentCollectInvite) {
        const invite = await models.talentCollectInvite.findByPk(String(row.interviewData.collectInviteId));
        if (invite?.employeeId) {
          employeeId = invite.employeeId;
        }
      } else if (row.interviewData?.employeeId) {
        employeeId = String(row.interviewData.employeeId);
      }
      if (employeeId && services.workforce) {
        const employee = linked || (await models.employee.findByPk(employeeId));
        if (employee) {
          await services.workforce.seedEvidenceFromEmployee({ tenantId, employee, assessment: row });
        }
        await services.workforce.recomputeProfileCompletion({ tenantId, employeeId, assessment: row });
      }
      // 完成生成后立刻把就绪度/未来任务落到员工档案，避免「任务里填了、档案里全空」
      const reviewSkillAnalysis = row.reviewData?.skillAnalysis;
      const positionRef = row.reviewData?.employee?.options?.position || linked?.options?.position;
      const positionId = typeof positionRef === 'object' && positionRef ? positionRef.id || positionRef.value : positionRef;
      if (employeeId && reviewSkillAnalysis && typeof reviewSkillAnalysis === 'object' && positionId && services.position?.skillAnalysisSave) {
        try {
          await services.position.skillAnalysisSave(
            { tenantId, id: userInfo?.id },
            {
              positionId: String(positionId),
              employeeId: String(employeeId),
              readiness: reviewSkillAnalysis.readiness,
              summary: reviewSkillAnalysis.summary,
              metrics: reviewSkillAnalysis.metrics,
              skills: reviewSkillAnalysis.skills,
              priorityGaps: reviewSkillAnalysis.priorityGaps,
              keySkillGaps: reviewSkillAnalysis.keySkillGaps,
              developmentPlan: reviewSkillAnalysis.developmentPlan,
              replaceReadiness: true
            }
          );
        } catch (error) {
          fastify.log.warn({ err: error }, 'completeGenerate skillAnalysisSave failed');
        }
      }
    } catch (error) {
      fastify.log.warn({ err: error }, 'profile completion after generate failed');
    }

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

    try {
      const collectInviteId = row.interviewData?.collectInviteId;
      if (collectInviteId && models.talentCollectInvite) {
        const invite = await models.talentCollectInvite.findOne({
          where: { id: String(collectInviteId), tenantId }
        });
        if (invite && (invite.status === 'done' || invite.status === 'ended')) {
          invite.status = 'ended';
          invite.interviewData = Object.assign({}, invite.interviewData || {}, {
            analysisTaskId: String(task.id),
            analysisCompletedAt: new Date().toISOString()
          });
          invite.changed('interviewData', true);
          await invite.save();
        }
      }
    } catch (error) {
      fastify.log.warn({ err: error }, 'mark talent collect invite ended after generate failed');
    }

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

  const resolvePositionBrief = async (authenticatePayload, profileDetail) => {
    const ref = profileDetail?.options?.position;
    const positionId = typeof ref === 'object' && ref ? ref.id || ref.value : ref;
    if (!positionId) {
      return null;
    }
    try {
      const position = await services.position.detail(authenticatePayload, { id: String(positionId) });
      const plain = position.get ? position.get({ plain: true }) : position;
      return {
        id: plain.id,
        name: plain.name,
        description: plain.description,
        requirement: plain.requirement,
        developmentGoal: plain.developmentGoal,
        skill: plain.skill,
        language: plain.language
      };
    } catch (e) {
      return { id: String(positionId), name: typeof ref === 'object' ? ref.name || '' : '' };
    }
  };

  /**
   * 根据面试问卷/作答(含视频转写)、简历解析、填写信息生成就绪度 + 成长/匹配。
   * 默认不落库，返回给前端写回草稿；persist=true 且存在员工+岗位时写入正式表。
   */
  const generateTalentInsight = async (userInfo, { taskId, language, resumeParsed, submittedInfo, draft, persist }) => {
    if (!taskId) {
      throw new Error('任务ID不能为空');
    }
    const context = await getGenerateTaskContext(userInfo, { taskId });
    const interviewSignals = extractInterviewSignals(context.interview);
    const authenticatePayload = Object.assign({}, userInfo, { tenantId: context.task?.input?.tenantId || userInfo.tenantId });
    const position = await resolvePositionBrief(authenticatePayload, context.profileDetail);

    if (!context.interview && !(resumeParsed || context.resumeParsed) && !(submittedInfo || context.submittedInfo)) {
      throw new Error('缺少可用的面试、简历或填写信息，无法生成洞察');
    }

    const promptContext = {
      assessment: {
        id: context.assessment?.id,
        name: context.assessment?.name,
        projectName: context.assessment?.projectName
      },
      employee: {
        id: context.employee?.id || null,
        name: context.profileDetail?.name || context.employee?.name || context.assessment?.name || '',
        phone: context.profileDetail?.phone || context.assessment?.phone || '',
        email: context.profileDetail?.email || context.assessment?.email || ''
      },
      position,
      interviewSignals,
      interviewError: context.interviewError || null,
      resumeParsed: resumeParsed || context.resumeParsed || null,
      submittedInfo: submittedInfo || context.submittedInfo || null
    };

    const draftPayload = {
      readiness: draft?.skillAnalysisDraft || draft?.skillAnalysis || context.profileDetail?.skillAnalysisDraft || null,
      aiSuggest: draft?.aiSuggest || context.profileDetail?.aiSuggest || null
    };

    const filled = await runTalentInsightFill(fastify, {
      language: language || context.profileDetail?.language || 'zh-CN',
      context: promptContext,
      draft: draftPayload
    });

    let persisted = null;
    if (persist && context.employee?.id) {
      try {
        await services.employee.saveAiSuggest(authenticatePayload, {
          id: context.employee.id,
          shortTerm: filled.aiSuggest.shortTerm,
          longTerm: filled.aiSuggest.longTerm,
          matchPosition: filled.aiSuggest.matchPosition
        });
        if (position?.id) {
          persisted = await services.position.skillAnalysisSave(authenticatePayload, {
            positionId: String(position.id),
            employeeId: String(context.employee.id),
            readiness: filled.readiness.readiness,
            summary: filled.readiness.summary,
            metrics: filled.readiness.metrics,
            skills: filled.readiness.skills,
            priorityGaps: filled.readiness.priorityGaps,
            keySkillGaps: filled.readiness.keySkillGaps,
            developmentPlan: filled.readiness.developmentPlan
          });
        }
      } catch (error) {
        fastify.log.warn({ err: error }, 'generateTalentInsight persist failed');
      }
    }

    return {
      language: filled.language,
      readiness: filled.readiness,
      aiSuggest: filled.aiSuggest,
      persisted,
      signals: {
        hasInterview: !!context.interview,
        interviewError: context.interviewError || null,
        questionnaireAnswered: !!(interviewSignals.questionnaireAnswers && Object.keys(interviewSignals.questionnaireAnswers).length),
        answerCount: interviewSignals.answers.length,
        hasResumeParsed: !!(resumeParsed || context.resumeParsed),
        hasSubmittedInfo: !!(submittedInfo || context.submittedInfo)
      }
    };
  };

  /**
   * 完善档案生成审核：一键填充档案草稿 + 就绪度/成长/匹配（不落库）。
   * 档案填充与洞察并行；洞察缺上下文时不阻断档案填充结果。
   */
  const aiFillAndInsightGenerate = async (userInfo, { taskId, draft, language, resumeParsed, submittedInfo, persist = false }) => {
    if (!taskId) {
      throw new Error('任务ID不能为空');
    }

    const [fillSettled, insightSettled] = await Promise.allSettled([
      aiFillGenerate(userInfo, { taskId, draft, language, resumeParsed, submittedInfo }),
      generateTalentInsight(userInfo, { taskId, language, resumeParsed, submittedInfo, draft, persist: !!persist })
    ]);

    if (fillSettled.status === 'rejected' && insightSettled.status === 'rejected') {
      throw fillSettled.reason || insightSettled.reason || new Error('AI 填充失败');
    }
    if (fillSettled.status === 'rejected') {
      throw fillSettled.reason || new Error('AI 填充档案失败');
    }

    const fillResult = fillSettled.value;
    const insightResult = insightSettled.status === 'fulfilled' ? insightSettled.value : null;
    const insightError = insightSettled.status === 'rejected' ? insightSettled.reason?.message || String(insightSettled.reason || '生成洞察失败') : null;

    return {
      language: fillResult.language || insightResult?.language || normalizeOutputLanguage(language || 'zh-CN'),
      data: fillResult.data,
      readiness: insightResult?.readiness || null,
      aiSuggest: insightResult?.aiSuggest || null,
      persisted: insightResult?.persisted || null,
      signals: insightResult?.signals || null,
      insightError
    };
  };

  Object.assign(services, {
    assessment: {
      getGenerateTaskContext,
      enterGenerating,
      completeGenerate,
      aiFillGenerate,
      aiFillAndInsightGenerate,
      generateTalentInsight
    }
  });
});
