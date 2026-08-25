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

  Object.assign(fastify[options.name].services, {
    position: { create, list, detail, save, remove, setStatus, enums }
  });
});
