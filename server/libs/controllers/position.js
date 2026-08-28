const fp = require('fastify-plugin');

const positionSkillItemSchema = {
  type: 'object',
  required: ['id', 'name', 'origin', 'importanceNow', 'importanceYear', 'change'],
  properties: {
    id: { type: 'string' },
    name: { type: 'string' },
    origin: { type: 'string', enum: ['existing', 'new'] },
    importanceNow: { type: 'number', minimum: 1, maximum: 5 },
    importanceYear: { type: 'number', minimum: 1, maximum: 5 },
    change: {
      type: 'string',
      enum: ['must_build', 'ai_emerging', 'new', 'enhanced', 'stable', 'declining']
    },
    aiExposure: { type: 'string', enum: ['high', 'medium', 'low'] },
    confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
    jd: {
      type: 'array',
      default: [],
      items: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          description: { type: 'string' },
          source: { type: 'string' }
        }
      }
    },
    shockReport: {
      type: 'array',
      default: [],
      items: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          description: { type: 'string' },
          source: { type: 'string' }
        }
      }
    },
    contentItems: {
      type: 'array',
      default: [],
      items: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          description: { type: 'string' },
          source: { type: 'string' }
        }
      }
    }
  }
};

const positionSkillSchema = {
  type: 'array',
  default: [],
  items: positionSkillItemSchema
};

/** 修改岗位：不能带 default，否则未传 skill/verdict 时 AJV 会注入 []/{} 把库里的分析数据盖掉 */
const positionSkillSchemaNoDefault = {
  type: 'array',
  items: positionSkillItemSchema
};

const positionVerdictSchema = {
  type: 'object',
  default: {},
  properties: {
    summary: { type: 'string' },
    today: { type: 'string' },
    future: { type: 'string' },
    futureLabel: { type: 'string' }
  }
};

const positionVerdictSchemaNoDefault = {
  type: 'object',
  properties: {
    summary: { type: 'string' },
    today: { type: 'string' },
    future: { type: 'string' },
    futureLabel: { type: 'string' }
  }
};

