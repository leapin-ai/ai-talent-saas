const fp = require('fastify-plugin');
const omit = require('lodash/omit');

module.exports = fp(async (fastify, options) => {
  const { models, services } = fastify[options.name];
  const tenantServices = fastify.tenant.services;
  const tenantModels = fastify.tenant.models;
  const { Op } = fastify.sequelize.Sequelize;

  const create = async (authenticatePayload, { name, language, locationType, ...data }) => {
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

    if ((await models.position.count({ where: { name, tenantId } })) > 0) {
      throw new Error('名称不能重复');
    }

    return await models.position.create(
      Object.assign({}, data, {
        tenantId,
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

    return position;
  };

  const save = async (authenticatePayload, { id, name, language, locationType, ...data }) => {
    const position = await detail(authenticatePayload, { id });
    const { tenantId } = authenticatePayload;

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

    await position.update(Object.assign({}, omit(data, ['tenantId', 'publishAt']), name && { name }, language && { language }, locationType && { locationType }));
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

    ['status', 'language', 'locationType'].forEach(name => {
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

    return {
      pageData: rows,
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
        description: item.name
      };
    });
  };

  Object.assign(fastify[options.name].services, {
    position: { create, list, detail, save, remove, setStatus, enums }
  });
});
