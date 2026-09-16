const fp = require('fastify-plugin');

module.exports = fp(async (fastify, options) => {
  const { services } = fastify[options.name];
  const { authenticate } = fastify.account;
  const { authenticate: tenantAuthenticate } = fastify.tenant;

  fastify.post(
    `${options.prefix}/tenant/position/talent-collect-invite/send`,
    {
      onRequest: [authenticate.user, tenantAuthenticate.tenantUser],
      schema: {
        summary: '发送人才评估收集邀请（员工/经理）',
        body: {
          type: 'object',
          properties: {
            positionId: { type: 'string' },
            inviteType: { type: 'string', enum: ['employee', 'manager'] },
            assessmentProject: {},
            deadline: { type: 'string' },
            participants: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  email: { type: 'string' },
                  phone: {}
                }
              }
            }
          },
          required: ['positionId', 'inviteType', 'assessmentProject', 'participants']
        }
      }
    },
    async request => {
      return services.talentCollectInvite.send(request.tenantUserInfo, request.body);
    }
  );

  fastify.post(
    `${options.prefix}/tenant/position/talent-collect-invite/resend`,
    {
      onRequest: [authenticate.user, tenantAuthenticate.tenantUser],
      schema: {
        summary: '重新发送未完成的人才评估收集邀请',
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
      return services.talentCollectInvite.resend(request.tenantUserInfo, request.body);
    }
  );

  fastify.get(
    `${options.prefix}/tenant/position/talent-collect-invite/link`,
    {
      onRequest: [authenticate.user, tenantAuthenticate.tenantUser],
      schema: {
        summary: '获取人才评估收集邀请链接',
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
      return services.talentCollectInvite.getLink(request.tenantUserInfo, request.query);
    }
  );

  fastify.get(
    `${options.prefix}/tenant/position/talent-collect-invite/list`,
    {
      onRequest: [authenticate.user, tenantAuthenticate.tenantUser],
      schema: {
        summary: '岗位人才评估邀请记录列表',
        query: {
          type: 'object',
          properties: {
            positionId: { type: 'string' },
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
          },
          required: ['positionId']
        }
      }
    },
    async request => {
      return services.talentCollectInvite.list(request.tenantUserInfo, request.query);
    }
  );

  fastify.get(
    `${options.prefix}/tenant/position/talent-collect-invite/interview-result`,
    {
      onRequest: [authenticate.user, tenantAuthenticate.tenantUser],
      schema: {
        summary: '通过 open-api 获取已完成邀请的面试结果',
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
      return services.talentCollectInvite.getInterviewResult(request.tenantUserInfo, request.query);
    }
  );

  fastify.get(
    `${options.prefix}/public/talent-collect-invite`,
    {
      schema: {
        summary: '免登录-根据短链码获取收集邀请详情',
        query: {
          type: 'object',
          properties: {
            code: { type: 'string' }
          },
          required: ['code']
        }
      }
    },
    async request => {
      return services.talentCollectInvite.detailByCode(request.query);
    }
  );

  fastify.post(
    `${options.prefix}/public/talent-collect-invite/save-profile`,
    {
      schema: {
        summary: '免登录-保存完善档案数据（不改邀请姓名邮箱手机）',
        body: {
          type: 'object',
          properties: {
            code: { type: 'string' },
            profileData: { type: 'object' }
          },
          required: ['code', 'profileData']
        }
      }
    },
    async request => {
      return services.talentCollectInvite.saveProfile(request.body);
    }
  );

  fastify.post(
    `${options.prefix}/public/talent-collect-invite/parse-resume`,
    {
      schema: {
        summary: '免登录-解析简历文件',
        body: {
          type: 'object',
          properties: {
            code: { type: 'string' },
            id: { type: 'string' },
            force: { type: 'boolean' }
          },
          required: ['code', 'id']
        }
      }
    },
    async request => {
      return services.talentCollectInvite.parseResume(request.body || {});
    }
  );

  fastify.post(
    `${options.prefix}/public/talent-collect-invite/ensure-invite`,
    {
      schema: {
        summary: '免登录-确保 AI 面试邀请 shorten（不发面试提醒）',
        body: {
          type: 'object',
          properties: {
            code: { type: 'string' },
            forceNew: { type: 'boolean' }
          },
          required: ['code']
        }
      }
    },
    async request => {
      return services.talentCollectInvite.ensureInvite(request.body || {});
    }
  );

  fastify.post(
    `${options.prefix}/public/talent-collect-invite/mark-done`,
    {
      schema: {
        summary: '免登录-标记面试完成并回写 interviewId',
        body: {
          type: 'object',
          properties: {
            code: { type: 'string' },
            interviewId: { type: 'string' }
          },
          required: ['code']
        }
      }
    },
    async request => {
      return services.talentCollectInvite.markInterviewDone(request.body || {});
    }
  );
});
