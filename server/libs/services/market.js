const fp = require('fastify-plugin');

module.exports = fp(async (fastify, options) => {
  //推荐
  const recommend = async (authenticatePayload, { perPage }) => {
    const { tenantId } = authenticatePayload;
    const { models, services } = fastify[options.name];
    const { Op } = fastify.sequelize.Sequelize;
    const list = await fastify.tenant.models.user.findAll({
      where: {
        tenantId
      },
      order: fastify.sequelize.instance.random(),
      limit: perPage
    });

    const employeeList = await models.employee.findAll({
      where: {
        tenantUserId: {
          [Op.in]: list.map(item => item.id)
        },
        tenantId
      }
    });

    const employeeMap = new Map(employeeList.map(item => [item.tenantUserId, item]));

    list.forEach(item => {
      item.setDataValue('employee', employeeMap.get(item.id));
    });

    return list;
  };
  Object.assign(fastify[options.name].services, {
    market: {
      recommend
    }
  });
});
