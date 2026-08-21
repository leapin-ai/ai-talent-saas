const fp = require('fastify-plugin');

module.exports = fp(async (fastify, options) => {
  const { services } = fastify[options.name];
  const { authenticate } = fastify.account;

  fastify.get(
    `${options.prefix}/tenant/admin/ai-interview-setting`,
    {
      onRequest: [authenticate.user, authenticate.admin],
      schema: {
        summary: '平台管理-租户AI面试设置详情（不含 SecretKey）',
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
      return services.aiInterview.detail({ tenantId: request.query.tenantId });
    }
  );

  fastify.post(
    `${options.prefix}/tenant/admin/ai-interview-setting-save`,
    {
      onRequest: [authenticate.user, authenticate.admin],
      schema: {
        summary: '平台管理-保存租户AI面试设置',
        body: {
          type: 'object',
          properties: {
            tenantId: { type: 'string' },
            cdnUrl: { type: 'string' },
            apiUrl: { type: 'string' },
            appId: { type: 'string' },
            secretKey: { type: 'string' }
          },
          required: ['tenantId', 'cdnUrl', 'apiUrl', 'appId']
        }
      }
    },
    async request => {
      return services.aiInterview.save(request.body);
    }
  );
});
