const fp = require('fastify-plugin');

module.exports = fp(async (fastify, options) => {
  const { services } = fastify[options.name];
  const { authenticate } = fastify.account;
  const { authenticate: tenantAuthenticate } = fastify.tenant;

  fastify.get(
    `${options.prefix}/tenant/home-setting`,
    {
      onRequest: [authenticate.user, tenantAuthenticate.tenantUser],
      schema: {
        summary: '租户首页路径设置（当前登录租户）'
      }
    },
    async request => {
      return services.homeSetting.detail({ tenantId: request.tenantUserInfo.tenantId });
    }
  );

  fastify.get(
    `${options.prefix}/tenant/admin/home-setting`,
    {
      onRequest: [authenticate.user, authenticate.admin],
      schema: {
        summary: '平台管理-租户首页路径设置详情',
        query: {
          type: 'object',
          properties: {
            tenantId: { type: 'string' }
          },
          required: ['tenantId']
        }
      }
    },
    async request => {
      return services.homeSetting.detail({ tenantId: request.query.tenantId });
    }
  );

  fastify.post(
    `${options.prefix}/tenant/admin/home-setting-save`,
    {
      onRequest: [authenticate.user, authenticate.admin],
      schema: {
        summary: '平台管理-保存租户首页路径设置',
        body: {
          type: 'object',
          properties: {
            tenantId: { type: 'string' },
            homePath: { type: 'string' }
          },
          required: ['tenantId', 'homePath']
        }
      }
    },
    async request => {
      return services.homeSetting.save({
        tenantId: request.body.tenantId,
        homePath: request.body.homePath
      });
    }
  );
});
