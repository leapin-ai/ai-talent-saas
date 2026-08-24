const fp = require('fastify-plugin');
const dayjs = require('dayjs');

const FEATURE_KEY = 'Assessment';
const SHORTEN_TTL_HOURS = 24;

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

const COMPLETED_INTERVIEW_STATUSES = ['completed', 'ended', 'done'];

const isInterviewCompleted = status => COMPLETED_INTERVIEW_STATUSES.includes(String(status || '').toLowerCase());

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
    completed: isInterviewCompleted(interviewStatus) || row.status === 'generating',
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
  completed: record.completed === true || isInterviewCompleted(record.interviewStatus) || record.assessmentStatus === 'generating',
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
      completed: isInterviewCompleted(status) || row.status === 'generating',
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
      if (row.status === 'generating') {
        // 已完成面试生成中，不再回退
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
    if (row.status === 'generating') {
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
        row.status = 'generating';
      } else if (row.shorten && row.status === 'pending') {
        row.status = 'interviewing';
      }
      await row.save();
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
    const setting = await services.aiInterview.detail({ tenantId: authenticatePayload.tenantId });
    return withAssessmentExtras(toPublicAssessment(row), row, setting, services);
  };

  const ensureInvite = async (authenticatePayload, { forceNew = false } = {}) => {
    let row = await findMine(authenticatePayload);
    if (!row) {
      throw new Error('请先完善档案并保存评估记录');
    }

    row = await syncInterviewStatus(authenticatePayload, row);
    if (row.status === 'generating') {
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

    const interviewCompleted = forceCompleted || previous.completed || row.status === 'generating' || isInterviewCompleted(row.interviewData?.interviewStatus);

    if (interviewCompleted) {
      if (!isInterviewCompleted(row.interviewData?.interviewStatus)) {
        row.interviewData = Object.assign({}, row.interviewData || {}, {
          interviewStatus: 'completed'
        });
        row.changed('interviewData', true);
      }
      row.status = 'generating';
    } else if (isShortenValid(row)) {
      row.status = 'interviewing';
    } else {
      throw new Error('上次面试记录已失效，请重新面试');
    }
    await row.save();

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

  Object.assign(services, {
    assessment: {
      saveProfile,
      detail,
      ensureInvite,
      acceptPrevious,
      restart
    }
  });
});
