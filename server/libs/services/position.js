const fp = require('fastify-plugin');
const omit = require('lodash/omit');

module.exports = fp(async (fastify, options) => {
  const { models, services } = fastify[options.name];
  const { Op } = fastify.sequelize.Sequelize;

  // 组织已删除/关闭时按「未设置部门」处理，不抛错
  const resolveTenantOrgId = async (authenticatePayload, tenantOrgId) => {
    if (tenantOrgId == null || tenantOrgId === '') {
      return null;
    }
    const orgEnums = await fastify.tenant.services.org.enums(authenticatePayload, {
      ids: [tenantOrgId]
    });
    if (!orgEnums.length) {
      return null;
    }
    return tenantOrgId;
  };

  const create = async (authenticatePayload, { name, language, locationType, tenantOrgId, ...data }) => {
    const { tenantId } = authenticatePayload;

    if (!name) {
      throw new Error('名称不能为空');
    }

    if (!language) {
      throw new Error('语言要求不能为空');
    }

    if (!locationType) {
      throw new Error('工作地点类型不能为空');
    }

    const resolvedTenantOrgId = await resolveTenantOrgId(authenticatePayload, tenantOrgId);

    if ((await models.position.count({ where: { name, tenantId } })) > 0) {
      throw new Error('名称不能重复');
    }

    return await models.position.create(
      Object.assign({}, data, {
        tenantId,
        tenantOrgId: resolvedTenantOrgId,
        name,
        language,
        locationType,
        status: data.status || 'draft',
        capacity: data.capacity || '',
        salary: data.salary || {},
        location: data.location || {}
      })
    );
  };

  const detail = async (authenticatePayload, { id }) => {
    const { tenantId } = authenticatePayload;
    const position = await models.position.findByPk(id);
    if (!position) {
      throw new Error('未找到职位');
    }
    if (position.tenantId !== tenantId) {
      throw new Error('未找到职位');
    }

    const orgEnums = await fastify.tenant.services.org.enums(authenticatePayload, {
      ids: position.tenantOrgId ? [position.tenantOrgId] : []
    });
    // 关联组织已删：对外当作未设置部门
    if (position.tenantOrgId && !orgEnums.length) {
      position.setDataValue('tenantOrgId', null);
    }
    position.setDataValue('orgEnums', orgEnums);

    return position;
  };

  const save = async (authenticatePayload, { id, name, language, locationType, tenantOrgId, ...data }) => {
    const position = await detail(authenticatePayload, { id });
    const { tenantId } = authenticatePayload;

    let resolvedTenantOrgId;
    if (tenantOrgId !== undefined) {
      resolvedTenantOrgId = await resolveTenantOrgId(authenticatePayload, tenantOrgId);
    }

    if (
      (await models.position.count({
        where: {
          name,
          tenantId,
          id: { [Op.not]: position.id }
        }
      })) > 0
    ) {
      throw new Error('名称不能重复');
    }

    await position.update(
      Object.assign({}, omit(data, ['tenantId', 'publishAt', 'orgEnums']), name && { name }, language && { language }, locationType && { locationType }, tenantOrgId !== undefined && { tenantOrgId: resolvedTenantOrgId })
    );
    return position;
  };

  const remove = async (authenticatePayload, { id }) => {
    const position = await detail(authenticatePayload, { id });
    await position.destroy();
  };

  const setStatus = async (authenticatePayload, { id, status }) => {
    const position = await detail(authenticatePayload, { id });
    const validStatuses = ['draft', 'published', 'closed'];
    if (!validStatuses.includes(status)) {
      throw new Error('状态值无效');
    }

    if (status === 'published') {
      await position.update({ status, publishAt: new Date() });
    } else {
      await position.update({ status });
    }
    return position;
  };

  const list = async (authenticatePayload, { filter = {}, perPage = 20, currentPage = 1 }) => {
    const { tenantId } = authenticatePayload;
    const whereQuery = {};

    ['status', 'language', 'locationType', 'tenantOrgId'].forEach(name => {
      if (filter[name]) {
        whereQuery[name] = filter[name];
      }
    });

    if (filter['ids'] && filter['ids'].length > 0) {
      whereQuery.id = {
        [Op.in]: filter['ids']
      };
    }

    if (filter['keyword']) {
      whereQuery[Op.or] = [
        {
          name: {
            [Op.like]: `%${filter['keyword']}%`
          }
        },
        {
          description: {
            [Op.like]: `%${filter['keyword']}%`
          }
        }
      ];
    }

    const { count, rows } = await models.position.findAndCountAll({
      where: Object.assign({}, whereQuery, {
        tenantId
      }),
      offset: perPage * (currentPage - 1),
      limit: perPage,
      order: [
        ['createdAt', 'DESC'],
        ['id', 'DESC']
      ]
    });

    const allOrgIds = [...new Set(rows.map(item => item.tenantOrgId).filter(id => id != null && id !== ''))];
    const orgEnums =
      allOrgIds.length > 0
        ? await fastify.tenant.services.org.enums(authenticatePayload, {
            ids: allOrgIds
          })
        : [];
    const validOrgIdSet = new Set(orgEnums.map(item => String(item.value)));

    const positionIds = rows.map(item => String(item.id));
    const employeeCountMap = new Map();
    if (positionIds.length > 0) {
      const sequelize = fastify.sequelize.instance;
      const [countRows] = await sequelize.query(
        `
        SELECT CASE
                 WHEN jsonb_typeof("options"->'position') = 'string' THEN "options"->>'position'
                 ELSE COALESCE("options"->'position'->>'id', '')
               END AS position_id,
               COUNT(*)::int AS employee_count
        FROM t_employee
        WHERE deleted_at IS NULL
          AND tenant_id = :tenantId
          AND CASE
                WHEN jsonb_typeof("options"->'position') = 'string' THEN "options"->>'position'
                ELSE COALESCE("options"->'position'->>'id', '')
              END IN (:positionIds)
        GROUP BY 1
        `,
        {
          replacements: {
            tenantId,
            positionIds
          }
        }
      );
      (countRows || []).forEach(row => {
        if (row.position_id) {
          employeeCountMap.set(String(row.position_id), Number(row.employee_count) || 0);
        }
      });
    }

    const pageData = rows.map(row => {
      const plain = row.toJSON ? row.toJSON() : row;
      const tenantOrgId = plain.tenantOrgId != null && plain.tenantOrgId !== '' && validOrgIdSet.has(String(plain.tenantOrgId)) ? plain.tenantOrgId : null;
      return Object.assign({}, plain, {
        tenantOrgId,
        employeeCount: employeeCountMap.get(String(plain.id)) || 0
      });
    });

    return {
      orgEnums,
      pageData,
      totalCount: count
    };
  };

  const enums = async (authenticatePayload, { ids, names }) => {
    const { tenantId } = authenticatePayload;
    const whereQuery = {
      tenantId,
      [Op.or]: [{ id: { [Op.in]: ids || [] } }, { name: { [Op.in]: names || [] } }]
    };
    const positions = await models.position.findAll({
      where: whereQuery
    });

    return positions.map(item => {
      return {
        value: item.id,
        description: item.name,
        tenantOrgId: item.tenantOrgId || null
      };
    });
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

  const normalizeSkillRows = skills => {
    if (!Array.isArray(skills)) {
      return [];
    }
    const allowedStatus = new Set(['critical', 'gap', 'onTarget', 'above']);
    return skills
      .map(item => {
        if (!item || typeof item !== 'object') {
          return null;
        }
        const name = typeof item.name === 'string' ? item.name.trim() : '';
        if (!name) {
          return null;
        }
        const current = Number(item.current);
        const required = Number(item.required);
        const status = typeof item.status === 'string' && allowedStatus.has(item.status) ? item.status : undefined;
        const evidence = typeof item.evidence === 'string' ? item.evidence.trim().slice(0, 100) : '';
        return {
          id: typeof item.id === 'string' && item.id ? item.id : undefined,
          name: name.slice(0, 200),
          current: Number.isFinite(current) ? Math.min(5, Math.max(0, Math.round(current))) : 0,
          required: Number.isFinite(required) ? Math.min(5, Math.max(0, Math.round(required))) : 0,
          ...(status ? { status } : {}),
          ...(evidence ? { evidence } : {})
        };
      })
      .filter(Boolean);
  };

  const normalizePriorityGaps = gaps => {
    if (!Array.isArray(gaps)) {
      return [];
    }
    return gaps
      .map((item, index) => {
        if (!item || typeof item !== 'object') {
          return null;
        }
        const title = typeof item.title === 'string' ? item.title.trim() : '';
        if (!title) {
          return null;
        }
        const rank = Number(item.rank);
        const current = Number(item.current);
        const required = Number(item.required);
        return {
          rank: Number.isFinite(rank) ? Math.round(rank) : index + 1,
          title: title.slice(0, 200),
          description: typeof item.description === 'string' ? item.description : '',
          ...(Number.isFinite(current) ? { current: Math.min(5, Math.max(0, Math.round(current))) } : {}),
          ...(Number.isFinite(required) ? { required: Math.min(5, Math.max(0, Math.round(required))) } : {})
        };
      })
      .filter(Boolean);
  };

  const normalizeDevelopmentPlan = plan => {
    if (!plan || typeof plan !== 'object' || Array.isArray(plan)) {
      return null;
    }
    const horizons = Array.isArray(plan.horizons) ? plan.horizons : [];
    const normalizedHorizons = horizons
      .map((item, index) => {
        if (!item || typeof item !== 'object') {
          return null;
        }
        const items = Array.isArray(item.items)
          ? item.items
              .map(row => {
                if (!row || typeof row !== 'object') {
                  return null;
                }
                const title = typeof row.title === 'string' ? row.title.trim() : '';
                if (!title) {
                  return null;
                }
                return {
                  tag: typeof row.tag === 'string' ? row.tag.trim().slice(0, 8) : '',
                  title: title.slice(0, 200),
                  meta: typeof row.meta === 'string' ? row.meta.slice(0, 120) : ''
                };
              })
              .filter(Boolean)
          : [];
        return {
          key: typeof item.key === 'string' ? item.key : String(index + 1),
          label: typeof item.label === 'string' ? item.label.slice(0, 40) : '',
          period: typeof item.period === 'string' ? item.period.slice(0, 40) : '',
          title: typeof item.title === 'string' ? item.title.slice(0, 80) : '',
          tone: typeof item.tone === 'string' ? item.tone.slice(0, 20) : undefined,
          items,
          target: typeof item.target === 'string' ? item.target.slice(0, 120) : ''
        };
      })
      .filter(Boolean);

    if (normalizedHorizons.length === 0) {
      return null;
    }

    return {
      subtitle: typeof plan.subtitle === 'string' ? plan.subtitle.slice(0, 80) : '',
      horizons: normalizedHorizons
    };
  };

  const normalizeMetrics = metrics => {
    if (!metrics || typeof metrics !== 'object') {
      return {};
    }
    const criticalGaps = Number(metrics.criticalGaps);
    const atOrAbove = Number(metrics.atOrAbove);
    const monthsToClose = Number(metrics.monthsToClose);
    return {
      criticalGaps: Number.isFinite(criticalGaps) ? Math.max(0, Math.round(criticalGaps)) : 0,
      atOrAbove: Number.isFinite(atOrAbove) ? Math.max(0, Math.round(atOrAbove)) : 0,
      monthsToClose: Number.isFinite(monthsToClose) ? Math.max(0, Math.round(monthsToClose)) : null
    };
  };

  const skillAnalysisDetail = async (authenticatePayload, { positionId, employeeId }) => {
    const { tenantId } = authenticatePayload;
    if (!positionId || !employeeId) {
      throw new Error('岗位与员工不能为空');
    }

    const position = await detail(authenticatePayload, { id: positionId });
    const employee = await models.employee.findByPk(employeeId);
    if (!employee || employee.tenantId !== tenantId) {
      throw new Error('未找到员工');
    }

    const analysis = await models.positionEmployeeSkillAnalysis.findOne({
      where: {
        tenantId,
        positionId: String(positionId),
        employeeId: String(employeeId)
      }
    });

    return {
      position: {
        id: position.id,
        name: position.name
      },
      employee: {
        id: employee.id,
        name: employee.name || employee.nameEn || '',
        nameEn: employee.nameEn || '',
        avatar: employee.avatar || null
      },
      analysis: analysis
        ? {
            id: analysis.id,
            readiness: analysis.readiness,
            summary: analysis.summary || '',
            metrics: analysis.metrics || {},
            skills: analysis.skills || [],
            priorityGaps: analysis.priorityGaps || [],
            developmentPlan: analysis.developmentPlan || null
          }
        : null
    };
  };

  const skillAnalysisSave = async (authenticatePayload, { positionId, employeeId, readiness, summary, metrics, skills, priorityGaps, developmentPlan }) => {
    const { tenantId } = authenticatePayload;
    if (!positionId || !employeeId) {
      throw new Error('岗位与员工不能为空');
    }

    await detail(authenticatePayload, { id: positionId });
    const employee = await models.employee.findByPk(employeeId);
    if (!employee || employee.tenantId !== tenantId) {
      throw new Error('未找到员工');
    }

    const payload = {
      readiness: normalizeReadiness(readiness),
      summary: typeof summary === 'string' ? summary : '',
      metrics: normalizeMetrics(metrics),
      skills: normalizeSkillRows(skills),
      priorityGaps: normalizePriorityGaps(priorityGaps),
      developmentPlan: normalizeDevelopmentPlan(developmentPlan)
    };

    let analysis = await models.positionEmployeeSkillAnalysis.findOne({
      where: {
        tenantId,
        positionId: String(positionId),
        employeeId: String(employeeId)
      }
    });

    if (analysis) {
      await analysis.update(payload);
    } else {
      analysis = await models.positionEmployeeSkillAnalysis.create({
        tenantId,
        positionId: String(positionId),
        employeeId: String(employeeId),
        ...payload
      });
    }

    return {
      id: analysis.id,
      readiness: analysis.readiness,
      summary: analysis.summary || '',
      metrics: analysis.metrics || {},
      skills: analysis.skills || [],
      priorityGaps: analysis.priorityGaps || [],
      developmentPlan: analysis.developmentPlan || null
    };
  };

  Object.assign(fastify[options.name].services, {
    position: { create, list, detail, save, remove, setStatus, enums, skillAnalysisDetail, skillAnalysisSave }
  });
});
