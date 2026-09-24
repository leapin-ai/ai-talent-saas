export const formatValue = value => {
  if (value == null || value === '') {
    return '-';
  }
  if (typeof value === 'object') {
    const number = value.number ?? value.phone ?? value.value ?? value.email;
    if (number != null && String(number).trim()) {
      return String(number).trim();
    }
    try {
      return JSON.stringify(value);
    } catch (e) {
      return '-';
    }
  }
  return String(value);
};

export const toReviewData = profileDetail => {
  if (!profileDetail) {
    return { employee: {}, profile: {} };
  }
  const { profile, performances, orgEnums, positionEnums, aiSuggest, skillAnalysisDraft, skillAnalysis, createdAt, updatedAt, deletedAt, ...employee } = profileDetail;
  if (employee.id != null && String(employee.id).startsWith('draft-')) {
    delete employee.id;
  }
  const cleanProfile = Object.assign({}, profile || {});
  delete cleanProfile.id;
  delete cleanProfile.employeeId;
  delete cleanProfile.tenantId;
  delete cleanProfile.createdAt;
  delete cleanProfile.updatedAt;
  delete cleanProfile.deletedAt;
  return {
    employee,
    profile: cleanProfile,
    aiSuggest: aiSuggest || null,
    skillAnalysis: skillAnalysisDraft || skillAnalysis || null
  };
};

/**
 * 剪贴板 JSON 支持（完善档案生成审核）：
 * 1) reviewData：{ employee?, profile?, skillAnalysis?, aiSuggest? }
 * 2) 扁平档案详情：顶层含 name/email 等员工字段，或含 profile / skillAnalysisDraft
 * 3) AI 填充接口返回体：{ data, readiness, aiSuggest }
 */
const normalizeClipboardConfidence = value => {
  const key = String(value || '')
    .trim()
    .toLowerCase();
  return key === 'high' || key === 'medium' || key === 'low' ? key : null;
};

const SOURCE_INFER_RULES = [
  { match: /简历|cv|resume/i, source: '简历' },
  { match: /linkedin/i, source: 'LinkedIn' },
  { match: /ai\s*面试|面试|interview/i, source: 'AI面试' },
  { match: /项目经历|项目/i, source: '项目经历' },
  { match: /\bjd\b|职位描述|岗位描述/i, source: 'JD' },
  { match: /绩效|performance/i, source: '绩效' },
  { match: /证书|认证|certification/i, source: '证书' },
  { match: /档案|profile/i, source: '档案' }
];

const inferEvidenceSourceLabel = text => {
  const s = String(text || '');
  for (const rule of SOURCE_INFER_RULES) {
    if (rule.match.test(s)) {
      return rule.source;
    }
  }
  return '';
};

/** 导入时每条证据都补齐 source + title + summary */
const normalizeClipboardEvidence = evidence => {
  const finalize = (summary, source, title) => {
    const text = String(summary || '').trim();
    if (!text) {
      return null;
    }
    let src = String(source || '').trim();
    if (!src || src === 'analysis' || src === 'skill' || src === '分析' || src === '分析依据') {
      src = inferEvidenceSourceLabel(text);
    }
    let ttl = String(title || '').trim();
    if (!ttl) {
      ttl = src || text.slice(0, 40);
    }
    return {
      source: src.slice(0, 64),
      title: ttl.slice(0, 200),
      summary: text.slice(0, 2000)
    };
  };
  const fromOne = item => {
    if (typeof item === 'string') {
      return finalize(item, '', '');
    }
    if (!item || typeof item !== 'object') {
      return null;
    }
    return finalize(item.summary || item.text || item.content || item.description || '', item.source || item.sourceType || item.sourceLabel || item.origin || '', item.title || '');
  };
  if (typeof evidence === 'string') {
    const text = evidence.trim();
    if (!text) {
      return undefined;
    }
    const lines = text
      .split(/\n+/)
      .map(line => line.trim())
      .filter(Boolean);
    if (lines.length > 1) {
      const list = lines.map(line => finalize(line, '', '')).filter(Boolean);
      return list.length ? list : undefined;
    }
    const one = finalize(text, '', '');
    return one ? [one] : undefined;
  }
  if (Array.isArray(evidence)) {
    const list = evidence.map(fromOne).filter(Boolean);
    return list.length ? list : undefined;
  }
  if (evidence && typeof evidence === 'object') {
    const one = fromOne(evidence);
    return one ? [one] : undefined;
  }
  return undefined;
};

