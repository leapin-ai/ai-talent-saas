export const BASIC_FIELD_NAMES = ['name', 'tenantOrgId', 'language', 'locationType', 'location', 'capacity', 'salary'];

export const DETAILS_FIELD_NAMES = ['tenantOrgId', 'language', 'locationType', 'location', 'capacity', 'salary'];

export const CONTENT_FIELD_NAMES = ['description', 'requirement', 'developmentGoal'];

const normalizeTenantOrgIdForApi = value => {
  if (value == null || value === '') {
    return value;
  }
  if (typeof value === 'object' && value.id != null) {
    return value.id;
  }
  return value;
};

export const pickDetailsPayload = src => {
  const s = src || {};
  return {
    tenantOrgId: s.tenantOrgId,
    language: s.language,
    locationType: s.locationType,
    location: s.location,
    capacity: s.capacity,
    salary: s.salary
  };
};

export const pickBasicPayload = src => {
  const s = src || {};
  return {
    name: s.name,
    tenantOrgId: normalizeTenantOrgIdForApi(s.tenantOrgId),
    language: s.language,
    locationType: s.locationType,
    location: s.location,
    capacity: s.capacity,
    salary: s.salary
  };
};

export const pickContentPayload = src => {
  const s = src || {};
  return {
    description: s.description,
    requirement: s.requirement,
    developmentGoal: s.developmentGoal
  };
};

export const pickEditablePayload = src => Object.assign(pickBasicPayload(src), pickContentPayload(src));

/** 提交 save/create 前把表单对象字段转成接口字段 */
export const toSavePayload = src => {
  const payload = pickEditablePayload(src);
  const tenantOrgId = payload.tenantOrgId;
  if (tenantOrgId != null && typeof tenantOrgId === 'object') {
    payload.tenantOrgId = tenantOrgId.id ?? null;
  }
  return payload;
};

export const pickBasicFormData = src => pickBasicPayload(src);

export const pickDetailsFormData = src => pickDetailsPayload(src);
