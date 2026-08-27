const fp = require('fastify-plugin');
const omit = require('lodash/omit');
const get = require('lodash/get');

/**
 * 获取员工所属组织 ID 列表
 */
const getEmployeeOrgIds = employee => {
  if (!employee || !Array.isArray(employee.tenantOrgIds)) {
    return [];
  }
  return [...new Set(employee.tenantOrgIds.filter(id => id != null && id !== '').map(String))];
};

/** 表单单选部门可能提交 string，统一成 id 数组 */
const normalizeTenantOrgIds = value => {
  if (value == null || value === '') {
    return [];
  }
  if (Array.isArray(value)) {
    return [
      ...new Set(
        value
          .filter(id => id != null && id !== '')
          .map(id => (typeof id === 'object' ? String(id.id || id.value || '') : String(id)))
          .filter(Boolean)
      )
    ];
  }
  if (typeof value === 'object') {
    const id = value.id || value.value;
    return id != null && id !== '' ? [String(id)] : [];
  }
  return [String(value)];
};

module.exports = fp(async (fastify, options) => {
  const { models, services } = fastify[options.name];
  const tenantServices = fastify.tenant.services;
  const tenantModels = fastify.tenant.models;
  const { Op } = fastify.sequelize.Sequelize;

  // Performance 相关方法
  const createPerformance = async (authenticatePayload, { employeeId, date, score, evaluatorName, comment }) => {
    const { tenantId } = authenticatePayload;

    const employee = await models.employee.findByPk(employeeId);
    if (!employee || employee.tenantId !== tenantId) {
      throw new Error('未找到员工');
    }

    if (!date || !score || !evaluatorName) {
      throw new Error('评价日期、分数和评价人不能为空');
    }

    return await models.performance.create({
      employeeId,
      tenantId,
      date,
      score,
      evaluatorName,
      comment
    });
  };

  const performanceList = async (authenticatePayload, { employeeId, perPage = 20, currentPage = 1 }) => {
    const { tenantId } = authenticatePayload;

    const employee = await models.employee.findByPk(employeeId);
    if (!employee || employee.tenantId !== tenantId) {
      throw new Error('未找到员工');
    }

    const { count, rows } = await models.performance.findAndCountAll({
      where: { employeeId, tenantId },
      offset: perPage * (currentPage - 1),
      limit: perPage,
      order: [['date', 'DESC']]
    });

    return {
      pageData: rows,
      totalCount: count
    };
  };

  const performanceDetail = async (authenticatePayload, { id }) => {
    const { tenantId } = authenticatePayload;
    const performance = await models.performance.findByPk(id);

    if (!performance || performance.tenantId !== tenantId) {
      throw new Error('未找到绩效评价');
    }

    return performance;
  };

  const savePerformance = async (authenticatePayload, { id, ...data }) => {
    const performance = await performanceDetail(authenticatePayload, { id });
    await performance.update(omit(data, ['tenantId', 'employeeId']));
    return performance;
  };

  const removePerformance = async (authenticatePayload, { id }) => {
    const performance = await performanceDetail(authenticatePayload, { id });
    await performance.destroy();
  };

  const create = async (authenticatePayload, { name, phone, email, tenantOrgIds, ...data }) => {
    const { tenantId } = authenticatePayload;

    if (!name) {
      throw new Error('姓名不能为空');
    }

    if (!(email || phone)) {
      throw new Error('手机号或邮箱不能同时为空');
    }

    if (email && (await models.employee.count({ where: { email, tenantId } })) > 0) {
      throw new Error('邮箱不能重复');
    }

    if (phone && (await models.employee.count({ where: { phone, tenantId } })) > 0) {
      throw new Error('手机号不能重复');
    }

    return await models.employee.create(
      Object.assign({}, data, {
        tenantId,
        name,
        phone: phone || '',
        email: email || '',
        status: data.status || 'ACTIVE',
        options: data.options || {},
        resumes: data.resumes || [],
        tenantOrgIds: normalizeTenantOrgIds(tenantOrgIds)
      })
    );
  };

  const detail = async (authenticatePayload, { id }) => {
    const { tenantId } = authenticatePayload;
    const employee = await models.employee.findByPk(id, {
      include: [models.profile, models.performance]
    });
    if (!employee) {
      throw new Error('未找到员工');
    }
    if (employee.tenantId !== tenantId) {
      throw new Error('未找到员工');
    }

    const aiSuggest = await models.aiSuggest.findOne({
      where: {
        tenantId,
        employeeId: employee.id
      }
    });

    const positionEnums = await services.position.enums(authenticatePayload, {
      ids: [get(employee, 'options.position')].filter(item => !!item),
      names: [
        ...(get(employee, 'profile.intentionPosition') || []),
        ...(get(employee, 'profile.promotionHistory') || []).map(({ occupation }) => occupation),
        get(aiSuggest, 'shortTerm.target_position'),
        get(aiSuggest, 'longTerm.target_position'),
        get(aiSuggest, 'matchPosition.target_position')
      ].filter(item => !!item)
    });

    const employeeOrgIds = getEmployeeOrgIds(employee);
    const positionOrgIds = positionEnums.map(item => item.tenantOrgId).filter(id => id != null && id !== '');
    const orgEnums = await fastify.tenant.services.org.enums(authenticatePayload, {
      ids: [...new Set([...employeeOrgIds, ...positionOrgIds.map(String)])]
    });

    employee.setDataValue('aiSuggest', aiSuggest);
    employee.setDataValue('positionEnums', positionEnums);
    employee.setDataValue('orgEnums', orgEnums);

    return employee;
  };

  const myDetail = async authenticatePayload => {
    const { tenantId, id: tenantUserId } = authenticatePayload;
    if (!tenantUserId) {
      return null;
    }
    const employee = await models.employee.findOne({
      where: { tenantUserId, tenantId },
      attributes: ['id']
    });
    if (!employee) {
      return null;
    }
    return detail(authenticatePayload, { id: employee.id });
  };

  const save = async (authenticatePayload, { id, name, phone, email, ...data }) => {
    const employee = await detail(authenticatePayload, { id });
    const { tenantId } = authenticatePayload;

    if (!(data.email || data.phone || email || phone)) {
      throw new Error('手机号或邮箱不能同时为空');
    }

    const updateEmail = data.email !== undefined ? data.email : email;
    const updatePhone = data.phone !== undefined ? data.phone : phone;

    if (updateEmail && (await models.employee.count({ where: { email: updateEmail, tenantId, id: { [Op.not]: employee.id } } })) > 0) {
      throw new Error('邮箱不能重复');
    }

    if (updatePhone && (await models.employee.count({ where: { phone: updatePhone, tenantId, id: { [Op.not]: employee.id } } })) > 0) {
      throw new Error('手机号不能重复');
    }

    const patch = Object.assign({}, omit(data, ['tenantId', 'createdAt', 'updatedAt']), name && { name }, updateEmail && { email: updateEmail }, updatePhone && { phone: updatePhone });
    if (Object.prototype.hasOwnProperty.call(patch, 'tenantOrgIds')) {
      patch.tenantOrgIds = normalizeTenantOrgIds(patch.tenantOrgIds);
    }
    await employee.update(patch);
    return employee;
  };

  const remove = async (authenticatePayload, { id }) => {
    const employee = await detail(authenticatePayload, { id });
    await employee.destroy();
  };

  const setStatus = async (authenticatePayload, { id, status }) => {
    const employee = await detail(authenticatePayload, { id });
    const validStatuses = ['ACTIVE', 'RESIGN', 'STOP_SALARY', 'RETIRE', 'INTERN', 'PRE_EMPLOYEE'];
    if (!validStatuses.includes(status)) {
      throw new Error('状态值无效');
    }

    if (status === 'RESIGN') {
      await employee.update({ status, terminationDate: new Date() });
    } else {
      await employee.update({ status });
    }
    return employee;
  };

  const OUTDATED_ASSESSMENT_MS = 365 * 24 * 60 * 60 * 1000;

  const resolvePositionId = value => {
    if (value == null || value === '') {
      return null;
    }
    if (typeof value === 'object' && value.id != null) {
      return String(value.id);
    }
    return String(value);
  };

  const yearsInRole = hireDate => {
    if (!hireDate) {
      return null;
    }
    const start = new Date(hireDate);
    if (Number.isNaN(start.getTime())) {
      return null;
    }
    const years = (Date.now() - start.getTime()) / (365.25 * 24 * 60 * 60 * 1000);
    if (years < 0) {
      return 0;
    }
    return Math.max(0, Math.floor(years));
  };

  const normalizeReadiness = value => {
    if (value == null || value === '') {
      return null;
    }
    const num = Number(value);
    if (!Number.isFinite(num)) {
      return null;
    }
    return Math.min(100, Math.max(0, Math.round(num)));
  };

  const resolveAssessmentStatus = (assessment, now = Date.now()) => {
    if (!assessment) {
      return 'never';
    }
    const updatedAt = assessment.updatedAt ? new Date(assessment.updatedAt).getTime() : NaN;
    if (Number.isFinite(updatedAt) && now - updatedAt > OUTDATED_ASSESSMENT_MS) {
      return 'outdated';
    }
    return 'assessed';
  };

  const enrichTalentRows = async (authenticatePayload, rows, { positionId } = {}) => {
    const { tenantId } = authenticatePayload;
    const tenantUserIds = [...new Set(rows.map(item => item.tenantUserId).filter(Boolean))];
    const assessmentMap = new Map();
    if (tenantUserIds.length) {
      const assessments = await models.assessment.findAll({
        where: {
          tenantId,
          tenantUserId: { [Op.in]: tenantUserIds }
        }
      });
      assessments.forEach(row => {
        assessmentMap.set(row.tenantUserId, row);
      });
    }

    const analysisReadinessMap = new Map();
    if (positionId && models.positionEmployeeSkillAnalysis) {
      const employeeIds = [...new Set(rows.map(item => item.id).filter(Boolean))];
      if (employeeIds.length) {
        const analyses = await models.positionEmployeeSkillAnalysis.findAll({
          where: {
            tenantId,
            positionId,
            employeeId: { [Op.in]: employeeIds }
          },
          attributes: ['employeeId', 'readiness']
        });
        analyses.forEach(row => {
          analysisReadinessMap.set(String(row.employeeId), row.readiness);
        });
      }
    }

    // 所属部门：优先岗位上的部门，其次员工 tenantOrgIds
    const positionIds = [...new Set(rows.map(item => resolvePositionId(get(item, 'options.position'))).filter(Boolean))];
    const positionOrgMap = new Map();
    if (positionIds.length) {
      const positions = await models.position.findAll({
        where: {
          tenantId,
          id: { [Op.in]: positionIds }
        },
        attributes: ['id', 'tenantOrgId']
      });
      positions.forEach(position => {
        if (position.tenantOrgId != null && position.tenantOrgId !== '') {
          positionOrgMap.set(String(position.id), String(position.tenantOrgId));
        }
      });
    }

    const resolveDepartmentOrgId = plain => {
      const posId = resolvePositionId(get(plain, 'options.position'));
      if (posId && positionOrgMap.has(String(posId))) {
        return positionOrgMap.get(String(posId));
      }
      const employeeOrgIds = getEmployeeOrgIds(plain);
      return employeeOrgIds[0] || null;
    };

    const departmentOrgIds = [...new Set(rows.map(item => resolveDepartmentOrgId(item.toJSON ? item.toJSON() : item)).filter(Boolean))];

    // 组织树：本部门无 leader 时沿 parent 向上找
    const orgById = new Map();
    if (departmentOrgIds.length && tenantModels?.org) {
      const orgs = await tenantModels.org.findAll({
        where: { tenantId },
        attributes: ['id', 'parentId', 'leaderUserId']
      });
      orgs.forEach(org => {
        orgById.set(String(org.id), {
          id: String(org.id),
          parentId: org.parentId != null && org.parentId !== '' ? String(org.parentId) : null,
          leaderUserId: org.leaderUserId != null && org.leaderUserId !== '' ? String(org.leaderUserId) : null
        });
      });
    }

    const findLeaderUserIdAlongTree = orgId => {
      let current = orgById.get(String(orgId));
      const seen = new Set();
      while (current && !seen.has(current.id)) {
        seen.add(current.id);
        if (current.leaderUserId) {
          return current.leaderUserId;
        }
        if (!current.parentId) {
          break;
        }
        current = orgById.get(current.parentId);
      }
      return null;
    };

    const orgLeaderUserIdMap = new Map();
    const leaderUserIds = new Set();
    departmentOrgIds.forEach(orgId => {
      const leaderUserId = findLeaderUserIdAlongTree(orgId);
      if (leaderUserId) {
        orgLeaderUserIdMap.set(String(orgId), leaderUserId);
        leaderUserIds.add(leaderUserId);
      }
    });

    // leader 租户用户 → 员工档案
    const leaderEmployeeNameMap = new Map();
    if (leaderUserIds.size) {
      const leaderEmployees = await models.employee.findAll({
        where: {
          tenantId,
          tenantUserId: { [Op.in]: [...leaderUserIds] }
        },
        attributes: ['id', 'name', 'nameEn', 'tenantUserId']
      });
      leaderEmployees.forEach(employee => {
        const name = employee.name || employee.nameEn;
        if (name && employee.tenantUserId != null) {
          leaderEmployeeNameMap.set(String(employee.tenantUserId), name);
        }
      });
    }

    const now = Date.now();
    return rows.map(row => {
      const plain = row.toJSON ? row.toJSON() : row;
      const options = plain.options && typeof plain.options === 'object' ? plain.options : {};
      const assessment = plain.tenantUserId ? assessmentMap.get(plain.tenantUserId) : null;
      const lastAssessment = resolveAssessmentStatus(assessment, now);
      const fromAnalysis = analysisReadinessMap.has(String(plain.id)) ? normalizeReadiness(analysisReadinessMap.get(String(plain.id))) : null;
      const fromOptions = lastAssessment === 'never' ? null : normalizeReadiness(options.readiness);
      const readiness = fromAnalysis != null ? fromAnalysis : fromOptions;
      const departmentOrgId = resolveDepartmentOrgId(plain);
      const leaderUserId = departmentOrgId ? orgLeaderUserIdMap.get(String(departmentOrgId)) : null;
      const leaderEmployeeName = leaderUserId ? leaderEmployeeNameMap.get(String(leaderUserId)) : null;
      return Object.assign({}, plain, {
        site: plain.city || options.site || '',
        managerName: leaderEmployeeName || options.managerName || options.manager || '',
        inRoleYears: yearsInRole(plain.hireDate),
        lastAssessment,
        readiness
      });
    });
  };

  const summarizeTalentMetrics = list => {
    const metrics = { total: list.length, assessed: 0, outdated: 0, never: 0 };
    list.forEach(item => {
      if (item.lastAssessment === 'assessed') {
        metrics.assessed += 1;
      } else if (item.lastAssessment === 'outdated') {
        metrics.outdated += 1;
      } else {
        metrics.never += 1;
      }
    });
    return metrics;
  };

  const EMPLOYEE_STATUS = new Set(['ACTIVE', 'RESIGN', 'STOP_SALARY', 'RETIRE', 'INTERN', 'PRE_EMPLOYEE']);

  const buildPositionWhere = positionId => {
    const sequelize = fastify.sequelize.instance;
    // options.position 可能是 string id，也可能是 { id, name }
    return sequelize.where(sequelize.literal(`CASE WHEN jsonb_typeof("options"->'position') = 'string' THEN "options"->>'position' ELSE COALESCE("options"->'position'->>'id', '') END`), positionId);
  };

  const list = async (authenticatePayload, { filter = {}, perPage = 20, currentPage = 1, positionId: positionIdParam } = {}) => {
    const { tenantId } = authenticatePayload;
    const andConditions = [{ tenantId }];

    ['status', 'gender', 'degree', 'collegeType', 'marital'].forEach(name => {
      const value = filter[name];
      if (value == null || value === '') {
        return;
      }
      // UserSelect 等组件可能带上 status=0（用户状态），不能落到员工 ENUM
      if (name === 'status' && !EMPLOYEE_STATUS.has(String(value))) {
        return;
      }
      andConditions.push({ [name]: value });
    });

    if (filter['ids'] && filter['ids'].length > 0) {
      andConditions.push({
        id: {
          [Op.in]: filter['ids']
        }
      });
    }

    if (filter['id']) {
      andConditions.push({ id: filter['id'] });
    }

    const positionId = resolvePositionId(filter.position || positionIdParam);
    if (positionId) {
      andConditions.push(buildPositionWhere(positionId));
    }

    if (filter['keyword']) {
      const keyword = String(filter['keyword']).trim();
      if (keyword) {
        andConditions.push({
          [Op.or]: [
            { name: { [Op.like]: `%${keyword}%` } },
            { nameEn: { [Op.like]: `%${keyword}%` } },
            { email: { [Op.like]: `%${keyword}%` } },
            { phone: { [Op.like]: `%${keyword}%` } },
            { city: { [Op.like]: `%${keyword}%` } },
            { college: { [Op.like]: `%${keyword}%` } }
          ]
        });
      }
    }

    const whereQuery = { [Op.and]: andConditions };
    const withTalentAnalysis = filter.withTalentAnalysis === true || filter.withTalentAnalysis === 'true' || !!positionId;

    const { count, rows } = await models.employee.findAndCountAll({
      where: whereQuery,
      offset: perPage * (currentPage - 1),
      limit: perPage,
      order: [
        ['createdAt', 'DESC'],
        ['id', 'DESC']
      ]
    });

    const pageData = withTalentAnalysis ? await enrichTalentRows(authenticatePayload, rows, { positionId }) : rows;

    const positionEnums = await services.position.enums(authenticatePayload, {
      ids: pageData.map(item => get(item, 'options.position')).filter(item => !!item)
    });

    const allOrgIds = [
      ...new Set([
        ...pageData.flatMap(employee => getEmployeeOrgIds(employee)),
        ...positionEnums
          .map(item => item.tenantOrgId)
          .filter(id => id != null && id !== '')
          .map(String)
      ])
    ];
    const orgEnums = await fastify.tenant.services.org.enums(authenticatePayload, {
      ids: allOrgIds
    });

    const result = {
      orgEnums,
      positionEnums,
      pageData,
      totalCount: count
    };

    if (withTalentAnalysis && positionId) {
      const allRows = await models.employee.findAll({
        where: whereQuery,
        attributes: ['id', 'tenantUserId', 'hireDate', 'city', 'options', 'name', 'nameEn', 'avatar']
      });
      const enrichedAll = await enrichTalentRows(authenticatePayload, allRows, { positionId });
      result.talentMetrics = summarizeTalentMetrics(enrichedAll);
    }

    return result;
  };

  const recommend = async (authenticatePayload, { perPage = 4 }) => {
    const { tenantId } = authenticatePayload;
    const whereQuery = {
      tenantId
    };

    const employeeList = await models.employee.findAll({
      include: [models.profile],
      where: whereQuery,
      order: fastify.sequelize.instance.random(),
      limit: perPage
    });

    const positionEnums = await services.position.enums(authenticatePayload, {
      ids: employeeList.map(item => get(item, 'options.position')).filter(item => !!item)
    });

    return {
      list: employeeList,
      positionEnums
    };
  };

  const search = async (authenticatePayload, props) => {
    const { tenantId } = authenticatePayload;
    const resData = await fastify.task.services.executor({
      type: 'search',
      task: {
        input: {
          ...props,
          tenantId
        }
      }
    });

    const employeeList = await models.employee.findAll({
      include: [models.profile],
      where: {
        tenantId,
        id: {
          [Op.in]: resData.pageData.map(item => item.id)
        }
      }
    });

    const positionEnums =
      employeeList.length > 0
        ? await services.position.enums(authenticatePayload, {
            ids: employeeList.map(item => get(item, 'options.position')).filter(item => !!item)
          })
        : [];

    const employeeMap = new Map(employeeList.map(item => [item.id, item]));

    return {
      pageData: resData.pageData
        .map(item => {
          const employee = employeeMap.get(item.id);
          if (!employee) {
            return null;
          }

          const employeeData = employee.toJSON();

          if (item.highlight) {
            employeeData.highlight = item.highlight;
          }

          return employeeData;
        })
        .filter(item => !!item),
      positionEnums,
      totalCount: resData.totalCount
    };
  };

  const saveProfile = async (authenticatePayload, { id, ...profileData }) => {
    const employee = await detail(authenticatePayload, { id });
    const { tenantId } = authenticatePayload;

    let profile = await models.profile.findOne({
      where: { employeeId: employee.id, tenantId }
    });

    if (!profile) {
      profile = await models.profile.create({
        employeeId: employee.id,
        tenantId,
        ...profileData
      });
    } else {
      await profile.update(profileData);
    }

    return profile;
  };

  const linkTenantUser = async (authenticatePayload, { id, tenantUserId }) => {
    const { tenantId } = authenticatePayload;
    const employee = await models.employee.findByPk(id);
    if (!employee || employee.tenantId !== tenantId) {
      throw new Error('未找到员工');
    }

    if (employee.tenantUserId) {
      throw new Error('该员工档案已关联用户');
    }

    const existingEmployee = await models.employee.findOne({
      where: { tenantUserId, tenantId }
    });
    if (existingEmployee) {
      throw new Error('该用户已关联其他员工');
    }

    await employee.update({ tenantUserId });
    return employee;
  };

  const unlinkTenantUser = async (authenticatePayload, { id }) => {
    const { tenantId } = authenticatePayload;
    const employee = await models.employee.findByPk(id);
    if (!employee || employee.tenantId !== tenantId) {
      throw new Error('未找到员工');
    }

    await employee.update({ tenantUserId: null });
    return employee;
  };

  const enhanceUserList = async (userList, tenantId) => {
    const ids = [
      ...new Set(
        userList.pageData
          .map(item => item.options?.position)
          .filter(item => item != null && item !== '')
          .map(item => (typeof item === 'object' && item.id != null ? item.id : item))
      )
    ];
    let positionList = [];
    if (ids.length) {
      positionList = (
        await services.position.list(
          { tenantId },
          {
            filter: { ids },
            perPage: Math.max(ids.length, 1),
            currentPage: 1
          }
        )
      ).pageData;
    }

    const tenantUserIds = userList.pageData.map(item => item.id).filter(Boolean);
    const employeeList = tenantUserIds.length
      ? await models.employee.findAll({
          where: { tenantUserId: { [Op.in]: tenantUserIds }, tenantId },
          attributes: ['id', 'name', 'tenantUserId']
        })
      : [];
    const employeeMap = new Map(employeeList.map(e => [e.tenantUserId, e]));

    const enhancedPageData = userList.pageData.map(item => {
      const employee = employeeMap.get(item.id);
      return Object.assign({}, item.toJSON ? item.toJSON() : item, {
        employee: employee || null
      });
    });

    return Object.assign({}, userList, {
      pageData: enhancedPageData,
      positionList
    });
  };

  const userList = async (authenticatePayload, props) => {
    const { tenantId } = authenticatePayload;
    const userList = await tenantServices.user.list(Object.assign({}, props, { tenantId }));
    return enhanceUserList(userList, tenantId);
  };

  const adminUserList = async ({ tenantId }, props) => {
    const userList = await tenantServices.user.list(Object.assign({}, props, { tenantId }));
    return enhanceUserList(userList, tenantId);
  };

  Object.assign(fastify[options.name].services, {
    employee: { create, list, detail, myDetail, save, remove, setStatus, recommend, search, saveProfile, linkTenantUser, unlinkTenantUser, userList, adminUserList },
    performance: {
      create: createPerformance,
      list: performanceList,
      detail: performanceDetail,
      save: savePerformance,
      remove: removePerformance
    }
  });
});
