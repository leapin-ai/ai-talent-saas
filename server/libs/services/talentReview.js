const fp = require('fastify-plugin');
const pick = require('lodash/pick');
const { getApiBase, openApiRequest } = require('../utils/aiInterviewOpenApi');

const SCENE = 'talentReview';
const PROJECT_FETCH_LIMIT = 200;
const MANUAL_ROLES = ['superior', 'peer', 'subordinate'];

const toIdString = value => (value == null || value === '' ? '' : String(value));

const pickPositionName = position => {
  if (!position) {
    return '';
  }
  if (typeof position === 'string') {
    return position;
  }
  return position.label || position.name || '';
};

module.exports = fp(async (fastify, options) => {
  const { services } = fastify[options.name];
  const models = fastify[options.name].models;
  const tenantModels = fastify.tenant.models;

  const request = async (tenantId, pathname, requestOptions) => {
    const credentials = await services.talentReviewSetting.getCredentials(tenantId);
    return openApiRequest(credentials, pathname, requestOptions);
  };

  /** client/digital/list 的 id 是客户-数字人关联 id，真正的数字人 id 是 digitalId */
  const defaultDigitalId = async tenantId => {
    const digitals = await request(tenantId, 'client/digital/list', { query: { perPage: 1, currentPage: 1 } });
    const row = digitals?.pageData?.[0];
    return row?.digitalId || row?.digital?.id;
  };

  const fetchDashboard = async (tenantId, query) => {
    try {
      return await request(tenantId, 'statistics/talent-review-dashboard', { query });
    } catch (e) {
      fastify.log.warn(`talent-review-dashboard failed: ${e.message}`);
      return null;
    }
  };

  /** 列表进度：邀请数 / 已提交 取 inviteStats，已评估取报告数 */
  const projectList = async ({ tenantId }) => {
    const { pageData = [], totalCount = 0 } =
      (await request(tenantId, 'project/list', {
        query: { perPage: PROJECT_FETCH_LIMIT, currentPage: 1, filter: { scene: SCENE } }
      })) || {};
    const projectIds = pageData.map(item => item.id).filter(Boolean);
    const dashboard = projectIds.length ? await fetchDashboard(tenantId, { projectIds: projectIds.join(',') }) : null;
    const dashboardProjects = new Map((dashboard?.projects || []).map(item => [String(item.projectId), item]));
    const inviteStats = new Map((dashboard?.inviteStats?.byProject || []).map(item => [String(item.projectId), item]));
    return {
      totalCount,
      memberTotal: dashboard?.inventoryScale?.memberTotal ?? null,
      pageData: pageData.map(item => {
        const stat = dashboardProjects.get(String(item.id)) || {};
        const invite = inviteStats.get(String(item.id)) || {};
        return Object.assign({}, item, {
          progress: {
            members: stat.memberCount ?? 0,
            invited: invite.total ?? 0,
            submitted: invite.used ?? 0,
            evaluated: stat.reportCount ?? 0
          }
        });
      })
    };
  };

  const projectDetail = ({ tenantId, id }) => request(tenantId, 'project/detail', { query: { id } });

  const projectStatus = ({ tenantId, id, status }) => request(tenantId, 'client/project/status', { method: 'POST', body: { id, status } });

  /** AI 面试 project-question/create 按 questionIds 全量同步（多删少补），可用于创建与编辑 */
  const syncQuestions = async ({ tenantId, projectId, questions = [], setting = {} }) => {
    const questionGroups = {};
    const questionIds = [];
    questions.forEach(item => {
      if (!item?.questionDigitalId) {
        return;
      }
      const id = String(item.questionDigitalId);
      if (questionIds.includes(id)) {
        return;
      }
      questionIds.push(id);
      if (Array.isArray(item.dimensionTypes) && item.dimensionTypes.length) {
        questionGroups[id] = { projectDimension: item.dimensionTypes };
      }
    });
    if (!questionIds.length) {
      return;
    }
    await request(tenantId, 'client/project-question/create', {
      method: 'POST',
      body: {
        projectId,
        questionIds,
        questionGroups,
        dimensions: setting.dimensions,
        dimensionWeight: setting.dimensionWeight,
        nineSquareGrid: setting.nineSquareGrid,
        enableManualScore: setting.enableManualScore,
        scoreSourceWeight: setting.scoreSourceWeight,
        manualRoleWeight: setting.manualRoleWeight
      }
    });
  };

  /**
   * 与 AI 面试 CreateFromModel 相同的三步：建项目（closed）→ 关联题目 → 开启
   * questions: [{ questionDigitalId, dimensionTypes }]
   */
  const projectCreate = async ({ tenantId, data }) => {
    const { questions = [], setting = {}, ...projectData } = data;
    const digitalId = data.digitalId || (await defaultDigitalId(tenantId));
    if (!digitalId) {
      throw new Error('AI 面试客户下没有可用的数字人');
    }
    const project = await request(tenantId, 'client/project/create', {
      method: 'POST',
      body: Object.assign({}, projectData, {
        scene: SCENE,
        digitalId,
        status: 'closed',
        setting
      })
    });
    await syncQuestions({ tenantId, projectId: project.id, questions, setting });
    await projectStatus({ tenantId, id: project.id, status: 'open' });
    return project;
  };

  /** 「盘点信息」与「评估设置」可改的 setting 字段；其余（对象信息、盘点维度）仅客户端创建的项目可改 */
  const ADMIN_EDITABLE_SETTING = ['owner', 'plannedTime', 'enableManualScore', 'scoreSourceWeight', 'manualRoleWeight', 'nineSquareGrid'];

  /** 仅草稿（closed）可编辑；admin 创建的项目只改盘点信息与评估设置，不改对象信息、维度与题目 */
  const projectSave = async ({ tenantId, data }) => {
    const { id, questions, questionModelId, setting = {} } = data;
    const project = await projectDetail({ tenantId, id });
    if (!project) {
      throw new Error('项目不存在');
    }
    if (project.status !== 'closed') {
      throw new Error('仅草稿项目可以编辑');
    }
    const editable = project.sourceType === 'client';
    const nextSetting = editable ? setting : pick(setting, ADMIN_EDITABLE_SETTING);
    const body = Object.assign(pick(data, ['name', 'language', 'description', 'startTime', 'endTime']), { id, setting: nextSetting });
    if (editable && questionModelId) {
      body.questionModelId = questionModelId;
    }
    const result = await request(tenantId, 'client/project/save', { method: 'POST', body });
    if (editable && Array.isArray(questions)) {
      await syncQuestions({ tenantId, projectId: id, questions, setting: nextSetting });
    }
    return result;
  };

  const projectOrg = ({ tenantId, id }) => request(tenantId, 'project/org', { query: { id } });

  const projectReport = ({ tenantId, id, locale }) =>
    request(tenantId, 'statistics/talent-review-dashboard', {
      query: { projectIds: id, focusProjectId: id, locale }
    });

  const modelList = ({ tenantId, perPage = 100, currentPage = 1, filter = {} }) =>
    request(tenantId, 'client/question-model/list', {
      query: { perPage, currentPage, filter: Object.assign({ type: SCENE }, filter) }
    });

  const modelDetail = ({ tenantId, id }) => request(tenantId, 'client/question-model/detail', { query: { id } });

  /** 选题：返回题目及其在当前数字人下的 questionDigital，提交时用 questionDigital id */
  const modelQuestions = async ({ tenantId, questionModelId, language, digitalId: projectDigitalId }) => {
    const digitalId = projectDigitalId || (await defaultDigitalId(tenantId));
    const result = await request(tenantId, 'client/question-model/digital-list', {
      query: {
        questionModelId,
        perPage: 200,
        currentPage: 1,
        filter: Object.assign({ scene: SCENE }, digitalId ? { digitalId } : {}, language ? { language } : {})
      }
    });
    return {
      digitalId,
      pageData: (result?.pageData || []).map(item => ({
        id: item.id,
        title: item.title,
        answerType: item.answerType,
        language: item.language,
        groups: item.groups || [],
        questionDigitalId: item.questionDigitals?.[0]?.id || null
      }))
    };
  };

  /** 本租户组织树 + 在职员工，供「发送邀请」左侧选人 */
  const orgSource = async ({ tenantId }) => {
    const orgs = await tenantModels.org.findAll({
      where: { tenantId },
      attributes: ['id', 'name', 'parentId', 'leaderUserId']
    });
    const employees = await models.employee.findAll({
      where: { tenantId },
      attributes: ['id', 'name', 'email', 'phone', 'status', 'tenantOrgIds', 'tenantUserId', 'options']
    });
    return {
      orgs: orgs.map(org => ({
        id: toIdString(org.id),
        name: org.name,
        parentId: toIdString(org.parentId) || null,
        leaderUserId: toIdString(org.leaderUserId) || null
      })),
      employees: employees
        .filter(item => !['RESIGN', 'RETIRE'].includes(item.status))
        .map(item => ({
          id: toIdString(item.id),
          name: item.name,
          email: item.email,
          phone: item.phone,
          orgId: toIdString((item.tenantOrgIds || [])[0]) || null,
          tenantUserId: toIdString(item.tenantUserId) || null,
          position: pickPositionName(item.options?.position)
        }))
    };
  };

  const buildOrgPath = (orgMap, orgId, fallback) => {
    const names = [];
    const seen = new Set();
    let current = orgMap.get(orgId);
    while (current && !seen.has(current.id)) {
      seen.add(current.id);
      names.unshift(String(current.name || '').replace(/\//g, '-'));
      current = current.parentId ? orgMap.get(current.parentId) : null;
    }
    return names.filter(Boolean).join('/') || fallback;
  };

  const listMembers = orgData => (orgData?.pageData || []).filter(item => item.nodeType === 'member');

  const findMember = (members, employee) =>
    members.find(member => {
      if (member.employeeNo && String(member.employeeNo) === employee.id) {
        return true;
      }
      if (employee.email && member.email && String(member.email).toLowerCase() === String(employee.email).toLowerCase()) {
        return true;
      }
      return !!(employee.phone && member.phone && String(member.phone) === String(employee.phone));
    });

  /**
   * 发送邀请：把选中员工与评估人同步进盘点组织 → 邀请参与人 → 按需发送人工评估邀请
   * evaluators: { [employeeId]: { superior, peer } }，值为员工 id
   */
  const invite = async ({ tenantId, id, employeeIds = [], evaluators = {}, expires, needNotice = true }) => {
    const source = await orgSource({ tenantId });
    const employeeMap = new Map(source.employees.map(item => [item.id, item]));
    const orgMap = new Map(source.orgs.map(item => [item.id, item]));
    const tenant = await tenantModels.tenant.findByPk(tenantId, { attributes: ['name'] });
    const fallbackPath = tenant?.name || 'Organization';

    const participantIds = [...new Set(employeeIds.map(String))].filter(item => employeeMap.has(item));
    if (!participantIds.length) {
      throw new Error('请选择参与人');
    }
    const evaluatorIds = new Set();
    participantIds.forEach(employeeId => {
      Object.values(evaluators[employeeId] || {}).forEach(value => {
        if (value && employeeMap.has(String(value))) {
          evaluatorIds.add(String(value));
        }
      });
    });
    const syncIds = [...new Set([...participantIds, ...evaluatorIds])];

    let orgData = await projectOrg({ tenantId, id });
    let members = listMembers(orgData);
    const leaderPaths = new Set();
    const items = syncIds
      .map(employeeId => employeeMap.get(employeeId))
      .filter(employee => !findMember(members, employee))
      .map(employee => {
        const org = employee.orgId ? orgMap.get(employee.orgId) : null;
        const orgPath = buildOrgPath(orgMap, employee.orgId, fallbackPath);
        const isLeader = !!(org && employee.tenantUserId && org.leaderUserId === employee.tenantUserId && !leaderPaths.has(orgPath));
        if (isLeader) {
          leaderPaths.add(orgPath);
        }
        return {
          orgPath,
          name: employee.name,
          employeeNo: employee.id,
          email: employee.email || undefined,
          phone: employee.phone || undefined,
          position: employee.position || undefined,
          isLeader
        };
      });
    if (items.length) {
      await request(tenantId, 'project/org/batch-add', { method: 'POST', body: { id, items } });
      orgData = await projectOrg({ tenantId, id });
      members = listMembers(orgData);
    }

    const memberIdOf = employeeId => {
      const member = findMember(members, employeeMap.get(employeeId));
      return member ? toIdString(member.memberId) : '';
    };
    const memberIds = participantIds.map(memberIdOf).filter(Boolean);
    await request(tenantId, 'project/org/batch-invite', {
      method: 'POST',
      body: Object.assign({ id, memberIds, needNotice }, expires ? { expires } : {})
    });

    const project = await projectDetail({ tenantId, id });
    const result = { invited: memberIds.length, scoreInvited: 0, errors: [] };
    if (!project?.setting?.enableManualScore) {
      return result;
    }
    const preview = await request(tenantId, 'project/manual-score-invite-preview-batch', { method: 'POST', body: { memberIds } });
    const scoreItems = [];
    (preview?.items || []).forEach(previewItem => {
      const employeeId = participantIds.find(item => memberIdOf(item) === toIdString(previewItem.memberId));
      const chosen = evaluators[employeeId] || {};
      const selections = {};
      (previewItem.requiredRoles || []).forEach(role => {
        const memberId = chosen[role] ? memberIdOf(String(chosen[role])) : '';
        if (memberId) {
          selections[role] = memberId;
        } else if (role === 'superior' && previewItem.defaultSuperiorId) {
          selections[role] = toIdString(previewItem.defaultSuperiorId);
        }
      });
      const missing = (previewItem.requiredRoles || []).filter(role => !selections[role]);
      if (missing.length) {
        result.errors.push({ memberId: previewItem.memberId, name: previewItem.ratee?.name, missing });
        return;
      }
      if (previewItem.requiredRoles?.length) {
        scoreItems.push({ memberId: toIdString(previewItem.memberId), selections });
      }
    });
    (preview?.errors || []).forEach(item => result.errors.push(item));
    if (scoreItems.length) {
      await request(tenantId, 'project/manual-score-invite-send-batch', {
        method: 'POST',
        body: { items: scoreItems, scoredRolePolicy: 'ignore' }
      });
      result.scoreInvited = scoreItems.length;
    }
    return result;
  };

  const resendMember = ({ tenantId, id, memberId, expires }) =>
    request(tenantId, 'project/org/batch-invite', {
      method: 'POST',
      body: Object.assign({ id, memberIds: [memberId], needNotice: true }, expires ? { expires } : {})
    });

  /** 个人报告：面试详情 + flowup 远程组件地址（remote-module-config.json 在 AI 面试前端站点根下） */
  const interviewReport = async ({ tenantId, id }) => {
    const credentials = await services.talentReviewSetting.getCredentials(tenantId);
    const interview = await openApiRequest(credentials, 'project/interview-detail', { query: { id } });
    let remote = null;
    if (credentials.origin) {
      try {
        const response = await fetch(`${credentials.origin.replace(/\/+$/, '')}/remote-module-config.json`);
        const config = response.ok ? await response.json() : null;
        remote = config?.url && config?.version ? { url: config.url, version: config.version } : null;
      } catch (e) {
        fastify.log.warn(`remote-module-config failed: ${e.message}`);
      }
    }
    return { interview, remote, apiHost: getApiBase(credentials.apiUrl) };
  };

  const resendEvaluator = ({ tenantId, memberId, role }) => {
    if (!MANUAL_ROLES.includes(role)) {
      throw new Error('评估角色不正确');
    }
    return request(tenantId, 'project/manual-score-invite-resend', { method: 'POST', body: { memberId, role } });
  };

  Object.assign(fastify[options.name].services, {
    talentReview: {
      projectList,
      projectDetail,
      projectCreate,
      projectSave,
      projectStatus,
      projectOrg,
      projectReport,
      modelList,
      modelDetail,
      modelQuestions,
      orgSource,
      invite,
      resendMember,
      resendEvaluator,
      interviewReport
    }
  });
});
