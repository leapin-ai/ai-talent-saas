import dayjs from 'dayjs';

const getByPath = (data, path) => {
  if (data == null || path == null || path === '') {
    return data;
  }
  return String(path)
    .split('.')
    .reduce((acc, key) => (acc == null ? acc : acc[key]), data);
};

const isEmptyValue = value => {
  if (value == null || value === '') {
    return true;
  }
  if (Array.isArray(value) && value.length === 0) {
    return true;
  }
  return false;
};

const mapOptionLabel = (value, options) => {
  if (!Array.isArray(options) || !options.length) {
    return value;
  }
  const match = options.find(item => item && item.value === value);
  return match?.label ?? value;
};

const formatDateValue = (value, format) => {
  const pattern = format || 'YYYY-MM-DD';
  if (Array.isArray(value)) {
    return value
      .map(item => formatDateValue(item, format))
      .filter(item => item !== '')
      .join(' ~ ');
  }
  if (value && typeof value.format === 'function') {
    return value.format(pattern);
  }
  if (value && (typeof value === 'string' || typeof value === 'number')) {
    const parsed = dayjs(value);
    return parsed.isValid() ? parsed.format(pattern) : String(value);
  }
  return value == null ? '' : String(value);
};

const formatFieldValue = (field, value) => {
  if (isEmptyValue(value)) {
    return '';
  }

  const props = field.props || {};
  const type = field.type;

  if (type === 'Switch' || type === 'Checkbox') {
    if (value) {
      return props.checkedChildren || 'true';
    }
    return props.unCheckedChildren || 'false';
  }

  if (type === 'DatePicker') {
    return formatDateValue(value, props.format) || '';
  }

  if (Array.isArray(props.options) && props.options.length) {
    if (Array.isArray(value)) {
      return value
        .map(item => mapOptionLabel(item, props.options))
        .filter(item => item != null && item !== '')
        .join('、');
    }
    return String(mapOptionLabel(value, props.options) ?? '');
  }

  if (Array.isArray(value)) {
    return value
      .map(item => (item && typeof item === 'object' ? JSON.stringify(item) : String(item)))
      .filter(Boolean)
      .join('、');
  }

  if (typeof value === 'object') {
    return JSON.stringify(value);
  }

  return String(value);
};

const blockKind = block => block?.kind || block?.type || '';

const visibleFields = list => (list || []).filter(field => field && field.name && !field.hidden);

const assignGroup = (output, key, value) => {
  if (value == null) {
    return;
  }
  if (typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length === 0) {
    return;
  }
  if (Array.isArray(value) && value.length === 0) {
    return;
  }
  const base = key || 'untitled';
  let name = base;
  let index = 2;
  while (Object.prototype.hasOwnProperty.call(output, name)) {
    name = `${base}${index}`;
    index += 1;
  }
  output[name] = value;
};

const fieldsToObject = (fields, data) => {
  const row = {};
  visibleFields(fields).forEach(field => {
    const value = formatFieldValue(field, getByPath(data, field.name));
    if (value) {
      row[field.label || field.name] = value;
    }
  });
  return row;
};

const resolveChoiceSelectorName = block => {
  if (block.selectorName != null && String(block.selectorName).trim()) {
    return String(block.selectorName).trim();
  }
  if (block.discriminator?.propertyName) {
    return String(block.discriminator.propertyName).trim();
  }
  return `__choice_${block.id}`;
};

const selectedChoiceOptions = (block, data) => {
  const selectorName = resolveChoiceSelectorName(block);
  const selectorValue = block.selectorInData === false ? undefined : getByPath(data, selectorName);
  const selectedIds = block.mode === 'multiple' ? (Array.isArray(selectorValue) ? selectorValue.map(String) : []) : selectorValue != null && selectorValue !== '' ? [String(selectorValue)] : [];
  return (block.options || []).filter(option => option && selectedIds.includes(String(option.id)));
};

