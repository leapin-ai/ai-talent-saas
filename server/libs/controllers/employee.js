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

  fastify.post(
    `${options.prefix}/tenant/employee/search`,
    {
      onRequest: [authenticate.user, tenantAuthenticate.tenantUser],
      schema: {
        summary: '员工搜索（支持关键词、语义、向量等多种检索方式）',
        body: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: '查询文本（必填）'
            },
            highlightFields: {
              type: 'array',
              items: {
                type: 'string'
              },
              description: '高亮字段'
            },
            matchType: {
              type: 'string',
              description: '匹配类型'
            },
            perPage: {
              type: 'number',
              default: 20
            },
            currentPage: {
              type: 'number',
              default: 1
            }
          },
          required: ['query']
        }
      }
    },
    async request => {
      return services.employee.search(request.tenantUserInfo, request.body);
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

  fastify.post(
    `${options.prefix}/tenant/employee/save-profile`,
    {
      onRequest: [authenticate.user, tenantAuthenticate.tenantUser],
      schema: {
        summary: '保存员工档案',
        body: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              description: '员工ID'
            },
            advantage: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  description: { type: 'string' }
                }
              },
              description: '优势列表'
            },
            promotionHistory: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  time: { type: 'string' },
                  occupation: { type: 'string' }
                }
              },
              description: '晋升历史'
            },
            skills: {
              type: 'object',
              description: '技能'
            },
            intentionPosition: {
              type: 'array',
              items: { type: 'string' },
              description: '意向岗位'
            },
            workPreference: {
              type: 'object',
              properties: {
                work_mode_preference: { type: 'string' },
                relocation_willingness: { type: 'string' },
                business_travel_willingness: { type: 'string' }
              },
              description: '工作偏好'
            },
            options: {
              type: 'object',
              properties: {
                certificates_licenses: {
                  type: 'array',
                  items: { type: 'string' }
                },
                hobbies: {
                  type: 'array',
                  items: { type: 'string' }
                }
              },
              description: '其他选项'
            }
          },
          required: ['id']
        }
      }
    },
    async request => {
      return services.employee.saveProfile(request.tenantUserInfo, request.body);
    }
  );

  // Performance APIs
  fastify.get(
    `${options.prefix}/tenant/performance/list`,
    {
      onRequest: [authenticate.user, tenantAuthenticate.tenantUser],
      schema: {
        summary: '绩效评价列表',
        query: {
          type: 'object',
          properties: {
            employeeId: {
              type: 'string'
            },
            perPage: {
              type: 'number',
              default: 20
            },
            currentPage: {
              type: 'number',
              default: 1
            }
          },
          required: ['employeeId']
        }
      }
    },
    async request => {
      return services.performance.list(request.tenantUserInfo, request.query);
    }
  );

  fastify.post(
    `${options.prefix}/tenant/performance/create`,
    {
      onRequest: [authenticate.user, tenantAuthenticate.tenantUser],
      schema: {
        summary: '添加绩效评价',
        body: {
          type: 'object',
          properties: {
            employeeId: {
              type: 'string'
            },
            date: {
              type: 'string',
              format: 'date-time'
            },
            score: {
              type: 'number'
            },
            evaluatorName: {
              type: 'string'
            },
            comment: {
              type: 'string',
              default: ''
            }
          },
          required: ['employeeId', 'date', 'score', 'evaluatorName']
        }
      }
    },
    async request => {
      return services.performance.create(request.tenantUserInfo, request.body);
    }
  );

  fastify.post(
    `${options.prefix}/tenant/performance/save`,
    {
      onRequest: [authenticate.user, tenantAuthenticate.tenantUser],
      schema: {
        summary: '修改绩效评价',
        body: {
          type: 'object',
          properties: {
            id: {
              type: 'string'
            },
            date: {
              type: 'string',
              format: 'date-time'
            },
            score: {
              type: 'number'
            },
            evaluatorName: {
              type: 'string'
            },
            comment: {
              type: 'string'
            }
          },
          required: ['id']
        }
      }
    },
    async request => {
      return services.performance.save(request.tenantUserInfo, request.body);
    }
  );

  fastify.post(
    `${options.prefix}/tenant/performance/remove`,
    {
      onRequest: [authenticate.user, tenantAuthenticate.tenantUser],
      schema: {
        summary: '删除绩效评价',
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
      await services.performance.remove(request.tenantUserInfo, request.body);
      return {};
    }
  );
});
