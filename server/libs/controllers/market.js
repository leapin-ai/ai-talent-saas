const fp = require('fastify-plugin');

module.exports = fp(async (fastify, options) => {
  const { services } = fastify[options.name];
  const { authenticate: tenantAuthenticate } = fastify.tenant;
  const { authenticate } = fastify.account;

  fastify.get(
    `${options.prefix}/tenant/market/recommend`,
    {
      onRequest: [authenticate.user, tenantAuthenticate.tenantUser],
      schema: {
        summary: '推荐用户',
        query: {
          type: 'object',
          properties: {
            perPage: {
              type: 'number',
              default: 4
            }
          }
        }
      }
    },
    async request => {
      return services.employee.recommend(request.tenantUserInfo, request.query);
    }
  );
});
