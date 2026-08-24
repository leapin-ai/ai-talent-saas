const emptySkills = () => ({
  cert_mapped: [],
  interest_strength: [],
  work_related: []
});

const normalizeSkills = skills => {
  if (Array.isArray(skills)) {
    return Object.assign(emptySkills(), {
      work_related: skills.filter(Boolean)
    });
  }
  if (!skills || typeof skills !== 'object') {
    return emptySkills();
  }
  return {
    cert_mapped: Array.isArray(skills.cert_mapped) ? skills.cert_mapped.filter(Boolean) : [],
    interest_strength: Array.isArray(skills.interest_strength) ? skills.interest_strength.filter(Boolean) : [],
    work_related: Array.isArray(skills.work_related) ? skills.work_related.filter(Boolean) : []
  };
};

export const hasSkillTags = skills => {
  const normalized = normalizeSkills(skills);
  return ['cert_mapped', 'interest_strength', 'work_related'].some(key => normalized[key].length > 0);
};

/** 将 assessment.profileData 拆成核对信息与项目经历 */
export const splitAssessmentProfileData = profileData => {
  const data = profileData && typeof profileData === 'object' ? profileData : {};
  const { projects, ...rest } = data;
  const review = normalizeReviewProfileData(rest);
  const projectList = Array.isArray(projects) && projects.length > 0 ? projects : [];
  return {
    review,
    projects: { projects: projectList }
  };
};

/** 对齐人才档案字段：skills / intentionPosition / workPreference；兼容旧 options.* 与扁平 skills 数组 */
export const normalizeReviewProfileData = data => {
  const source = data && typeof data === 'object' ? data : {};
  const options = source.options && typeof source.options === 'object' ? source.options : {};
  const workPreference = Object.assign({}, source.workPreference || {});

  let intentionPosition = source.intentionPosition;
  if (!Array.isArray(intentionPosition) || intentionPosition.length === 0) {
    if (typeof options.targetRole === 'string' && options.targetRole.trim()) {
      intentionPosition = [options.targetRole.trim()];
    } else {
      intentionPosition = [];
    }
  }

  if (!workPreference.work_mode_preference && options.workMode) {
    workPreference.work_mode_preference = options.workMode;
  }
  if (!workPreference.business_travel_willingness && options.openTravel) {
    workPreference.business_travel_willingness = options.openTravel;
  }
  if (!workPreference.relocation_willingness && options.openRelocation) {
    workPreference.relocation_willingness = options.openRelocation;
  }

  return Object.assign({}, source, {
    skills: normalizeSkills(source.skills),
    intentionPosition,
    workPreference
  });
};

export const hasPrefilledReviewData = data => {
  if (!data || typeof data !== 'object') {
    return false;
  }
  if (data.name) {
    return true;
  }
  const phone = data.phone;
  const email = data.email;
  if (phone != null && phone !== '') {
    return true;
  }
  if (email != null && email !== '') {
    return true;
  }
  if (hasSkillTags(data.skills)) {
    return true;
  }
  return false;
};

export const hasSavedProjectsData = projects => {
  if (!Array.isArray(projects) || projects.length === 0) {
    return false;
  }
  return projects.some(item => {
    if (!item || typeof item !== 'object') {
      return false;
    }
    return [item.name, item.role, item.description].some(value => value != null && String(value).trim() !== '');
  });
};

export const hasSavedProfileData = profileData => {
  const { review, projects } = splitAssessmentProfileData(profileData);
  return hasPrefilledReviewData(review) || hasSavedProjectsData(projects.projects);
};