const walkBlocks = (blocks, data) => {
  const output = {};
  (blocks || []).forEach(block => {
    if (!block) {
      return;
    }
    const title = block.title || block.label || '';
    switch (blockKind(block)) {
      case 'formInfo': {
        const group = Object.assign({}, fieldsToObject(block.list, data), walkBlocks(block.blocks, data));
        assignGroup(output, title || 'group', group);
        break;
      }
      case 'object': {
        const name = block.name != null && String(block.name).trim() ? String(block.name).trim() : '';
        const nested = name ? getByPath(data, name) : data;
        const source = nested && typeof nested === 'object' ? nested : {};
        const group = Object.assign({}, fieldsToObject(block.list, source), walkBlocks(block.blocks, source));
        assignGroup(output, title || name || 'object', group);
        break;
      }
      case 'list':
      case 'tableList': {
        const name = block.name != null && String(block.name).trim() ? String(block.name).trim() : '';
        const listItems = name ? getByPath(data, name) : null;
        const rows = (Array.isArray(listItems) ? listItems : [])
          .map(item => {
            const source = item && typeof item === 'object' ? item : {};
            return Object.assign({}, fieldsToObject(block.list, source), walkBlocks(block.itemBlocks || block.blocks, source));
          })
          .filter(row => Object.keys(row).length > 0);
        assignGroup(output, title || name || 'list', rows);
        break;
      }
      case 'multiField': {
        const name = block.name != null && String(block.name).trim() ? String(block.name).trim() : '';
        const values = name ? getByPath(data, name) : null;
        const itemField = { type: block.fieldType || 'Input', props: {} };
        const text = Array.isArray(values)
          ? values
              .map(item => formatFieldValue(itemField, item))
              .filter(Boolean)
              .join('、')
          : formatFieldValue(itemField, values);
        if (text) {
          assignGroup(output, title || block.label || name || 'items', text);
        }
        break;
      }
      case 'steps': {
        const group = {};
        (block.items || []).forEach(step => {
          const stepGroup = Object.assign({}, fieldsToObject(step.list, data), walkBlocks(step.blocks, data));
          assignGroup(group, step.title || 'step', stepGroup);
        });
        assignGroup(output, title || 'steps', group);
        break;
      }
      case 'choice': {
        const picked = selectedChoiceOptions(block, data);
        const toRow = option => {
          const row = {};
          if (option.title) {
            row.selected = option.title;
          }
          return Object.assign(row, fieldsToObject(option.list, data), walkBlocks(option.blocks, data));
        };
        if (block.mode === 'multiple') {
          assignGroup(
            output,
            title || 'choice',
            picked.map(toRow).filter(row => Object.keys(row).length > 0)
          );
        } else {
          assignGroup(output, title || 'choice', picked[0] ? toRow(picked[0]) : {});
        }
        break;
      }
      default:
        break;
    }
  });
  return output;
};

const joinMessages = rows => {
  if (!Array.isArray(rows) || !rows.length) {
    return '';
  }
  return rows
    .map(row => {
      if (typeof row === 'string') {
        return row.trim();
      }
      if (!row || typeof row !== 'object') {
        return '';
      }
      return String(row.message || row.text || row.content || '').trim();
    })
    .filter(Boolean)
    .join('');
};

const transcriptText = entry => {
  if (!entry) {
    return '';
  }
  if (typeof entry === 'string') {
    return entry.trim();
  }
  if (entry.text) {
    return String(entry.text).trim();
  }
  return joinMessages(entry.sentences) || joinMessages(entry.aiResult);
};

const choiceAnswerText = (answerType, questionOptions, result) => {
  const optionList = Array.isArray(questionOptions?.answerOptions) ? questionOptions.answerOptions.map(item => String(item)) : [];
  const labelOf = value => {
    if (value == null || value === '') {
      return '';
    }
    const text = typeof value === 'object' ? value.label || value.value || value.text || '' : String(value);
    if (optionList.includes(text)) {
      return text;
    }
    return text;
  };

  if (answerType === 'multiple') {
    const selected = Array.isArray(result?.selectedOptions) ? result.selectedOptions : Array.isArray(result) ? result : result != null && result !== '' ? [result] : [];
    return selected.map(labelOf).filter(Boolean).join('、');
  }

  const value = result?.text ?? result?.value ?? result;
  if (Array.isArray(value)) {
    return value.map(labelOf).filter(Boolean).join('、');
  }
  return labelOf(value);
};

const textAnswer = result => {
  if (result == null || result === '') {
    return '';
  }
  if (typeof result === 'string') {
    return result.trim();
  }
  if (typeof result === 'object' && result.text != null) {
    return String(result.text).trim();
  }
  return '';
};

