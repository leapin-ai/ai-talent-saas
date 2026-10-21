const fp = require('fastify-plugin');

module.exports = fp(async (fastify, options) => {
  const { services } = fastify[options.name];
  const { authenticate } = fastify.account;
  const { authenticate: tenantAuthenticate } = fastify.tenant;

  const toContext = request => ({ userInfo: request.userInfo, tenantId: request.tenantUserInfo?.tenantId });

  fastify.get(
    `${options.prefix}/tenant/employee-questionnaire/project/list`,
    {
      onRequest: [authenticate.user, tenantAuthenticate.tenantUser],
      schema: {
        summary: '可发起的问卷项目列表（应用中心问卷应用，当前登录用户的进行中项目）',
        query: {
          type: 'object',
          properties: {
            keyword: { type: 'string' },
            perPage: { type: 'number', default: 20 },
            currentPage: { type: 'number', default: 1 }
          }
        }
      }
    },
    async request => {
      return services.employeeQuestionnaire.listProjects(toContext(request), request.query);
    }
  );

  fastify.post(
    `${options.prefix}/tenant/employee-questionnaire/send`,
    {
      onRequest: [authenticate.user, tenantAuthenticate.tenantUser],
      schema: {
        summary: '邀请员工补充问卷（邮件/短信发送填写链接）',
        body: {
          type: 'object',
          properties: {
            employeeId: { type: 'string' },
            positionId: { type: 'string' },
            project: {},
            deadline: { type: 'string' },
            language: { type: 'string' }
          },
          required: ['employeeId', 'project']
        }
      }
    },
    async request => {
      return services.employeeQuestionnaire.send(toContext(request), request.body);
    }
  );

  fastify.get(
    `${options.prefix}/tenant/employee-questionnaire/list`,
    {
      onRequest: [authenticate.user, tenantAuthenticate.tenantUser],
      schema: {
        summary: '员工补充问卷记录（含已提交答卷）',
        query: {
          type: 'object',
          properties: {
            employeeId: { type: 'string' }
          },
          required: ['employeeId']
        }
      }
    },
    async request => {
      return services.employeeQuestionnaire.listByEmployee(toContext(request), request.query);
    }
  );

  fastify.post(
    `${options.prefix}/public/employee-questionnaire/webhook`,
    {
      schema: {
        summary: '问卷应用提交回调（code 为发起时签发的短链校验码）',
        query: {
          type: 'object',
          properties: {
            code: { type: 'string' }
          },
          required: ['code']
        },
        body: { type: 'object' }
      }
    },
    async request => {
      return services.employeeQuestionnaire.handleWebhook(request.query, request.body);
    }
  );
});
