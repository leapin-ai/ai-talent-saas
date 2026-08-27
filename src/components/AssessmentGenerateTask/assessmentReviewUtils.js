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
  const { profile, performances, orgEnums, positionEnums, aiSuggest, createdAt, updatedAt, deletedAt, ...employee } = profileDetail;
  if (employee.id != null && String(employee.id).startsWith('draft-')) {
    delete employee.id;
  }
  return {
    employee,
    profile: profile || {}
  };
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