const buildQuestionItem = (pq, index, answersMap, transcripts) => {
  const question = pq?.questionDigital?.question || pq?.question || {};
  const questionId = question.id || pq?.questionId;
  if (!questionId) {
    return null;
  }
  const answerData = answersMap[questionId] || {};
  const answerType = question.answerType || answerData.answerType || answerData.question?.answerType || 'video';
  const stored = transcripts[questionId];
  let answer = '';
  if (answerType === 'video') {
    answer = transcriptText(stored) || joinMessages(answerData.aiResult);
  } else if (answerType === 'single' || answerType === 'multiple') {
    answer = choiceAnswerText(answerType, question.options || answerData.question?.options, answerData.result);
  } else {
    answer = textAnswer(answerData.result) || joinMessages(answerData.aiResult);
  }

  const probes = [];
  const probeSources = Array.isArray(answerData.probeList) ? answerData.probeList : [];
  const probeTranscripts = Array.isArray(stored?.probes) ? stored.probes : [];
  const probeCount = Math.max(probeSources.length, probeTranscripts.length);
  for (let probeIndex = 0; probeIndex < probeCount; probeIndex += 1) {
    const probe = probeSources[probeIndex] || {};
    const probeTitle = probe.question?.title || probe.title || `followUp ${probeIndex + 1}`;
    const probeAnswer = transcriptText(probeTranscripts[probeIndex]) || joinMessages(probe.aiResult) || textAnswer(probe.result);
    if (!probeTitle && !probeAnswer) {
      continue;
    }
    probes.push({
      title: probeTitle,
      answer: probeAnswer || ''
    });
  }

  const optionList = Array.isArray(question.options?.answerOptions) ? question.options.answerOptions.map(item => String(item)).filter(Boolean) : [];
  const item = {
    index: index + 1,
    title: question.title || answerData.question?.title || `Question ${index + 1}`,
    answerType,
    answer: answer || ''
  };
  if (optionList.length) {
    item.options = optionList;
  }
  if (probes.length) {
    item.followUps = probes;
  }
  return item;
};

const buildQuestions = (interview, videoTranscripts) => {
  const answersMap = interview?.answers && typeof interview.answers === 'object' && !Array.isArray(interview.answers) ? interview.answers : {};
  const transcripts = videoTranscripts && typeof videoTranscripts === 'object' ? videoTranscripts : {};
  const questionList = Array.isArray(interview?.questionList) ? interview.questionList : [];
  const items = [];
  const seen = new Set();

  questionList.forEach(pq => {
    const item = buildQuestionItem(pq, items.length, answersMap, transcripts);
    if (!item) {
      return;
    }
    const questionId = pq?.questionDigital?.question?.id || pq?.question?.id || pq?.questionId;
    items.push(item);
    if (questionId) {
      seen.add(String(questionId));
    }
  });

  Object.keys(answersMap).forEach(questionId => {
    if (seen.has(String(questionId))) {
      return;
    }
    const answerData = answersMap[questionId];
    const item = buildQuestionItem(
      {
        questionId,
        question: answerData?.question || {}
      },
      items.length,
      answersMap,
      transcripts
    );
    if (item) {
      items.push(item);
    }
  });

  return items;
};

const formatSubmittedAt = value => {
  if (!value) {
    return '';
  }
  const parsed = dayjs(value);
  return parsed.isValid() ? parsed.format('YYYY-MM-DD HH:mm:ss') : String(value);
};

const COMPANY_KEYS = ['id', 'name', 'fullName', 'logo', 'industry', 'scale', 'address', 'phone', 'email', 'website', 'foundedDate', 'description', 'companyTags'];

const RESUME_OMIT = new Set(['id', 'fileId', 'fileMD5', 'filename', 'avatar', 'resumes', 'ossId', 'url', 'fileUrl', 'tenantId', 'createdAt', 'updatedAt', 'deletedAt', 'resumeRawContentId']);

const pickDefined = source => {
  const output = {};
  Object.keys(source).forEach(key => {
    const value = source[key];
    if (value == null || value === '') {
      return;
    }
    if (Array.isArray(value) && value.length === 0) {
      return;
    }
    if (typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length === 0) {
      return;
    }
    output[key] = value;
  });
  return Object.keys(output).length ? output : null;
};