/** 导入时保留 skills[].confidence / evidence，并规范化置信度与证据结构 */
const normalizeClipboardSkillAnalysis = skillAnalysis => {
  if (!skillAnalysis || typeof skillAnalysis !== 'object' || Array.isArray(skillAnalysis)) {
    return null;
  }
  const next = Object.assign({}, skillAnalysis);
  if (Array.isArray(skillAnalysis.skills)) {
    next.skills = skillAnalysis.skills
      .map(item => {
        if (!item || typeof item !== 'object') {
          return null;
        }
        const name = (typeof item.name === 'string' && item.name.trim()) || (typeof item.title === 'string' && item.title.trim()) || '';
        if (!name) {
          return null;
        }
        const confidence = normalizeClipboardConfidence(item.confidence);
        const evidence = item.evidence != null && item.evidence !== '' ? normalizeClipboardEvidence(item.evidence) : undefined;
        const row = Object.assign({}, item, {
          name,
          title: typeof item.title === 'string' && item.title.trim() ? item.title.trim() : name
        });
        if (confidence) {
          row.confidence = confidence;
        } else {
          delete row.confidence;
        }
        if (evidence) {
          row.evidence = evidence;
        } else if (item.evidence != null && item.evidence !== '') {
          row.evidence = item.evidence;
        }
        return row;
      })
      .filter(Boolean);
  }
  return next;
};

export const parseClipboardProfilePayload = text => {
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (e) {
    throw new Error('剪贴板不是合法 JSON');
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('无法识别剪贴板数据结构');
  }

  let root = parsed;
  // 兼容 AI 填充接口返回：{ data, readiness, aiSuggest }
  if (root.data && typeof root.data === 'object' && !Array.isArray(root.data) && (root.readiness != null || root.aiSuggest != null || root.data.profile || root.data.name)) {
    root = Object.assign({}, root.data, {
      aiSuggest: root.aiSuggest !== undefined ? root.aiSuggest : root.data.aiSuggest,
      skillAnalysis: root.readiness !== undefined ? root.readiness : root.data.skillAnalysisDraft || root.data.skillAnalysis,
      skillAnalysisDraft: root.readiness !== undefined ? root.readiness : root.data.skillAnalysisDraft
    });
  }

  const hasReviewKeys = root.employee != null || root.profile != null || root.skillAnalysis != null || root.skillAnalysisDraft != null || root.aiSuggest != null;
  const looksFlatEmployee = typeof root.name === 'string' || typeof root.email === 'string' || typeof root.phone === 'string' || root.profile != null;

  if (!hasReviewKeys && !looksFlatEmployee) {
    throw new Error('未识别到 employee / profile / skillAnalysis / aiSuggest');
  }

  let employee = {};
  let profile = {};
  if (root.employee && typeof root.employee === 'object') {
    employee = Object.assign({}, root.employee);
  } else if (looksFlatEmployee) {
    const {
      profile: _profile,
      performances: _performances,
      orgEnums: _orgEnums,
      positionEnums: _positionEnums,
      aiSuggest: _aiSuggest,
      skillAnalysisDraft: _skillAnalysisDraft,
      skillAnalysis: _skillAnalysis,
      readiness: _readiness,
      createdAt: _createdAt,
      updatedAt: _updatedAt,
      deletedAt: _deletedAt,
      ...rest
    } = root;
    employee = rest;
  }
  if (employee.id != null && String(employee.id).startsWith('draft-')) {
    delete employee.id;
  }

  if (root.profile && typeof root.profile === 'object') {
    profile = Object.assign({}, root.profile);
  }
  delete profile.id;
  delete profile.employeeId;
  delete profile.tenantId;
  delete profile.createdAt;
  delete profile.updatedAt;
  delete profile.deletedAt;

  const skillAnalysis = normalizeClipboardSkillAnalysis(
    (root.skillAnalysis && typeof root.skillAnalysis === 'object' ? root.skillAnalysis : null) ||
      (root.skillAnalysisDraft && typeof root.skillAnalysisDraft === 'object' ? root.skillAnalysisDraft : null) ||
      (root.readiness && typeof root.readiness === 'object' && (root.readiness.readiness != null || root.readiness.skills || root.readiness.priorityGaps) ? root.readiness : null)
  );

  const aiSuggest = root.aiSuggest && typeof root.aiSuggest === 'object' ? root.aiSuggest : null;

  if (!Object.keys(employee).length && !Object.keys(profile).length && !skillAnalysis && !aiSuggest) {
    throw new Error('剪贴板没有可导入的字段');
  }

  return { employee, profile, skillAnalysis, aiSuggest };
};

