const fp = require('fastify-plugin');

module.exports = fp(async (fastify, options) => {
  const { services } = fastify[options.name];
  const { authenticate: tenantAuthenticate } = fastify.tenant;
  const { authenticate } = fastify.account;

  // 解析简历文件（通过文件ID）
  fastify.post(
    `${options.prefix}/tenant/resume/parse-file-id`,
    {
      onRequest: [authenticate.user, tenantAuthenticate.tenantUser],
      schema: {
        summary: '解析简历文件（通过文件ID）',
        body: {
          type: 'object',
          properties: {
            id: {
              type: 'string'
            },
            force: {
              type: 'boolean',
              default: false,
              description: '是否强制重新解析'
            }
          },
          required: ['id']
        }
      }
    },
    async request => {
      return services.resume.parseFileId(Object.assign({}, request.body, { userInfo: request.userInfo }));
    }
  );

  // 批量解析简历文件（通过文件ID）
  fastify.post(
    `${options.prefix}/tenant/resume/parse-file-ids`,
    {
      onRequest: [authenticate.user, tenantAuthenticate.tenantUser],
      schema: {
        summary: '批量解析简历文件（通过文件ID）',
        body: {
          type: 'object',
          properties: {
            ids: {
              type: 'array',
              items: {
                type: 'string'
              }
            }
          },
          required: ['ids']
        }
      }
    },
    async request => {
      return services.resume.parseFileIds(Object.assign({}, request.body, { userInfo: request.userInfo }));
    }
  );

  // 简历列表
  fastify.get(
    `${options.prefix}/tenant/resume/list`,
    {
      onRequest: [authenticate.user, tenantAuthenticate.tenantUser],
      schema: {
        summary: '简历列表',
        query: {
          type: 'object',
          properties: {
            filter: {
              type: 'object',
              default: {}
            },
            perPage: {
              type: 'number',
              default: 20
            },
            currentPage: {
              type: 'number',
              default: 1
            }
          }
        }
      }
    },
    async request => {
      return services.resume.list(request.query);
    }
  );
});
