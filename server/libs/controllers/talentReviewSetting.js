const fp = require('fastify-plugin');

module.exports = fp(async (fastify, options) => {
  const { services } = fastify[options.name];
  const { authenticate } = fastify.account;
  const { authenticate: tenantAuthenticate } = fastify.tenant;

  const tenantIdQuery = {
    type: 'object',
    properties: {
      tenantId: { type: 'string' }
    },
    required: ['tenantId']
  };

  fastify.get(
    `${options.prefix}/tenant/admin/talent-review-setting`,
    {
      onRequest: [authenticate.user, authenticate.admin],
      schema: {
        summary: '平台管理-租户人才盘点设置详情（不含 SecretKey）',
        query: tenantIdQuery
      }
    },
    async request => {
      return services.talentReviewSetting.detail({ tenantId: request.query.tenantId });
    }
  );

  fastify.post(
    `${options.prefix}/tenant/admin/talent-review-setting-save`,
    {
      onRequest: [authenticate.user, authenticate.admin],
      schema: {
        summary: '平台管理-保存租户人才盘点设置（关联 AI 面试客户）',
        body: {
          type: 'object',
          properties: {
            tenantId: { type: 'string' },
            url: { type: 'string' },
            appId: { type: 'string' },
            secretKey: { type: 'string' }
          },
          required: ['tenantId', 'url', 'appId']
        }
      }
    },
    async request => {
      return services.talentReviewSetting.save(request.body);
    }
  );

  fastify.post(
    `${options.prefix}/tenant/admin/talent-review-setting-cancel`,
    {
      onRequest: [authenticate.user, authenticate.admin],
      schema: {
        summary: '平台管理-取消租户人才盘点关联',
        body: tenantIdQuery
      }
    },
    async request => {
      return services.talentReviewSetting.cancel(request.body);
    }
  );

  fastify.get(
    `${options.prefix}/tenant/admin/talent-review-setting/client`,
    {
      onRequest: [authenticate.user, authenticate.admin],
      schema: {
        summary: '平台管理-获取关联的 AI 面试客户信息',
        query: tenantIdQuery
      }
    },
    async request => {
      return services.talentReviewSetting.getClient({ tenantId: request.query.tenantId });
    }
  );

  fastify.get(
    `${options.prefix}/tenant/talent-review-setting`,
    {
      onRequest: [authenticate.user, tenantAuthenticate.tenantUser],
      schema: {
        summary: '租户-人才盘点是否已配置'
      }
    },
    async request => {
      return services.talentReviewSetting.status({ tenantId: request.tenantUserInfo.tenantId });
    }
  );
});
