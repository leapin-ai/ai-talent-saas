const fp = require('fastify-plugin');
const dayjs = require('dayjs');
const get = require('lodash/get');
const ensureSlash = require('@kne/ensure-slash');
const { mergeVideoTranscriptsIntoInterview } = require('../utils/merge-video-transcripts');

const MESSAGE_CODE = 'INVITETALENTCOLLECT';
const SHORTEN_TTL_HOURS = 24;
const COLLECT_INVITE_SHORTEN_TYPE = 'talentCollectInvite';
const COLLECT_INVITE_LINK_TTL_DAYS = 90;
const VIDEO_ASR_TASK_TYPE = 'invite-video-asr';

/** 系统语言：仅 zh-CN 用中文模版，其余（含 en-US、未知）默认英文 */
const normalizeMessageLanguage = language => (language === 'zh-CN' ? 'zh-CN' : 'en-US');

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

const formatPhone = value => {
  const raw = pickContact(value);
  if (!raw) {
    return '';
  }
  return raw.replace(/\s+/g, '');
};

const resolvePositionId = value => {
  if (value == null || value === '') {
    return null;
  }
  const id = typeof value === 'object' ? (value.id ?? value.value) : value;
  if (id == null || id === '') {
    return null;
  }
  return String(id);
};

const resolveProject = assessmentProject => {
  if (assessmentProject == null || assessmentProject === '') {
    return null;
  }
  if (typeof assessmentProject === 'object') {
    const id = assessmentProject.id ?? assessmentProject.value;
    if (!id) {
      return null;
    }
    return {
      projectId: String(id),
      projectName: String(assessmentProject.name || assessmentProject.label || '').trim()
    };
  }
  return { projectId: String(assessmentProject), projectName: '' };
};

