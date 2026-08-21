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

  const create = async (authenticatePayload, { name, phone, email, ...data }) => {
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
        resumes: data.resumes || []
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
    const orgEnums = await fastify.tenant.services.org.enums(authenticatePayload, {
      ids: employeeOrgIds
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

    await employee.update(Object.assign({}, omit(data, ['tenantId', 'createdAt', 'updatedAt']), name && { name }, updateEmail && { email: updateEmail }, updatePhone && { phone: updatePhone }));
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

  const list = async (authenticatePayload, { filter = {}, perPage = 20, currentPage = 1 }) => {
    const { tenantId } = authenticatePayload;
    const whereQuery = {};

    ['status', 'gender', 'degree', 'collegeType', 'marital'].forEach(name => {
      if (filter[name]) {
        whereQuery[name] = filter[name];
      }
    });

    if (filter['ids'] && filter['ids'].length > 0) {
      whereQuery.id = {
        [Op.in]: filter['ids']
      };
    }

    if (filter['id']) {
      whereQuery.id = filter['id'];
    }

    if (filter['keyword']) {
      whereQuery[Op.or] = [
        { name: { [Op.like]: `%${filter['keyword']}%` } },
        { nameEn: { [Op.like]: `%${filter['keyword']}%` } },
        { email: { [Op.like]: `%${filter['keyword']}%` } },
        { phone: { [Op.like]: `%${filter['keyword']}%` } },
        { city: { [Op.like]: `%${filter['keyword']}%` } },
        { college: { [Op.like]: `%${filter['keyword']}%` } }
      ];
    }

    const { count, rows } = await models.employee.findAndCountAll({
      where: Object.assign({}, whereQuery, { tenantId }),
      offset: perPage * (currentPage - 1),
      limit: perPage,
      order: [
        ['createdAt', 'DESC'],
        ['id', 'DESC']
      ]
    });

    const positionEnums = await services.position.enums(authenticatePayload, {
      ids: rows.map(item => get(item, 'options.position')).filter(item => !!item)
    });

    const allOrgIds = [...new Set(rows.flatMap(employee => getEmployeeOrgIds(employee)))];
    const orgEnums = await fastify.tenant.services.org.enums(authenticatePayload, {
      ids: allOrgIds
    });

    return {
      orgEnums,
      positionEnums,
      pageData: rows,
      totalCount: count
    };
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