module.exports = fp(async (fastify, options) => {
  const { services } = fastify[options.name];
  const { authenticate: tenantAuthenticate } = fastify.tenant;
  const { authenticate } = fastify.account;

  fastify.get(
    `${options.prefix}/tenant/admin/position-list`,
    {
      onRequest: [authenticate.user, authenticate.admin],
      schema: {
        summary: '平台管理-租户岗位列表',
        query: {
          type: 'object',
          properties: {
            tenantId: {
              type: 'string'
            },
            filter: {
              type: 'object',
              default: {}
            },
            perPage: {
              type: 'number',
              default: 500
            },
            currentPage: {
              type: 'number',
              default: 1
            }
          },
          required: ['tenantId']
        }
      }
    },
    async request => {
      const { tenantId, filter, perPage, currentPage } = request.query;
      return services.position.list({ tenantId }, { filter, perPage, currentPage });
    }
  );

  fastify.post(
    `${options.prefix}/tenant/admin/position-create`,
    {
      onRequest: [authenticate.user, authenticate.admin],
      schema: {
        summary: '平台管理-租户创建岗位',
        body: {
          type: 'object',
          properties: {
            tenantId: {
              type: 'string'
            },
            name: {
              type: 'string'
            },
            language: {
              type: 'string',
              enum: ['zh-CN', 'en-US'],
              default: 'zh-CN'
            },
            locationType: {
              type: 'string',
              enum: ['on-site', 'remote'],
              default: 'on-site'
            },
            tenantOrgId: {
              type: ['string', 'null']
            }
          },
          required: ['tenantId', 'name', 'tenantOrgId']
        }
      }
    },
    async request => {
      const { tenantId, ...body } = request.body;
      return services.position.create({ tenantId }, body);
    }
  );

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
    `${options.prefix}/tenant/position/insight`,
    {
      onRequest: [authenticate.user, tenantAuthenticate.tenantUser],
      schema: {
        summary: '岗位列表洞察（高变动幅度等）'
      }
    },
    async request => {
      return services.position.insight(request.tenantUserInfo);
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
            developmentGoal: {
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
            },
            skill: positionSkillSchema,
            verdict: positionVerdictSchema,
            tenantOrgId: {
              type: ['string', 'null']
            },
            status: {
              type: 'string',
              enum: ['draft', 'published', 'closed'],
              default: 'draft'
            }
          },
          required: ['name', 'language', 'locationType', 'tenantOrgId']
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
            developmentGoal: {
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
            },
            skill: positionSkillSchemaNoDefault,
            verdict: positionVerdictSchemaNoDefault,
            tenantOrgId: {
              type: ['string', 'null']
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

  fastify.get(
    `${options.prefix}/tenant/position/skill-analysis-detail`,
    {
      onRequest: [authenticate.user, tenantAuthenticate.tenantUser],
      schema: {
        summary: '岗位内员工技能分析详情',
        query: {
          type: 'object',
          properties: {
            positionId: { type: 'string' },
            employeeId: { type: 'string' }
          },
          required: ['positionId', 'employeeId']
        }
      }
    },
    async request => {
      return services.position.skillAnalysisDetail(request.tenantUserInfo, request.query);
    }
  );

  fastify.post(
    `${options.prefix}/tenant/position/skill-analysis-save`,
    {
      onRequest: [authenticate.user, tenantAuthenticate.tenantUser],
      schema: {
        summary: '保存岗位内员工技能分析',
        body: {
          type: 'object',
          properties: {
            positionId: { type: 'string' },
            employeeId: { type: 'string' },
            readiness: { type: ['number', 'null'] },
            summary: { type: 'string', default: '' },
            metrics: {
              type: 'object',
              default: {},
              properties: {
                criticalGaps: { type: 'number' },
                atOrAbove: { type: 'number' },
                monthsToClose: { type: ['number', 'null'] }
              }
            },
            skills: {
              type: 'array',
              default: [],
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  name: { type: 'string' },
                  current: { type: 'number' },
                  required: { type: 'number' },
                  status: { type: 'string' },
                  evidence: { type: 'string' }
                }
              }
            },
            priorityGaps: {
              type: 'array',
              default: [],
              items: {
                type: 'object',
                properties: {
                  rank: { type: 'number' },
                  title: { type: 'string' },
                  description: { type: 'string' },
                  current: { type: 'number' },
                  required: { type: 'number' }
                }
              }
            },
            developmentPlan: {
              type: ['object', 'null'],
              default: null
            }
          },
          required: ['positionId', 'employeeId']
        }
      }
    },
    async request => {
      return services.position.skillAnalysisSave(request.tenantUserInfo, request.body);
    }
  );

  fastify.post(
    `${options.prefix}/tenant/position/start-analysis`,
    {
      onRequest: [authenticate.user, tenantAuthenticate.tenantUser],
      schema: {
        summary: '启动 AI 岗位分析（创建手动任务）',
        body: {
          type: 'object',
          properties: {
            id: { type: 'string' }
          },
          required: ['id']
        }
      }
    },
    async request => {
      return services.position.startAnalysis(request.tenantUserInfo, request.body);
    }
  );

  fastify.post(
    `${options.prefix}/tenant/position/lock-analysis`,
    {
      onRequest: [authenticate.user, tenantAuthenticate.tenantUser],
      schema: {
        summary: '岗位分析动画结束，锁定完成卡片',
        body: {
          type: 'object',
          properties: {
            id: { type: 'string' }
          },
          required: ['id']
        }
      }
    },
    async request => {
      return services.position.lockAnalysis(request.tenantUserInfo, request.body);
    }
  );

  fastify.get(
    `${options.prefix}/tenant/position/analysis-task-context`,
    {
      onRequest: [authenticate.user, authenticate.admin],
      schema: {
        summary: 'AI岗位分析任务上下文',
        query: {
          type: 'object',
          properties: {
            taskId: { type: 'string' }
          },
          required: ['taskId']
        }
      }
    },
    async request => {
      return services.position.getAnalysisTaskContext(request.userInfo, request.query);
    }
  );

  fastify.post(
    `${options.prefix}/tenant/position/complete-analysis`,
    {
      onRequest: [authenticate.user, authenticate.admin],
      schema: {
        summary: '完成 AI 岗位分析任务',
        body: {
          type: 'object',
          properties: {
            taskId: { type: 'string' },
            org: {
              type: 'object',
              default: {},
              properties: {
                tenantOrgId: { type: ['string', 'null'] }
              }
            },
            position: {
              type: 'object',
              default: {},
              properties: {
                description: { type: 'string' },
                requirement: { type: 'string' },
                developmentGoal: { type: 'string' },
                skill: positionSkillSchema,
                verdict: positionVerdictSchema
              }
            },
            employees: {
              type: 'array',
              default: [],
              items: {
                type: 'object',
                properties: {
                  employeeId: { type: 'string' },
                  readiness: { type: ['number', 'null'] },
                  summary: { type: 'string' },
                  metrics: { type: 'object' },
                  skills: { type: 'array' },
                  priorityGaps: { type: 'array' },
                  developmentPlan: { type: ['object', 'null'] }
                },
                required: ['employeeId']
              }
            }
          },
          required: ['taskId']
        }
      }
    },
    async request => {
      return services.position.completeAnalysis(request.userInfo, request.body);
    }
  );

  fastify.post(
    `${options.prefix}/tenant/position/analysis-ai-fill`,
    {
      onRequest: [authenticate.user, authenticate.admin],
      schema: {
        summary: 'AI 填充岗位分析完成表单（按步骤）',
        body: {
          type: 'object',
          properties: {
            taskId: { type: 'string' },
            step: { type: 'string', enum: ['org', 'position', 'person'] },
            language: { type: 'string', enum: ['zh-CN', 'en-US'] },
            draft: { type: 'object', default: {} }
          },
          required: ['taskId', 'step']
        }
      }
    },
    async request => {
      return services.position.aiFillAnalysis(request.userInfo, request.body);
    }
  );
});