const buildPositionSkillExport = skill => {
  if (!skill || typeof skill !== 'object') {
    return null;
  }
  const name = typeof skill.name === 'string' ? skill.name.trim() : '';
  if (!name) {
    return null;
  }
  const contentItems = Array.isArray(skill.contentItems)
    ? skill.contentItems
        .map(item => {
          if (!item || typeof item !== 'object') {
            return null;
          }
          return pickDefined({
            title: item.title || null,
            description: item.description || null,
            source: item.source || null
          });
        })
        .filter(Boolean)
    : null;
  return pickDefined({
    id: skill.id || null,
    name,
    activityCode: skill.activityCode || null,
    activityTitle: skill.activityTitle || null,
    activityGroup: skill.activityGroup || null,
    origin: skill.origin || null,
    importanceNow: skill.importanceNow ?? null,
    importanceYear: skill.importanceYear ?? null,
    change: skill.change || null,
    aiExposure: skill.aiExposure || null,
    confidence: skill.confidence || null,
    contentItems: contentItems && contentItems.length ? contentItems : null
  });
};

const buildPositionExport = position => {
  if (!position || typeof position !== 'object') {
    return null;
  }
  const department = (position.orgEnums || []).find(item => String(item.value) === String(position.tenantOrgId));
  const skills = Array.isArray(position.skill) ? position.skill.map(buildPositionSkillExport).filter(Boolean) : [];
  const workforceStrategy = Array.isArray(position.workforceStrategy)
    ? position.workforceStrategy
        .map(item => {
          if (!item || typeof item !== 'object') {
            return null;
          }
          return pickDefined({
            action: item.action || item.type || null,
            title: item.title || null,
            detail: item.detail || item.description || null
          });
        })
        .filter(Boolean)
    : [];
  return pickDefined({
    id: position.id ?? null,
    name: position.name || null,
    roleName: position.roleName || position.name || null,
    department: department?.description || null,
    tenantOrgId: position.tenantOrgId ?? null,
    capacity: position.capacity || null,
    language: position.language || null,
    locationType: position.locationType || null,
    location: position.location || null,
    salary: position.salary || null,
    status: position.status || null,
    description: position.description || null,
    requirement: position.requirement || null,
    developmentGoal: position.developmentGoal || null,
    verdict: position.verdict && typeof position.verdict === 'object' ? position.verdict : null,
    skill: skills.length ? skills : null,
    workforceStrategy: workforceStrategy.length ? workforceStrategy : null,
    changeMagnitude: position.changeMagnitude || null
  });
};

const buildCompanyExport = company => {
  if (!company || typeof company !== 'object') {
    return null;
  }
  const picked = {};
  COMPANY_KEYS.forEach(key => {
    picked[key] = company[key];
  });
  return pickDefined(picked);
};

const buildEmployeeExport = (employee, assessment) => {
  const source = employee && typeof employee === 'object' ? employee : {};
  const id = source.id || assessment?.employeeId || null;
  if (!id && !source.name && !assessment?.name) {
    return null;
  }
  return pickDefined({
    id,
    tenantUserId: source.tenantUserId || assessment?.tenantUserId || null,
    name: source.name || assessment?.name || null,
    nameEn: source.nameEn || null,
    gender: source.gender || null,
    phone: source.phone || assessment?.phone || null,
    email: source.email || assessment?.email || null,
    personalEmail: source.personalEmail || null,
    status: source.status || null
  });
};

const buildResumeExport = resume => {
  if (!resume || typeof resume !== 'object') {
    return null;
  }
  const output = {};
  Object.keys(resume).forEach(key => {
    if (RESUME_OMIT.has(key)) {
      return;
    }
    output[key] = resume[key];
  });
  return pickDefined(output);
};

const SUBMITTED_OMIT = new Set(['resumes', 'resumeParsed', 'id', 'tenantId', 'createdAt', 'updatedAt', 'deletedAt']);

const buildProjectExportItem = project => {
  if (!project || typeof project !== 'object') {
    return null;
  }
  return pickDefined({
    name: project.name || null,
    role: project.role || null,
    description: project.description || null,
    skills: Array.isArray(project.skills) ? project.skills.filter(Boolean) : null,
    period: project.period ?? null,
    company: project.company || project.companyName || null
  });
};

