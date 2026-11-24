const fp = require('fastify-plugin');

module.exports = fp(async (fastify, options) => {
  const { services } = fastify[options.name];
  const { authenticate } = fastify.account;
  const { authenticate: tenantAuthenticate } = fastify.tenant;

  fastify.get(
    `${options.prefix}/tenant/ai-interview-projects`,
    {
      onRequest: [authenticate.user, tenantAuthenticate.tenantUser],
      schema: {
        summary: '租户-获取数据采集场景 AI 面试项目列表（强制 scene=dataCollection）',
        query: {
          type: 'object',
          properties: {
            currentPage: { type: 'number', default: 1 },
            perPage: { type: 'number', default: 20 },
            filter: { type: 'object' }
          }
        }
      }
    },
    async request => {
      return services.aiInterview.getProjects({
        tenantId: request.tenantUserInfo.tenantId,
        currentPage: request.query.currentPage,
        perPage: request.query.perPage,
        filter: Object.assign({}, request.query.filter || {}, {
          scene: 'dataCollection'
        })
      });
    }
  );
});