module.exports = fp(async (fastify, options) => {
  const { models, services } = fastify[options.name];
  const { Op } = fastify.sequelize.Sequelize;

  const requireShortenServices = () => {
    const shortenServices = fastify.shorten?.services;
    if (!shortenServices?.sign || !shortenServices?.decode) {
      throw new Error('短链服务未就绪');
    }
    return shortenServices;
  };

  const resolveInviteLinkExpires = deadline => {
    if (deadline) {
      return dayjs(deadline).valueOf();
    }
    return dayjs().add(COLLECT_INVITE_LINK_TTL_DAYS, 'day').valueOf();
  };

  const signCollectInviteCode = async row => {
    const shortenServices = requireShortenServices();
    return shortenServices.sign(
      JSON.stringify({
        type: COLLECT_INVITE_SHORTEN_TYPE,
        inviteId: String(row.id)
      }),
      resolveInviteLinkExpires(row.deadline)
    );
  };

  const buildInviteUrl = row => `${ensureSlash(fastify.config.ORIGIN || '')}/collect-profile?code=${encodeURIComponent(row.code)}`;

  const ensureInviteCode = async row => {
    if (row.code) {
      return row;
    }
    row.code = await signCollectInviteCode(row);
    await row.save();
    return row;
  };

  const toPublic = row => {
    if (!row) {
      return null;
    }
    const plain = typeof row.get === 'function' ? row.get({ plain: true }) : row;
    return {
      id: plain.id,
      inviteType: plain.inviteType,
      positionId: plain.positionId,
      employeeId: plain.employeeId || null,
      name: plain.name || '',
      email: plain.email || '',
      phone: plain.phone || '',
      projectId: plain.projectId || '',
      projectName: plain.projectName || '',
      deadline: plain.deadline || null,
      status: plain.status,
      profileData: plain.profileData || {},
      inviteId: plain.inviteId || '',
      inviteCode: plain.inviteCode || '',
      code: plain.code || '',
      shorten: plain.shorten || '',
      shortenExpiresAt: plain.shortenExpiresAt || null,
      clientUserId: plain.clientUserId || '',
      interviewId: plain.interviewId || '',
      interviewData: plain.interviewData || {},
      createdAt: plain.createdAt,
      updatedAt: plain.updatedAt
    };
  };

  const findByCode = async code => {
    if (!code) {
      throw new Error('邀请链接无效');
    }
    const shortenServices = requireShortenServices();
    let payload;
    try {
      payload = JSON.parse(await shortenServices.decode(String(code)));
    } catch (e) {
      throw new Error('邀请链接无效或已失效');
    }
    if (payload?.type !== COLLECT_INVITE_SHORTEN_TYPE || !payload.inviteId) {
      throw new Error('邀请链接无效或已失效');
    }
    const row = await models.talentCollectInvite.findByPk(payload.inviteId);
    if (!row) {
      throw new Error('邀请链接无效或已失效');
    }
    if (row.status === 'canceled') {
      throw new Error('邀请已取消');
    }
    if (row.deadline && dayjs(row.deadline).isBefore(dayjs())) {
      throw new Error('邀请已过期');
    }
    return row;
  };

  const sendNotify = async ({ row, position, tenant, language: languageInput }) => {
    const companyName = tenant?.company?.name || tenant?.name || '';
    const tenantName = tenant?.name || '';
    const themeColor = tenant?.themeColor || '#4183F0';
    const inviteUrl = buildInviteUrl(row);
    const isManager = row.inviteType === 'manager';
    const inviteTypeLabel = isManager ? 'manager' : 'employee';
    const deadlineText = row.deadline ? dayjs(row.deadline).format('YYYY-MM-DD HH:mm') : '';
    const contactEmail = pickContact(tenant?.company?.email) || pickContact(tenant?.email) || pickContact(tenant?.company?.contactEmail) || '';
    const language = normalizeMessageLanguage(languageInput);
    const teamName = companyName || tenantName || (language === 'en-US' ? 'Project Team' : '项目组');
    const orgLabel = companyName || tenantName;
    const subject =
      language === 'en-US'
        ? isManager
          ? `${orgLabel} Future Workforce Readiness | Manager Role Interview`
          : `${orgLabel} Future Workforce Readiness | Employee Role Interview`
        : isManager
          ? `${orgLabel} 未来人才准备度 | 经理岗位访谈`
          : `${orgLabel} 未来人才准备度 | 员工岗位访谈`;
    const messageCode = `${MESSAGE_CODE}[${language}]`;
    const props = {
      name: row.name,
      companyName,
      tenantName,
      teamName,
      positionName: position?.name || '',
      inviteUrl,
      inviteType: inviteTypeLabel,
      isManager,
      inviteTypeLabel: language === 'en-US' ? (isManager ? 'Line Manager' : 'Employee') : isManager ? '直线经理' : '员工',
      deadlineText,
      durationMinutes: '',
      contactEmail,
      themeColor,
      subject,
      language
    };
    const email = pickContact(row.email);
    const phone = formatPhone(row.phone);
    if (!email && !phone) {
      throw new Error('手机号或邮箱不能同时为空');
    }
    if (email) {
      await fastify.message.services.sendMessage({
        name: email,
        type: 0,
        code: messageCode,
        props,
        options: { title: subject }
      });
    }
    if (phone) {
      await fastify.message.services.sendMessage({
        name: phone,
        type: 1,
        code: messageCode,
        props,
        options: { title: subject }
      });
    }
    return inviteUrl;
  };

  const findEmployeeByContact = async ({ tenantId, email, phone }) => {
    const where = { tenantId, [Op.or]: [] };
    if (email) {
      where[Op.or].push({ email });
    }
    if (phone) {
      where[Op.or].push({ phone });
    }
    if (!where[Op.or].length) {
      return null;
    }
    return models.employee.findOne({ where });
  };

  const ensureEmployeeForInvite = async (authenticatePayload, { position, name, email, phone }) => {
    const { tenantId } = authenticatePayload;
    const existing = await findEmployeeByContact({ tenantId, email, phone });
    const positionId = String(position.id);
    if (existing) {
      const currentPos = resolvePositionId(get(existing, 'options.position'));
      if (currentPos && currentPos !== positionId) {
        throw new Error('该员工不属于当前岗位');
      }
      if (!currentPos) {
        const options = Object.assign({}, existing.options || {}, { position: positionId });
        existing.set('options', options);
        existing.changed('options', true);
        if (position.tenantOrgId) {
          const orgIds = Array.isArray(existing.tenantOrgIds) ? existing.tenantOrgIds.map(String) : [];
          if (!orgIds.includes(String(position.tenantOrgId))) {
            existing.tenantOrgIds = [...orgIds, String(position.tenantOrgId)];
          }
        }
        await existing.save();
      }
      return existing;
    }
    return services.employee.create(authenticatePayload, {
      name,
      email: email || undefined,
      phone: phone || undefined,
      tenantOrgIds: position.tenantOrgId ? [position.tenantOrgId] : [],
      options: { position: positionId },
      status: 'ACTIVE'
    });
  };

  const findOpenInviteForParticipant = async ({ tenantId, positionId, inviteType, email, phone, employeeId }) => {
    const where = {
      tenantId,
      positionId,
      inviteType,
      status: { [Op.notIn]: ['done', 'ended', 'canceled'] }
    };
    const or = [];
    if (employeeId) {
      or.push({ employeeId });
    }
    if (email) {
      or.push({ email });
    }
    if (phone) {
      or.push({ phone });
    }
    if (or.length === 0) {
      return null;
    }
    where[Op.or] = or;
    return models.talentCollectInvite.findOne({
      where,
      order: [
        ['createdAt', 'DESC'],
        ['id', 'DESC']
      ]
    });
  };

  const clearInterviewBindingIfProjectChanged = (row, project) => {
    if (String(row.projectId || '') === String(project.projectId)) {
      return false;
    }
    row.projectId = project.projectId;
    row.projectName = project.projectName || '';
    // 项目变更后旧 AI 面试邀约失效，需重新 ensureInvite
    row.inviteId = null;
    row.inviteCode = null;
    row.shorten = null;
    row.shortenExpiresAt = null;
    row.clientUserId = null;
    row.interviewId = null;
    row.interviewData = {};
    row.changed('interviewData', true);
    return true;
  };

  const send = async (authenticatePayload, body = {}) => {
    const { tenantId } = authenticatePayload;
    const language = normalizeMessageLanguage(body.language);
    const inviteType = body.inviteType === 'manager' ? 'manager' : 'employee';
    const positionId = resolvePositionId(body.positionId);
    if (!positionId) {
      throw new Error('岗位不能为空');
    }
    const project = resolveProject(body.assessmentProject);
    if (!project?.projectId) {
      throw new Error('评估项目不能为空');
    }
    // 仅有 id 时尽量补全项目名称（兼容旧端只传 value）
    if (!project.projectName) {
      try {
        const listRes = await services.aiInterview.getProjects({
          tenantId,
          currentPage: 1,
          perPage: 50,
          filter: { scene: 'dataCollection' }
        });
        const matched = (listRes?.pageData || []).find(item => String(item.id) === String(project.projectId));
        if (matched?.name) {
          project.projectName = String(matched.name).trim();
        }
      } catch (e) {
        // ignore name lookup failure
      }
    }
    const position = await models.position.findByPk(positionId);
    if (!position || String(position.tenantId) !== String(tenantId)) {
      throw new Error('未找到岗位');
    }

    const participants = Array.isArray(body.participants) ? body.participants : [];
    const success = [];
    const failed = [];

    let tenant = null;
    try {
      tenant = await fastify.tenant.services.tenant.detail({ id: tenantId });
    } catch (e) {
      tenant = { id: tenantId, name: '' };
    }

    for (let index = 0; index < participants.length; index++) {
      const item = participants[index] || {};
      const name = String(item.name || '').trim();
      const email = pickContact(item.email);
      const phone = formatPhone(item.phone);
      try {
        if (!name) {
          throw new Error('姓名不能为空');
        }
        if (!email && !phone) {
          throw new Error('手机号或邮箱不能同时为空');
        }

        let employeeId = null;
        if (inviteType === 'employee') {
          const employee = await ensureEmployeeForInvite(authenticatePayload, { position, name, email, phone });
          employeeId = employee.id;
        }

        // 二次邀请：复用未完成记录并更新项目，避免仍走旧项目
        let row = await findOpenInviteForParticipant({
          tenantId,
          positionId,
          inviteType,
          email,
          phone,
          employeeId
        });
        if (row) {
          clearInterviewBindingIfProjectChanged(row, project);
          row.projectId = project.projectId;
          row.projectName = project.projectName || row.projectName || '';
          row.name = name;
          row.email = email || row.email || '';
          row.phone = phone || row.phone || '';
          row.employeeId = employeeId || row.employeeId;
          row.deadline = body.deadline ? new Date(body.deadline) : row.deadline;
          if (row.status === 'done') {
            row.status = 'invited';
          } else if (!['invited', 'opened', 'filling', 'interviewing'].includes(row.status)) {
            row.status = 'invited';
          }
          await row.save();
          await ensureInviteCode(row);
        } else {
          row = await models.talentCollectInvite.create({
            tenantId,
            inviteType,
            positionId,
            employeeId,
            name,
            email: email || '',
            phone: phone || '',
            projectId: project.projectId,
            projectName: project.projectName,
            deadline: body.deadline ? new Date(body.deadline) : null,
            status: 'invited',
            profileData: {}
          });
          await ensureInviteCode(row);
        }

        // 仅员工邀请推进职位「访谈进行中」；经理邀请不改职位 assessmentStatus
        if (inviteType !== 'manager' && services.workforce?.markInterviewsInProgress) {
          await services.workforce.markInterviewsInProgress({ tenantId, positionId });
        }

        const inviteUrl = await sendNotify({ row, position, tenant, language });
        success.push({ index, id: row.id, code: row.code, inviteUrl, employeeId });
      } catch (e) {
        failed.push({ index, reason: e.message || '发送失败' });
      }
    }

    return { success, failed };
  };

  /**
   * 将采集邀请进度同步到评估状态：
   * - 打开面试短链 / 进入面试：assessment.status=interviewing（有 tenantUserId 时）
   * - 完成面试：assessment.status=submitted，并刷新 updatedAt（人才列表 lastAssessment=assessed）
   * - 始终写入 employee.options.talentCollectAssessment，供无账号员工展示进度
   */
  const syncEmployeeAssessmentFromInvite = async (row, { stage } = {}) => {
    if (!row?.employeeId) {
      return;
    }
    const employee = await models.employee.findByPk(row.employeeId);
    if (!employee) {
      return;
    }

    const nextStage = stage === 'done' ? 'done' : 'inProgress';
    const options = Object.assign({}, employee.options || {}, {
      talentCollectAssessment: {
        status: nextStage,
        inviteStatus: row.status,
        inviteId: row.id,
        positionId: row.positionId != null ? String(row.positionId) : null,
        updatedAt: new Date().toISOString()
      }
    });
    employee.set('options', options);
    employee.changed('options', true);
    await employee.save();

    const tenantUserId = employee.tenantUserId;
    if (tenantUserId == null || tenantUserId === '') {
      return;
    }

    let assessment = await models.assessment.findOne({
      where: {
        tenantId: row.tenantId,
        tenantUserId
      }
    });

    if (!assessment) {
      assessment = await models.assessment.create({
        tenantId: row.tenantId,
        tenantUserId,
        status: 'pending',
        projectId: row.projectId || null,
        projectName: row.projectName || '',
        inviteId: row.inviteId || null,
        inviteCode: row.inviteCode || null,
        shorten: row.shorten || null,
        shortenExpiresAt: row.shortenExpiresAt || null,
        clientUserId: row.clientUserId || null,
        profileData: row.profileData && typeof row.profileData === 'object' ? row.profileData : {},
        interviewData: Object.assign({}, row.interviewData || {}, {
          source: 'talentCollectInvite',
          collectInviteId: String(row.id),
          interviewId: row.interviewId || null
        })
      });
    }

    const inviteProfile = row.profileData && typeof row.profileData === 'object' ? row.profileData : {};
    if (Object.keys(inviteProfile).length) {
      assessment.profileData = inviteProfile;
      assessment.changed('profileData', true);
    }

    if (nextStage === 'done') {
      assessment.projectId = row.projectId || assessment.projectId;
      assessment.projectName = row.projectName || assessment.projectName || '';
      assessment.inviteId = row.inviteId || assessment.inviteId;
      assessment.inviteCode = row.inviteCode || assessment.inviteCode;
      assessment.shorten = row.shorten || assessment.shorten;
      assessment.shortenExpiresAt = row.shortenExpiresAt || assessment.shortenExpiresAt;
      assessment.clientUserId = row.clientUserId || assessment.clientUserId;
      assessment.interviewData = Object.assign({}, assessment.interviewData || {}, row.interviewData || {}, {
        source: 'talentCollectInvite',
        collectInviteId: String(row.id),
        interviewId: row.interviewId || assessment.interviewData?.interviewId || null,
        interviewStatus: 'completed'
      });
      assessment.changed('interviewData', true);
      await assessment.save();
      return assessment;
    }

    if (['pending'].includes(assessment.status) || !assessment.status) {
      assessment.status = 'interviewing';
    }
    // 二次邀请换项目时必须覆盖，勿用 || 保留旧项目
    if (row.projectId) {
      assessment.projectId = row.projectId;
      assessment.projectName = row.projectName || '';
    }
    assessment.inviteId = row.inviteId || assessment.inviteId;
    assessment.inviteCode = row.inviteCode || assessment.inviteCode;
    assessment.shorten = row.shorten || assessment.shorten;
    assessment.shortenExpiresAt = row.shortenExpiresAt || assessment.shortenExpiresAt;
    assessment.clientUserId = row.clientUserId || assessment.clientUserId;
    assessment.interviewData = Object.assign({}, assessment.interviewData || {}, row.interviewData || {}, {
      source: 'talentCollectInvite',
      collectInviteId: String(row.id),
      interviewId: row.interviewId || assessment.interviewData?.interviewId || null,
      interviewStatus: nextStage === 'done' ? 'completed' : assessment.interviewData?.interviewStatus
    });
    assessment.changed('interviewData', true);
    // 触发 updatedAt，完成面试后 lastAssessment 计为 assessed
    assessment.changed('status', true);
    await assessment.save();
    return assessment;
  };

  const detailByCode = async ({ code }) => {
    const row = await findByCode(code);
    // 打开采集短链：invited → opened，并回写员工评估进度
    if (row.status === 'invited') {
      row.status = 'opened';
      await row.save();
      await syncEmployeeAssessmentFromInvite(row, { stage: 'opened' });
    }
    const position = await models.position.findByPk(row.positionId);
    let employee = null;
    if (row.employeeId) {
      employee = await models.employee.findByPk(row.employeeId);
    }
    let tenant = null;
    try {
      tenant = await fastify.tenant.services.tenant.detail({ id: row.tenantId });
    } catch (e) {
      tenant = null;
    }
    const setting = await services.aiInterview.detail({ tenantId: row.tenantId });
    return {
      ...toPublic(row),
      position: position
        ? {
            id: position.id,
            name: position.name,
            tenantOrgId: position.tenantOrgId || null
          }
        : null,
      employee: employee
        ? {
            id: employee.id,
            name: employee.name,
            email: employee.email,
            phone: employee.phone
          }
        : null,
      tenant: tenant
        ? {
            id: tenant.id,
            name: tenant.name,
            companyName: tenant.company?.name || '',
            logo: tenant.logo || tenant.company?.logo || null,
            themeColor: tenant.themeColor || null
          }
        : null,
      aiInterview: {
        cdnUrl: setting?.cdnUrl || '',
        version: setting?.version || '',
        apiUrl: setting?.apiUrl || '',
        ajaxBaseUrl: setting?.apiUrl ? services.aiInterview.getAjaxBaseUrl(setting.apiUrl) : ''
      }
    };
  };

  const saveProfile = async ({ code, profileData }) => {
    const row = await findByCode(code);
    const next = profileData && typeof profileData === 'object' ? { ...profileData } : {};
    // 邀请三字段只读：不入库到 profileData，也不更新 name/email/phone 列
    delete next.name;
    delete next.email;
    delete next.phone;
    row.profileData = next;
    row.changed('profileData', true);
    if (row.status === 'invited' || row.status === 'opened') {
      row.status = 'filling';
    }
    await row.save();
    return toPublic(row);
  };

  const parseResume = async ({ code, id, force = false }) => {
    await findByCode(code);
    if (!id) {
      throw new Error('文件ID不能为空');
    }
    return services.resume.parseFileId({ id, force: !!force });
  };

  const isShortenValid = row => {
    if (!row?.shorten || !row?.shortenExpiresAt) {
      return false;
    }
    return dayjs(row.shortenExpiresAt).isAfter(dayjs());
  };

  const ensureInvite = async ({ code, forceNew = false } = {}) => {
    const row = await findByCode(code);
    const setting = await services.aiInterview.detail({ tenantId: row.tenantId });

    if (!forceNew && isShortenValid(row)) {
      if (['invited', 'opened', 'filling'].includes(row.status)) {
        row.status = 'interviewing';
        await row.save();
      }
      await syncEmployeeAssessmentFromInvite(row, { stage: 'opened' });
      return Object.assign({}, toPublic(row), {
        cdnUrl: setting?.cdnUrl || '',
        version: setting?.version || '',
        apiUrl: setting?.apiUrl || '',
        ajaxBaseUrl: setting?.apiUrl ? services.aiInterview.getAjaxBaseUrl(setting.apiUrl) : ''
      });
    }

    if (!row.projectId) {
      throw new Error('未配置评估项目');
    }
    const email = pickContact(row.email);
    const phone = formatPhone(row.phone);
    if (!email && !phone) {
      throw new Error('邀请联系方式缺失，无法发起面试');
    }

    const expires = dayjs().add(SHORTEN_TTL_HOURS, 'hour').toISOString();
    const invite = await services.aiInterview.inviteCandidate({
      tenantId: row.tenantId,
      projectId: row.projectId,
      name: row.name,
      email,
      phone,
      description: `TalentCollect / ${row.inviteType} / position:${row.positionId}`,
      expires,
      needLoginShorten: true,
      // open-api 后续支持：不发送面试提醒邮件
      needNotice: false
    });

    if (!invite?.shorten) {
      throw new Error('AI 面试系统未返回免登录 shorten');
    }

    row.inviteId = invite.inviteId || '';
    row.inviteCode = invite.inviteCode || '';
    row.shorten = invite.shorten;
    row.shortenExpiresAt = invite.expires ? new Date(invite.expires) : dayjs(expires).toDate();
    row.clientUserId = invite.clientUserId || '';
    row.interviewId = invite.interviewId || invite.clientUserId || row.interviewId || '';
    row.status = 'interviewing';
    row.interviewData = Object.assign({}, row.interviewData || {}, {
      invitedAt: new Date().toISOString(),
      inviteExpires: invite.expires || expires
    });
    row.changed('interviewData', true);
    await row.save();
    await syncEmployeeAssessmentFromInvite(row, { stage: 'opened' });

    return Object.assign({}, toPublic(row), {
      cdnUrl: setting?.cdnUrl || '',
      version: setting?.version || '',
      apiUrl: setting?.apiUrl || '',
      ajaxBaseUrl: setting?.apiUrl ? services.aiInterview.getAjaxBaseUrl(setting.apiUrl) : ''
    });
  };

  const markInterviewDone = async ({ code, interviewId } = {}) => {
    const row = await findByCode(code);
    if (interviewId) {
      row.interviewId = String(interviewId);
    }
    row.status = 'done';
    row.interviewData = Object.assign({}, row.interviewData || {}, {
      interviewStatus: 'completed',
      completedAt: new Date().toISOString()
    });
    row.changed('interviewData', true);
    await row.save();
    await syncEmployeeAssessmentFromInvite(row, { stage: 'done' });
    return toPublic(row);
  };

  const findAssessmentForInvite = async row => {
    if (!row?.tenantId || !row?.id) {
      return null;
    }
    const inviteId = String(row.id);
    let assessment = await models.assessment.findOne({
      where: {
        tenantId: row.tenantId,
        interviewData: {
          [Op.contains]: { collectInviteId: inviteId }
        }
      },
      order: [
        ['updatedAt', 'DESC'],
        ['id', 'DESC']
      ]
    });
    if (assessment) {
      return assessment;
    }
    // 兼容历史：collectInviteId 曾以非字符串写入
    assessment = await models.assessment.findOne({
      where: {
        tenantId: row.tenantId,
        interviewData: {
          [Op.contains]: { collectInviteId: row.id }
        }
      },
      order: [
        ['updatedAt', 'DESC'],
        ['id', 'DESC']
      ]
    });
    if (assessment) {
      return assessment;
    }
    if (!row.employeeId) {
      return null;
    }
    const employee = await models.employee.findByPk(row.employeeId);
    if (!employee?.tenantUserId) {
      return null;
    }
    return models.assessment.findOne({
      where: {
        tenantId: row.tenantId,
        tenantUserId: employee.tenantUserId
      }
    });
  };

  /** 按邀请创建/回填 assessment（无租户账号也可），供触发分析任务 */
  const ensureAssessmentFromInvite = async row => {
    if (!row?.tenantId || !row?.id) {
      throw new Error('邀请记录无效');
    }
    let assessment = await findAssessmentForInvite(row);
    let tenantUserId = null;
    if (row.employeeId) {
      const employee = await models.employee.findByPk(row.employeeId);
      tenantUserId = employee?.tenantUserId || null;
    }

    const inviteProfile = row.profileData && typeof row.profileData === 'object' ? row.profileData : {};
    const inviteName = row.name || inviteProfile.name || '';
    const profileData = Object.keys(inviteProfile).length
      ? Object.assign({}, inviteProfile, inviteName && !inviteProfile.name ? { name: inviteName } : {})
      : inviteName
        ? { name: inviteName, email: row.email || '', phone: row.phone || '' }
        : { name: row.name || '', email: row.email || '', phone: row.phone || '' };

    const interviewPatch = Object.assign({}, row.interviewData || {}, {
      source: 'talentCollectInvite',
      collectInviteId: String(row.id),
      interviewId: row.interviewId || null,
      interviewStatus: row.status === 'done' || row.status === 'ended' ? 'completed' : row.interviewData?.interviewStatus
    });

    if (!assessment) {
      assessment = await models.assessment.create({
        tenantId: row.tenantId,
        tenantUserId: tenantUserId || null,
        status: 'pending',
        projectId: row.projectId || null,
        projectName: row.projectName || '',
        inviteId: row.inviteId || null,
        inviteCode: row.inviteCode || null,
        shorten: row.shorten || null,
        shortenExpiresAt: row.shortenExpiresAt || null,
        clientUserId: row.clientUserId || null,
        profileData,
        interviewData: interviewPatch
      });
      return assessment;
    }

    if (!assessment.tenantUserId && tenantUserId) {
      assessment.tenantUserId = tenantUserId;
    }
    if (Object.keys(profileData).length) {
      assessment.profileData = Object.assign({}, assessment.profileData || {}, profileData);
      assessment.changed('profileData', true);
    }
    assessment.projectId = row.projectId || assessment.projectId;
    assessment.projectName = row.projectName || assessment.projectName || '';
    assessment.inviteId = row.inviteId || assessment.inviteId;
    assessment.inviteCode = row.inviteCode || assessment.inviteCode;
    assessment.shorten = row.shorten || assessment.shorten;
    assessment.shortenExpiresAt = row.shortenExpiresAt || assessment.shortenExpiresAt;
    assessment.clientUserId = row.clientUserId || assessment.clientUserId;
    assessment.interviewData = Object.assign({}, assessment.interviewData || {}, interviewPatch);
    assessment.changed('interviewData', true);
    await assessment.save();
    return assessment;
  };

  /** 已有成功转写后：创建完善岗位分析 / 完善档案生成审核 */
  const createRefineOrGenerateTask = async (authenticatePayload, { id } = {}) => {
    const { tenantId } = authenticatePayload;
    if (!tenantId) {
      throw new Error('未登录租户用户');
    }
    if (!id) {
      throw new Error('缺少邀请记录ID');
    }
    const row = await models.talentCollectInvite.findOne({
      where: { id: String(id), tenantId }
    });
    if (!row) {
      throw new Error('邀请记录不存在');
    }
    if (row.status !== 'done') {
      throw new Error('仅已完成的邀请可触发分析任务');
    }

    if (row.inviteType === 'manager') {
      if (!row.positionId) {
        throw new Error('邀请缺少岗位，无法触发岗位分析');
      }
      if (!services.position?.startRefineAnalysis) {
        throw new Error('岗位分析服务未就绪');
      }
      const result = await services.position.startRefineAnalysis(authenticatePayload, {
        id: String(row.positionId),
        forceNew: true,
        collectInviteId: String(row.id)
      });
      const taskId = result?.task?.id || null;
      row.interviewData = Object.assign({}, row.interviewData || {}, {
        analysisTaskId: taskId,
        analysisKind: 'position-analysis-review',
        analysisStartedAt: new Date().toISOString()
      });
      row.changed('interviewData', true);
      await row.save();
      return {
        invite: toPublic(row),
        taskId,
        assessmentId: null,
        analysisKind: 'position-analysis-review',
        asrStatus: 'succeeded'
      };
    }

    await syncEmployeeAssessmentFromInvite(row, { stage: 'done' });
    const assessment = await ensureAssessmentFromInvite(row);
    if (!assessment) {
      throw new Error('无法创建分析任务所需的评估记录');
    }

    if (!services.assessment?.enterGenerating) {
      throw new Error('分析任务服务未就绪');
    }
    await services.assessment.enterGenerating(assessment, { forceNew: true });
    await assessment.reload();

    row.interviewData = Object.assign({}, row.interviewData || {}, {
      analysisTaskId: assessment.generateTaskId || null,
      analysisKind: 'assessment-profile-review',
      analysisStartedAt: new Date().toISOString()
    });
    row.changed('interviewData', true);
    await row.save();

    return {
      invite: toPublic(row),
      taskId: assessment.generateTaskId || null,
      assessmentId: assessment.id,
      analysisKind: 'assessment-profile-review',
      asrStatus: 'succeeded'
    };
  };

  /**
   * 已完成邀请：先视频转写（invite-video-asr），成功后再触发完善任务。
   * 若已有成功转写则直接创建完善任务。
   */
  const startAnalysis = async (authenticatePayload, { id } = {}) => {
    const { tenantId } = authenticatePayload;
    if (!tenantId) {
      throw new Error('未登录租户用户');
    }
    if (!id) {
      throw new Error('缺少邀请记录ID');
    }
    const row = await models.talentCollectInvite.findOne({
      where: { id: String(id), tenantId }
    });
    if (!row) {
      throw new Error('邀请记录不存在');
    }
    if (row.status !== 'done') {
      throw new Error('仅已完成的邀请可触发分析任务');
    }

    const interviewData = row.interviewData || {};
    const asrSucceeded = interviewData.videoAsrStatus === 'succeeded' && interviewData.videoTranscripts != null;
    if (asrSucceeded) {
      return createRefineOrGenerateTask(authenticatePayload, { id: String(row.id) });
    }

    if (interviewData.videoAsrStatus === 'running' && interviewData.videoAsrTaskId) {
      return {
        invite: toPublic(row),
        taskId: null,
        assessmentId: null,
        analysisKind: null,
        asrStatus: 'running',
        asrTaskId: interviewData.videoAsrTaskId
      };
    }

    if (!fastify.config.ALI_ASR_APP_KEY || !fastify.config.ALI_ASR_ACCESS_KEY_ID || !fastify.config.ALI_ASR_ACCESS_KEY_SECRET) {
      throw new Error('未配置阿里云录音文件识别（ALI_ASR_APP_KEY / ALI_ASR_ACCESS_KEY_ID / ALI_ASR_ACCESS_KEY_SECRET）');
    }

    const asrTask = await fastify.task.services.create({
      type: VIDEO_ASR_TASK_TYPE,
      targetId: String(row.id),
      targetType: 'talentCollectInvite',
      runnerType: 'system',
      input: {
        name: `video-asr:${row.id}`,
        inviteId: String(row.id),
        tenantId: String(tenantId)
      }
    });

    row.interviewData = Object.assign({}, interviewData, {
      videoAsrStatus: 'pending',
      videoAsrTaskId: asrTask.id,
      videoAsrError: null,
      videoAsrQueuedAt: new Date().toISOString()
    });
    row.changed('interviewData', true);
    await row.save();

    // 尽快执行，不单靠 cron
    if (typeof fastify.task.services.processSystemTask === 'function') {
      fastify.task.services.processSystemTask(asrTask).catch(err => {
        fastify.log.error({ err, taskId: asrTask.id }, 'invite-video-asr 立即执行失败');
      });
    }

    return {
      invite: toPublic(row),
      taskId: null,
      assessmentId: null,
      analysisKind: null,
      asrStatus: 'running',
      asrTaskId: asrTask.id
    };
  };

  /** 未结束邀请：取消后短链不可再进入 */
  const cancel = async (authenticatePayload, { id } = {}) => {
    const { tenantId } = authenticatePayload;
    if (!tenantId) {
      throw new Error('未登录租户用户');
    }
    if (!id) {
      throw new Error('缺少邀请记录ID');
    }
    const row = await models.talentCollectInvite.findOne({
      where: { id: String(id), tenantId }
    });
    if (!row) {
      throw new Error('邀请记录不存在');
    }
    if (row.status === 'ended') {
      throw new Error('已结束的邀请不可取消');
    }
    if (row.status === 'canceled') {
      return toPublic(row);
    }

    const analysisTaskId = row.interviewData?.analysisTaskId;
    if (analysisTaskId && fastify.task?.services?.cancel) {
      try {
        const existing = await fastify.task.services.detail({ id: analysisTaskId });
        if (existing && ['pending', 'running'].includes(existing.status)) {
          await fastify.task.services.cancel({ id: analysisTaskId });
        }
      } catch (e) {
        fastify.log.warn({ err: e, taskId: analysisTaskId }, 'cancel invite analysis task failed');
      }
    }

    row.status = 'canceled';
    row.interviewData = Object.assign({}, row.interviewData || {}, {
      canceledAt: new Date().toISOString()
    });
    // 作废采集短链码，旧链接 decode 后也找不到有效邀请码绑定
    row.code = null;
    row.changed('interviewData', true);
    await row.save();
    return toPublic(row);
  };

  const list = async (authenticatePayload, { positionId, filter = {}, perPage = 20, currentPage = 1 } = {}) => {
    const { tenantId } = authenticatePayload;
    if (!tenantId) {
      throw new Error('未登录租户用户');
    }
    const pid = resolvePositionId(positionId);
    if (!pid) {
      throw new Error('缺少岗位ID');
    }
    const whereQuery = { tenantId, positionId: pid };
    if (filter.status) {
      whereQuery.status = filter.status;
    }
    if (filter.inviteType) {
      whereQuery.inviteType = filter.inviteType;
    }
    if (filter.keyword) {
      const keyword = `%${String(filter.keyword).trim()}%`;
      whereQuery[Op.or] = [{ name: { [Op.like]: keyword } }, { email: { [Op.like]: keyword } }, { phone: { [Op.like]: keyword } }];
    }
    const pageSize = Math.min(Math.max(Number(perPage) || 20, 1), 100);
    const page = Math.max(Number(currentPage) || 1, 1);
    const { count, rows } = await models.talentCollectInvite.findAndCountAll({
      where: whereQuery,
      offset: pageSize * (page - 1),
      limit: pageSize,
      order: [
        ['createdAt', 'DESC'],
        ['id', 'DESC']
      ]
    });
    return {
      pageData: rows.map(toPublic),
      totalCount: count
    };
  };

  const resolveClientUserId = async (tenantId, row) => {
    if (row.clientUserId) {
      return String(row.clientUserId);
    }
    if (row.interviewId) {
      return String(row.interviewId);
    }
    if (!row.projectId) {
      return null;
    }
    const listRes = await services.aiInterview.getInterviewList({
      tenantId,
      projectId: row.projectId,
      currentPage: 1,
      perPage: 20,
      filter: row.inviteCode ? { code: row.inviteCode } : undefined
    });
    const interview =
      (listRes?.pageData || []).find(item => {
        if (row.inviteCode && item.code === row.inviteCode) {
          return true;
        }
        if (row.email && (item.email === row.email || item.user?.email === row.email)) {
          return true;
        }
        if (row.phone && (item.phone === row.phone || item.user?.phone === row.phone)) {
          return true;
        }
        return false;
      }) || listRes?.pageData?.[0];
    return interview?.id || interview?.clientUserId || interview?.interviewId || null;
  };

  const getInterviewResult = async (authenticatePayload, { id } = {}) => {
    const { tenantId } = authenticatePayload;
    if (!tenantId) {
      throw new Error('未登录租户用户');
    }
    if (!id) {
      throw new Error('缺少邀请记录ID');
    }
    const row = await models.talentCollectInvite.findOne({
      where: { id: String(id), tenantId }
    });
    if (!row) {
      throw new Error('邀请记录不存在');
    }
    if (row.status !== 'done' && row.status !== 'ended') {
      throw new Error('面试尚未完成');
    }
    const clientUserId = await resolveClientUserId(tenantId, row);
    if (!clientUserId) {
      throw new Error('未找到对应面试记录');
    }
    const interviewRaw = await services.aiInterview.getInterviewDetail({
      tenantId,
      id: clientUserId
    });
    if (!row.clientUserId && clientUserId) {
      row.clientUserId = String(clientUserId);
      row.interviewData = Object.assign({}, row.interviewData || {}, {
        lastResultAt: new Date().toISOString(),
        interviewId: interviewRaw?.id || clientUserId
      });
      row.changed('interviewData', true);
      await row.save();
    }
    const videoTranscripts = row.interviewData?.videoTranscripts || null;
    const interview = mergeVideoTranscriptsIntoInterview(interviewRaw, videoTranscripts);
    // 回顾页需加载 InterviewResultSession + ComponentPreset（file 走 AI 面试域）
    const setting = await services.aiInterview.detail({ tenantId });
    return {
      invite: toPublic(row),
      interview,
      videoTranscripts,
      videoAsrStatus: row.interviewData?.videoAsrStatus || null,
      cdnUrl: setting?.cdnUrl || '',
      version: setting?.version || '',
      apiUrl: setting?.apiUrl || '',
      ajaxBaseUrl: setting?.apiUrl ? services.aiInterview.getAjaxBaseUrl(setting.apiUrl) : ''
    };
  };

  const resend = async (authenticatePayload, { id, language: languageInput } = {}) => {
    const { tenantId } = authenticatePayload;
    if (!tenantId) {
      throw new Error('未登录租户用户');
    }
    if (!id) {
      throw new Error('缺少邀请记录ID');
    }
    const language = normalizeMessageLanguage(languageInput);
    const row = await models.talentCollectInvite.findOne({
      where: { id: String(id), tenantId }
    });
    if (!row) {
      throw new Error('邀请记录不存在');
    }
    if (row.status === 'done' || row.status === 'ended' || row.status === 'canceled') {
      throw new Error('邀请已完成，无需重新发送');
    }
    if (row.deadline && dayjs(row.deadline).isBefore(dayjs())) {
      throw new Error('邀请已过期，无法重新发送');
    }

    const position = await models.position.findByPk(row.positionId);
    if (!position || String(position.tenantId) !== String(tenantId)) {
      throw new Error('未找到岗位');
    }

    row.code = await signCollectInviteCode(row);
    await row.save();

    let tenant = null;
    try {
      tenant = await fastify.tenant.services.tenant.detail({ id: tenantId });
    } catch (e) {
      tenant = { id: tenantId, name: '' };
    }

    const inviteUrl = await sendNotify({ row, position, tenant, language });
    return {
      invite: toPublic(row),
      inviteUrl
    };
  };

  const getLink = async (authenticatePayload, { id } = {}) => {
    const { tenantId } = authenticatePayload;
    if (!tenantId) {
      throw new Error('未登录租户用户');
    }
    if (!id) {
      throw new Error('缺少邀请记录ID');
    }
    const row = await models.talentCollectInvite.findOne({
      where: { id: String(id), tenantId }
    });
    if (!row) {
      throw new Error('邀请记录不存在');
    }
    if (row.status === 'canceled') {
      throw new Error('邀请已取消，链接已失效');
    }
    await ensureInviteCode(row);
    return {
      invite: toPublic(row),
      inviteUrl: buildInviteUrl(row)
    };
  };

  Object.assign(fastify[options.name].services, {
    talentCollectInvite: {
      send,
      resend,
      getLink,
      list,
      getInterviewResult,
      detailByCode,
      saveProfile,
      parseResume,
      ensureInvite,
      markInterviewDone,
      startAnalysis,
      createRefineOrGenerateTask,
      resolveClientUserId,
      cancel,
      toPublic
    }
  });
});
