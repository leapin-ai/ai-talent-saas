const fp = require('fastify-plugin');

module.exports = fp(async (fastify, options) => {
  const { services } = fastify[options.name];
  const { authenticate: tenantAuthenticate } = fastify.tenant;
  const { authenticate } = fastify.account;

  fastify.get(
    `${options.prefix}/tenant/employee/list`,
    {
      onRequest: [authenticate.user, tenantAuthenticate.tenantUser],
      schema: {
        summary: '员工列表',
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
      return services.employee.list(request.tenantUserInfo, request.query);
    }
  );

  fastify.get(
    `${options.prefix}/tenant/employee/detail`,
    {
      onRequest: [authenticate.user, tenantAuthenticate.tenantUser],
      schema: {
        summary: '员工详情',
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
      return services.employee.detail(request.tenantUserInfo, request.query);
    }
  );

  fastify.post(
    `${options.prefix}/tenant/employee/create`,
    {
      onRequest: [authenticate.user, tenantAuthenticate.tenantUser],
      schema: {
        summary: '添加员工',
        body: {
          type: 'object',
          properties: {
            name: {
              type: 'string'
            },
            nameEn: {
              type: 'string',
              default: ''
            },
            gender: {
              type: 'string',
              enum: ['M', 'F', 'N']
            },
            marital: {
              type: 'string',
              enum: ['Y', 'N']
            },
            description: {
              type: 'string',
              default: ''
            },
            birthday: {
              type: 'string',
              format: 'date-time'
            },
            email: {
              type: 'string',
              default: ''
            },
            personalEmail: {
              type: 'string',
              default: ''
            },
            phone: {
              type: 'string',
              default: ''
            },
            emergencyContact: {
              type: 'string',
              default: ''
            },
            emergencyPhone: {
              type: 'string',
              default: ''
            },
            city: {
              type: 'string',
              default: ''
            },
            address: {
              type: 'string',
              default: ''
            },
            major: {
              type: 'string',
              default: ''
            },
            collegeType: {
              type: 'string'
            },
            college: {
              type: 'string',
              default: ''
            },
            degree: {
              type: 'integer'
            },
            recruit: {
              type: 'string',
              default: ''
            },
            status: {
              type: 'string',
              enum: ['ACTIVE', 'RESIGN', 'STOP_SALARY', 'RETIRE', 'INTERN', 'PRE_EMPLOYEE'],
              default: 'ACTIVE'
            },
            hireDate: {
              type: 'string',
              format: 'date'
            },
            idType: {
              type: 'string',
              enum: ['ID_CARD', 'PASSPORT', 'OTHER']
            },
            idNumber: {
              type: 'string',
              default: ''
            },
            nationality: {
              type: 'string',
              default: ''
            },
            ethnicity: {
              type: 'string',
              default: ''
            },
            politicalStatus: {
              type: 'string',
              default: ''
            },
            resumes: {
              type: 'array',
              default: []
            },
            options: {
              type: 'object',
              default: {}
            }
          },
          required: ['name']
        }
      }
    },
    async request => {
      return services.employee.create(request.tenantUserInfo, request.body);
    }
  );

  fastify.post(
    `${options.prefix}/tenant/employee/save`,
    {
      onRequest: [authenticate.user, tenantAuthenticate.tenantUser],
      schema: {
        summary: '修改员工信息',
        body: {
          type: 'object',
          properties: {
            id: {
              type: 'string'
            },
            name: {
              type: 'string'
            },
            nameEn: {
              type: 'string'
            },
            gender: {
              type: 'string',
              enum: ['M', 'F', 'N']
            },
            marital: {
              type: 'string',
              enum: ['Y', 'N']
            },
            description: {
              type: 'string'
            },
            birthday: {
              type: 'string',
              format: 'date-time'
            },
            email: {
              type: 'string'
            },
            personalEmail: {
              type: 'string'
            },
            phone: {
              type: 'string'
            },
            emergencyContact: {
              type: 'string'
            },
            emergencyPhone: {
              type: 'string'
            },
            city: {
              type: 'string'
            },
            address: {
              type: 'string'
            },
            major: {
              type: 'string'
            },
            collegeType: {
              type: 'string'
            },
            college: {
              type: 'string'
            },
            degree: {
              type: 'integer'
            },
            recruit: {
              type: 'string'
            },
            idType: {
              type: 'string',
              enum: ['ID_CARD', 'PASSPORT', 'OTHER']
            },
            idNumber: {
              type: 'string'
            },
            nationality: {
              type: 'string'
            },
            ethnicity: {
              type: 'string'
            },
            politicalStatus: {
              type: 'string'
            },
            resumes: {
              type: 'array'
            },
            options: {
              type: 'object'
            }
          },
          required: ['id']
        }
      }
    },
    async request => {
      await services.employee.save(request.tenantUserInfo, request.body);
      return {};
    }
  );

  fastify.post(
    `${options.prefix}/tenant/employee/set-status`,
    {
      onRequest: [authenticate.user, tenantAuthenticate.tenantUser],
      schema: {
        summary: '修改员工状态',
        body: {
          type: 'object',
          properties: {
            id: {
              type: 'string'
            },
            status: {
              type: 'string',
              enum: ['ACTIVE', 'RESIGN', 'STOP_SALARY', 'RETIRE', 'INTERN', 'PRE_EMPLOYEE']
            }
          },
          required: ['id', 'status']
        }
      }
    },
    async request => {
      await services.employee.setStatus(request.tenantUserInfo, request.body);
      return {};
    }
  );

  fastify.post(
    `${options.prefix}/tenant/employee/remove`,
    {
      onRequest: [authenticate.user, tenantAuthenticate.tenantUser],
      schema: {
        summary: '删除员工',
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
      await services.employee.remove(request.tenantUserInfo, request.body);
      return {};
    }
  );
});