/** 将剪贴板解析结果合并进右侧档案草稿（保留 id / enums / performances） */
export const applyClipboardToProfileDetail = (prev, bundle, extras = {}) => {
  const base = prev && typeof prev === 'object' ? prev : {};
  const employee = bundle?.employee && typeof bundle.employee === 'object' ? bundle.employee : {};
  const profile = bundle?.profile && typeof bundle.profile === 'object' ? bundle.profile : {};
  const next = Object.assign({}, base, employee, {
    id: base.id,
    orgEnums: base.orgEnums,
    positionEnums: base.positionEnums,
    performances: base.performances || [],
    options: Object.assign({}, base.options || {}, employee.options || {}),
    profile: Object.assign({}, base.profile || {}, profile, {
      options: Object.assign({}, base.profile?.options || {}, profile.options || {})
    })
  });
  if (bundle?.aiSuggest) {
    next.aiSuggest = Object.assign({}, base.aiSuggest || {}, bundle.aiSuggest);
  }
  if (bundle?.skillAnalysis) {
    next.skillAnalysisDraft = bundle.skillAnalysis;
  }
  return withEstimatedCompletion(next, extras);
};

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

const checklistItem = (key, label, done) => ({ key, label, done: !!done });

/**
 * 与 server workforce.recomputeProfileCompletion 同口径：五项等权。
 * 基础信息、简历、填写信息、AI 面试、就绪度。（成长建议已下线，不计入）
 */
export const estimateProfileCompletion = ({ profileDetail, resumeParsed, resumes, interview, submittedInfo, assessment } = {}) => {
  const review = toReviewData(profileDetail);
  const employee = review.employee || {};
  const profile = review.profile || {};
  const skillAnalysis = review.skillAnalysis || {};
  const submitted = submittedInfo && typeof submittedInfo === 'object' ? submittedInfo : {};
  const resumeList = Array.isArray(resumes) ? resumes : Array.isArray(profileDetail?.resumes) ? profileDetail.resumes : [];
  const interviewData = interview && typeof interview === 'object' ? interview : {};

  const hasBasic = hasText(employee.name) && (hasText(employee.phone) || hasContent(employee.phone) || hasText(employee.email));
  const hasCv = resumeList.length > 0 || !!profileDetail?.currentResumeId || hasContent(resumeParsed) || hasContent(submitted.resumeParsed);
  const hasSubmittedInfo = hasText(employee.description) || hasText(employee.city) || hasText(employee.college) || hasText(employee.major) || hasContent(profile.skills) || hasContent(profile.intentionPosition) || hasContent(submitted);
  const hasInterview = !!(
    interviewData.id ||
    interviewData.interviewId ||
    hasContent(interviewData.answers) ||
    hasContent(interviewData.questionnaire) ||
    (Array.isArray(interviewData.history) && interviewData.history.length > 0) ||
    assessment?.clientUserId
  );
  const hasReadiness = skillAnalysis.readiness != null && skillAnalysis.readiness !== '' && Number.isFinite(Number(skillAnalysis.readiness));

  const checklist = [
    checklistItem('basic', '基础信息', hasBasic),
    checklistItem('cv', '简历', hasCv),
    checklistItem('submitted', '填写信息', hasSubmittedInfo),
    checklistItem('ai_interview', 'AI 面试', hasInterview),
    checklistItem('readiness', '就绪度', hasReadiness)
  ];
  const done = checklist.filter(item => item.done).length;
  const percent = Math.round((done / checklist.length) * 100);
  return { percent, checklist };
};

