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
            version: { type: 'string' },
            apiUrl: { type: 'string' },
            appId: { type: 'string' },
            secretKey: { type: 'string' }
          },
          required: ['tenantId', 'cdnUrl', 'version', 'apiUrl', 'appId']
        }
      }
    },
    async request => {
      return services.aiInterview.save(request.body);
    }
  );

  fastify.get(
    `${options.prefix}/tenant/admin/ai-interview-projects`,
    {
      onRequest: [authenticate.user, authenticate.admin],
      schema: {
        summary: '平台管理-通过 open-api 获取 AI 面试项目列表',
        query: {
          type: 'object',
          properties: {
            tenantId: { type: 'string' },
            currentPage: { type: 'number', default: 1 },
            perPage: { type: 'number', default: 20 },
            filter: { type: 'object' }
          },
          required: ['tenantId']
        }
      }
    },
    async request => {
      return services.aiInterview.getProjects(request.query);
    }
  );

  fastify.post(
    `${options.prefix}/tenant/admin/ai-interview-feature-binding-save`,
    {
      onRequest: [authenticate.user, authenticate.admin],
      schema: {
        summary: '平台管理-保存 AI 面试功能项与项目绑定',
        body: {
          type: 'object',
          properties: {
            tenantId: { type: 'string' },
            key: { type: 'string' },
            projectId: { type: 'string' },
            projectName: { type: 'string' },
            clientId: { type: 'string' }
          },
          required: ['tenantId', 'key', 'projectId']
        }
      }
    },
    async request => {
      return services.aiInterview.saveFeatureBinding(request.body);
    }
  );

  fastify.post(
    `${options.prefix}/tenant/admin/ai-interview-feature-binding-remove`,
    {
      onRequest: [authenticate.user, authenticate.admin],
      schema: {
        summary: '平台管理-删除 AI 面试功能项与项目绑定',
        body: {
          type: 'object',
          properties: {
            tenantId: { type: 'string' },
            key: { type: 'string' }
          },
          required: ['tenantId', 'key']
        }
      }
    },
    async request => {
      return services.aiInterview.removeFeatureBinding(request.body);
    }
  );
});
