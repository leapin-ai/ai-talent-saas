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
        summary: '确保 Assessment 项目邀请 shorten（过期则重新生成，默认24小时）'
      }
    },
    async request => {
      return services.assessment.ensureInvite(request.tenantUserInfo);
    }
  );
});
