const fp = require('fastify-plugin');

module.exports = fp(async (fastify, options) => {
  const { services } = fastify[options.name];
  const { authenticate: tenantAuthenticate } = fastify.tenant;
  const { authenticate } = fastify.account;

  fastify.get(
    `${options.prefix}/tenant/position/list`,
    {
      onRequest: [authenticate.user, tenantAuthenticate.tenantUser],
      schema: {
        summary: '职位列表',
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
      return services.position.list(request.tenantUserInfo, request.query);
    }
  );

  fastify.get(
    `${options.prefix}/tenant/position/detail`,
    {
      onRequest: [authenticate.user, tenantAuthenticate.tenantUser],
      schema: {
        summary: '职位详情',
        query: {
          type: 'object',
          properties: {
            id: {
              type: 'string'
            }
          },
          required: ['id']
        }
      }
    },
    async request => {
      return services.position.detail(request.tenantUserInfo, request.query);
    }
  );

  fastify.post(
    `${options.prefix}/tenant/position/create`,
    {
      onRequest: [authenticate.user, tenantAuthenticate.tenantUser],
      schema: {
        summary: '添加职位',
        body: {
          type: 'object',
          properties: {
            name: {
              type: 'string'
            },
            description: {
              type: 'string',
              default: ''
            },
            requirement: {
              type: 'string',
              default: ''
            },
            language: {
              type: 'string',
              enum: ['zh-CN', 'en-US']
            },
            locationType: {
              type: 'string',
              enum: ['on-site', 'remote']
            },
            location: {
              type: 'array',
              default: []
            },
            capacity: {
              type: 'string'
            },
            salary: {
              type: 'object',
              default: {}
            },
            status: {
              type: 'string',
              enum: ['draft', 'published', 'closed'],
              default: 'draft'
            }
          },
          required: ['name', 'language', 'locationType']
        }
      }
    },
    async request => {
      return services.position.create(request.tenantUserInfo, request.body);
    }
  );

  fastify.post(
    `${options.prefix}/tenant/position/save`,
    {
      onRequest: [authenticate.user, tenantAuthenticate.tenantUser],
      schema: {
        summary: '修改职位信息',
        body: {
          type: 'object',
          properties: {
            id: {
              type: 'string'
            },
            name: {
              type: 'string'
            },
            description: {
              type: 'string',
              default: ''
            },
            requirement: {
              type: 'string',
              default: ''
            },
            language: {
              type: 'string',
              enum: ['zh-CN', 'en-US']
            },
            locationType: {
              type: 'string',
              enum: ['on-site', 'remote']
            },
            location: {
              type: 'array',
              default: []
            },
            capacity: {
              type: 'string',
              default: ''
            },
            salary: {
              type: 'object',
              default: {}
            }
          },
          required: ['id']
        }
      }
    },
    async request => {
      await services.position.save(request.tenantUserInfo, request.body);
      return {};
    }
  );

  fastify.post(
    `${options.prefix}/tenant/position/set-status`,
    {
      onRequest: [authenticate.user, tenantAuthenticate.tenantUser],
      schema: {
        summary: '修改职位状态',
        body: {
          type: 'object',
          properties: {
            id: {
              type: 'string'
            },
            status: {
              type: 'string',
              enum: ['draft', 'published', 'closed']
            }
          },
          required: ['id', 'status']
        }
      }
    },
    async request => {
      await services.position.setStatus(request.tenantUserInfo, request.body);
      return {};
    }
  );

  fastify.post(
    `${options.prefix}/tenant/position/remove`,
    {
      onRequest: [authenticate.user, tenantAuthenticate.tenantUser],
      schema: {
        summary: '删除职位',
        body: {
          type: 'object',
          properties: {
            id: {
              type: 'string'
            }
          },
          required: ['id']
        }
      }
    },
    async request => {
      await services.position.remove(request.tenantUserInfo, request.body);
      return {};
    }
  );
});
