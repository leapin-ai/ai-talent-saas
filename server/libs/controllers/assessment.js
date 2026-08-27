const fp = require('fastify-plugin');

module.exports = fp(async (fastify, options) => {
  const { services } = fastify[options.name];
  const { authenticate } = fastify.account;
  const { authenticate: tenantAuthenticate } = fastify.tenant;

  fastify.post(
    `${options.prefix}/tenant/assessment/save-profile`,
    {
      onRequest: [authenticate.user, tenantAuthenticate.tenantUser],
      schema: {
        summary: '保存完善档案提交的评估记录',
        body: {
          type: 'object',
          properties: {
            profileData: { type: 'object' }
          },
          required: ['profileData']
        }
      }
    },
    async request => {
      return services.assessment.saveProfile(request.tenantUserInfo, request.body);
    }
  );

  fastify.get(
    `${options.prefix}/tenant/assessment/detail`,
    {
      onRequest: [authenticate.user, tenantAuthenticate.tenantUser],
      schema: {
        summary: '当前用户 AI 面试评估记录'
      }
    },
    async request => {
      return services.assessment.detail(request.tenantUserInfo);
    }
  );

  fastify.post(
    `${options.prefix}/tenant/assessment/ensure-invite`,
    {
      onRequest: [authenticate.user, tenantAuthenticate.tenantUser],
      schema: {
        summary: '确保 Assessment 项目邀请 shorten（过期则重新生成，默认24小时）',
        body: {
          type: 'object',
          properties: {
            forceNew: { type: 'boolean' }
          }
        }
      }
    },
    async request => {
      return services.assessment.ensureInvite(request.tenantUserInfo, request.body || {});
    }
  );

  fastify.post(
    `${options.prefix}/tenant/assessment/accept-previous`,
    {
      onRequest: [authenticate.user, tenantAuthenticate.tenantUser],
      schema: {
        summary: '沿用上次 AI 面试记录',
        body: {
          type: 'object',
          properties: {
            forceCompleted: { type: 'boolean' }
          }
        }
      }
    },
    async request => {
      return services.assessment.acceptPrevious(request.tenantUserInfo, request.body || {});
    }
  );

  fastify.post(
    `${options.prefix}/tenant/assessment/restart`,
    {
      onRequest: [authenticate.user, tenantAuthenticate.tenantUser],
      schema: {
        summary: '重新生成：重置评估面试状态，保留 profileData'
      }
    },
    async request => {
      return services.assessment.restart(request.tenantUserInfo);
    }
  );

  fastify.get(
    `${options.prefix}/tenant/assessment/list`,
    {
      onRequest: [authenticate.user, tenantAuthenticate.tenantUser],
      schema: {
        summary: '完善档案申请列表（首页完善档案提交记录）',
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
      return services.assessment.list(request.tenantUserInfo, request.query);
    }
  );

  fastify.get(
    `${options.prefix}/tenant/assessment/get-detail`,
    {
      onRequest: [authenticate.user, tenantAuthenticate.tenantUser],
      schema: {
        summary: '完善档案申请详情',
        query: {
          type: 'object',
          properties: {
            id: { type: 'string' }
          },
          required: ['id']
        }
      }
    },
    async request => {
      return services.assessment.getDetail(request.tenantUserInfo, request.query);
    }
  );

  fastify.post(
    `${options.prefix}/tenant/assessment/mark-submitted`,
    {
      onRequest: [authenticate.user, tenantAuthenticate.tenantUser],
      schema: {
        summary: '生成完成后提交完善档案申请（generating → submitted）'
      }
    },
    async request => {
      return services.assessment.markSubmitted(request.tenantUserInfo);
    }
  );

  fastify.post(
    `${options.prefix}/tenant/assessment/approve`,
    {
      onRequest: [authenticate.user, tenantAuthenticate.tenantUser],
      schema: {
        summary: '通过完善档案申请，合并到员工档案',
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
      return services.assessment.approve(request.tenantUserInfo, request.body);
    }
  );

  fastify.post(
    `${options.prefix}/tenant/assessment/reject`,
    {
      onRequest: [authenticate.user, tenantAuthenticate.tenantUser],
      schema: {
        summary: '拒绝完善档案申请（closed）',
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
      return services.assessment.reject(request.tenantUserInfo, request.body);
    }
  );

  fastify.get(
    `${options.prefix}/tenant/assessment/generate-task-context`,
    {
      onRequest: [authenticate.user, authenticate.admin],
      schema: {
        summary: '完善档案生成任务上下文（面试报告/提交信息/档案草稿）',
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
      return services.assessment.getGenerateTaskContext(request.userInfo, request.query);
    }
  );

  fastify.post(
    `${options.prefix}/tenant/assessment/complete-generate`,
    {
      onRequest: [authenticate.user, authenticate.admin],
      schema: {
        summary: '完成完善档案生成任务：写入 reviewData 并提交审核',
        body: {
          type: 'object',
          properties: {
            taskId: { type: 'string' },
            reviewData: { type: 'object' }
          },
          required: ['taskId', 'reviewData']
        }
      }
    },
    async request => {
      return services.assessment.completeGenerate(request.userInfo, request.body);
    }
  );

  fastify.post(
    `${options.prefix}/tenant/assessment/generate-ai-fill`,
    {
      onRequest: [authenticate.user, authenticate.admin],
      schema: {
        summary: '完善档案生成任务 AI 填充档案草稿',
        body: {
          type: 'object',
          properties: {
            taskId: { type: 'string' },
            language: { type: 'string' },
            draft: { type: 'object' },
            resumeParsed: { type: 'object' },
            submittedInfo: { type: 'object' }
          },
          required: ['taskId']
        }
      }
    },
    async request => {
      return services.assessment.aiFillGenerate(request.userInfo, request.body);
    }
  );
});