/** 调研时员工填写信息（含项目经历），不含简历附件/解析缓存 */
const buildSubmittedInfoExport = submittedInfo => {
  if (!submittedInfo || typeof submittedInfo !== 'object') {
    return null;
  }
  const output = {};
  Object.keys(submittedInfo).forEach(key => {
    if (SUBMITTED_OMIT.has(key)) {
      return;
    }
    if (key === 'projects') {
      return;
    }
    output[key] = submittedInfo[key];
  });
  const rawProjects = Array.isArray(submittedInfo.projects) ? submittedInfo.projects : Array.isArray(submittedInfo.projects?.projects) ? submittedInfo.projects.projects : [];
  const projects = rawProjects.map(buildProjectExportItem).filter(Boolean);
  if (projects.length) {
    output.projects = projects;
  }
  return pickDefined(output);
};

const buildQuestionnaireExport = interview => {
  const questionnaire = interview?.options?.questionnaire || interview?.questionnaire || {};
  const schema = interview?.project?.setting?.questionnaire?.schema;
  const answers = questionnaire.answers && typeof questionnaire.answers === 'object' ? questionnaire.answers : null;
  const hasSchema = Array.isArray(schema?.blocks) && schema.blocks.length > 0;
  const readable = hasSchema && answers ? walkBlocks(schema.blocks, answers) : null;
  const submittedAt = formatSubmittedAt(questionnaire.submittedAt);

  if (readable && Object.keys(readable).length) {
    return submittedAt ? Object.assign({ submittedAt }, readable) : readable;
  }
  if (submittedAt) {
    return { submittedAt };
  }
  return null;
};

/** 与剪贴板导入对齐：每条证据导出为 { source, title, summary } */
const buildEvidenceExport = evidence => {
  const finalize = (summary, source, title) => {
    const text = String(summary || '').trim();
    if (!text) {
      return null;
    }
    const src = String(source || '').trim();
    const ttl = String(title || '').trim() || src || text.slice(0, 40);
    return pickDefined({
      source: src || null,
      title: ttl || null,
      summary: text
    });
  };
  if (typeof evidence === 'string') {
    const text = evidence.trim();
    if (!text) {
      return null;
    }
    const lines = text
      .split(/\n+/)
      .map(line => line.trim())
      .filter(Boolean);
    if (lines.length > 1) {
      const list = lines.map(line => finalize(line, '', '')).filter(Boolean);
      return list.length ? list : null;
    }
    const one = finalize(text, '', '');
    return one ? [one] : null;
  }
  if (Array.isArray(evidence)) {
    const list = evidence
      .map(item => {
        if (typeof item === 'string') {
          return finalize(item, '', '');
        }
        if (!item || typeof item !== 'object') {
          return null;
        }
        return finalize(item.summary || item.text || item.content || item.description || '', item.source || item.sourceType || item.sourceLabel || item.origin || '', item.title || '');
      })
      .filter(Boolean);
    return list.length ? list : null;
  }
  if (evidence && typeof evidence === 'object') {
    const one = finalize(evidence.summary || evidence.text || evidence.content || evidence.description || '', evidence.source || evidence.sourceType || evidence.sourceLabel || evidence.origin || '', evidence.title || '');
    return one ? [one] : null;
  }
  return null;
};

/** 档案审核草稿 skillAnalysis，含 confidence + 结构化 evidence */
const buildSkillAnalysisExport = skillAnalysis => {
  if (!skillAnalysis || typeof skillAnalysis !== 'object') {
    return null;
  }
  const skills = Array.isArray(skillAnalysis.skills)
    ? skillAnalysis.skills
        .map(item => {
          if (!item || typeof item !== 'object') {
            return null;
          }
          const name = (typeof item.name === 'string' && item.name.trim()) || (typeof item.title === 'string' && item.title.trim()) || '';
          if (!name) {
            return null;
          }
          return pickDefined({
            id: item.id || null,
            name,
            title: typeof item.title === 'string' && item.title.trim() ? item.title.trim() : name,
            current: item.current ?? null,
            required: item.required ?? null,
            status: item.status || null,
            confidence: item.confidence || null,
            evidence: buildEvidenceExport(item.evidence)
          });
        })
        .filter(Boolean)
    : [];
  return pickDefined({
    readiness: skillAnalysis.readiness ?? null,
    summary: skillAnalysis.summary || null,
    metrics: skillAnalysis.metrics && typeof skillAnalysis.metrics === 'object' ? skillAnalysis.metrics : null,
    skills: skills.length ? skills : null,
    priorityGaps: Array.isArray(skillAnalysis.priorityGaps) && skillAnalysis.priorityGaps.length ? skillAnalysis.priorityGaps : null,
    developmentPlan: skillAnalysis.developmentPlan && typeof skillAnalysis.developmentPlan === 'object' ? skillAnalysis.developmentPlan : null
  });
};