export const withEstimatedCompletion = (profileDetail, extras = {}) => {
  if (!profileDetail || typeof profileDetail !== 'object') {
    return profileDetail;
  }
  const { percent, checklist } = estimateProfileCompletion({
    profileDetail,
    resumeParsed: extras.resumeParsed,
    resumes: extras.resumes,
    interview: extras.interview,
    submittedInfo: extras.submittedInfo,
    assessment: extras.assessment
  });
  return Object.assign({}, profileDetail, {
    profileCompletionPercent: percent,
    profileCompletionChecklist: checklist
  });
};

const pickStr = (...values) => {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }
  return '';
};

/** 将简历解析结果合并进档案草稿（仅补空字段） */
export const mergeResumeIntoProfileDetail = (profileDetail, resumeParsed) => {
  if (!profileDetail || !resumeParsed || typeof resumeParsed !== 'object') {
    return profileDetail;
  }
  const skillNames = (Array.isArray(resumeParsed.skillList) ? resumeParsed.skillList : []).map(item => item?.name).filter(Boolean);
  const expectJob = pickStr(resumeParsed.expectJob, resumeParsed.applyJob);
  const linkedin = pickStr(resumeParsed.linkedin, resumeParsed.website);

  return Object.assign({}, profileDetail, {
    name: pickStr(profileDetail.name, resumeParsed.name),
    phone: profileDetail.phone || resumeParsed.phone || '',
    email: pickStr(profileDetail.email, resumeParsed.email),
    gender: pickStr(profileDetail.gender, resumeParsed.gender),
    college: pickStr(profileDetail.college, resumeParsed.college),
    major: pickStr(profileDetail.major, resumeParsed.major),
    degree: profileDetail.degree != null ? profileDetail.degree : resumeParsed.degree,
    city: pickStr(profileDetail.city, resumeParsed.city),
    description: pickStr(profileDetail.description, resumeParsed.cont_my_desc, resumeParsed.profileSummary),
    options: Object.assign({}, profileDetail.options || {}, linkedin ? { linkedin } : {}),
    profile: Object.assign({}, profileDetail.profile || {}, {
      skills: Object.assign({}, profileDetail.profile?.skills || {}, skillNames.length ? { work_related: skillNames } : {}),
      intentionPosition:
        Array.isArray(profileDetail.profile?.intentionPosition) && profileDetail.profile.intentionPosition.length ? profileDetail.profile.intentionPosition : expectJob ? [expectJob] : profileDetail.profile?.intentionPosition || [],
      options: Object.assign({}, profileDetail.profile?.options || {}, linkedin ? { linkedin } : {})
    })
  });
};

export const formatDateRange = (startDate, endDate, sofar) => {
  const start = startDate ? String(startDate).slice(0, 7) : '';
  const end = sofar ? '至今' : endDate ? String(endDate).slice(0, 7) : '';
  if (start && end) {
    return `${start} ~ ${end}`;
  }
  return start || end || '-';
};