/** 与剪贴板 §2 对齐的 reviewData（employee / profile / skillAnalysis / aiSuggest） */
const buildReviewDataExport = profileDetail => {
  if (!profileDetail || typeof profileDetail !== 'object') {
    return null;
  }
  const profile = profileDetail.profile && typeof profileDetail.profile === 'object' ? profileDetail.profile : {};
  const aiSuggest = profileDetail.aiSuggest && typeof profileDetail.aiSuggest === 'object' ? profileDetail.aiSuggest : null;
  const skillAnalysis = buildSkillAnalysisExport(profileDetail.skillAnalysisDraft || profileDetail.skillAnalysis);
  const omitEmployee = new Set(['profile', 'performances', 'orgEnums', 'positionEnums', 'aiSuggest', 'skillAnalysisDraft', 'skillAnalysis', 'createdAt', 'updatedAt', 'deletedAt']);
  const cleanEmployee = {};
  Object.keys(profileDetail).forEach(key => {
    if (omitEmployee.has(key)) {
      return;
    }
    cleanEmployee[key] = profileDetail[key];
  });
  if (cleanEmployee.id != null && String(cleanEmployee.id).startsWith('draft-')) {
    delete cleanEmployee.id;
  }
  const cleanProfile = Object.assign({}, profile);
  delete cleanProfile.id;
  delete cleanProfile.employeeId;
  delete cleanProfile.tenantId;
  delete cleanProfile.createdAt;
  delete cleanProfile.updatedAt;
  delete cleanProfile.deletedAt;
  return pickDefined({
    employee: pickDefined(cleanEmployee),
    profile: pickDefined(cleanProfile),
    skillAnalysis,
    aiSuggest
  });
};

export const buildInterviewExport = ({
  interview,
  videoTranscripts,
  position,
  company,
  employee,
  assessment,
  resumeParsed,
  submittedInfo,
  profileDetail,
  includeEmployee = false,
  includeResume = false,
  includeSubmittedInfo = false,
  includeReviewData = false
} = {}) => {
  const data = {
    position: buildPositionExport(position),
    company: buildCompanyExport(company),
    questionnaire: buildQuestionnaireExport(interview),
    questions: buildQuestions(interview, videoTranscripts)
  };
  if (includeEmployee) {
    data.employee = buildEmployeeExport(employee, assessment);
  }
  if (includeResume) {
    data.resumeParsed = buildResumeExport(resumeParsed);
  }
  if (includeSubmittedInfo) {
    const source = (submittedInfo && typeof submittedInfo === 'object' ? submittedInfo : null) || (assessment?.profileData && typeof assessment.profileData === 'object' ? assessment.profileData : null) || null;
    data.submittedInfo = buildSubmittedInfoExport(source);
  }
  if (includeReviewData && profileDetail) {
    const review = buildReviewDataExport(profileDetail);
    if (review) {
      if (review.employee) {
        data.employee = Object.assign({}, data.employee || {}, review.employee);
      }
      if (review.profile) {
        data.profile = review.profile;
      }
      if (review.skillAnalysis) {
        data.skillAnalysis = review.skillAnalysis;
      }
      if (review.aiSuggest) {
        data.aiSuggest = review.aiSuggest;
      }
    }
  }
  return data;
};

const safeFilename = name => String(name || 'interview').replace(/[\\/:*?"<>|]/g, '-');

export const downloadInterviewExport = ({ filename, ...payload }) => {
  const data = buildInterviewExport(payload);
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${safeFilename(filename)}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  return data;
};
