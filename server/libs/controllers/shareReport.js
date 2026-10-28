const fp = require('fastify-plugin');

module.exports = fp(async (fastify, options) => {
  const { services } = fastify[options.name];
  const { authenticate } = fastify.account;
  const { authenticate: tenantAuthenticate } = fastify.tenant;

  const sendBodyProperties = {
    ids: { type: 'array', items: { type: 'string' } },
    emails: { type: 'array', items: { type: 'string' } },
    deadline: { type: 'string' },
    language: { type: 'string' }
  };

  fastify.post(
    `${options.prefix}/tenant/share-report/position/send`,
    {
      onRequest: [authenticate.user, tenantAuthenticate.tenantUser],
      schema: {
        summary: '分享岗位洞察报告：生成免登录短链并发送到指定邮箱',
        body: {
          type: 'object',
          properties: sendBodyProperties,
          required: ['ids', 'emails']
        }
      }
    },
    async request => services.shareReport.sendPositions(request.tenantUserInfo, request.body)
  );

  fastify.post(
    `${options.prefix}/tenant/share-report/employee/send`,
    {
      onRequest: [authenticate.user, tenantAuthenticate.tenantUser],
      schema: {
        summary: '分享人才就绪度报告：发送给本人或指定邮箱',
        body: {
          type: 'object',
          properties: Object.assign({}, sendBodyProperties, {
            mode: { type: 'string', enum: ['self', 'specified'] }
          }),
          required: ['ids', 'mode']
        }
      }
    },
    async request => services.shareReport.sendEmployees(request.tenantUserInfo, request.body)
  );

  const codeQuery = (properties = {}) => ({
    type: 'object',
    properties: Object.assign({ code: { type: 'string' } }, properties),
    required: ['code']
  });

  fastify.get(`${options.prefix}/public/share-report`, { schema: { summary: '免登录-分享报告详情', query: codeQuery() } }, async request => services.shareReport.publicDetail(request.query));

  fastify.get(`${options.prefix}/public/share-report/tasks`, { schema: { summary: '免登录-分享报告岗位任务', query: codeQuery() } }, async request => services.shareReport.publicTasks(request.query));

  fastify.get(`${options.prefix}/public/share-report/talent-metrics`, { schema: { summary: '免登录-分享岗位的团队就绪度汇总', query: codeQuery() } }, async request => services.shareReport.publicTalentMetrics(request.query));

  fastify.get(`${options.prefix}/public/share-report/task-readiness`, { schema: { summary: '免登录-分享人才的任务就绪度', query: codeQuery() } }, async request => services.shareReport.publicTaskReadiness(request.query));

  fastify.get(`${options.prefix}/public/share-report/skill-analysis-detail`, { schema: { summary: '免登录-分享人才的技能分析', query: codeQuery() } }, async request => services.shareReport.publicSkillAnalysisDetail(request.query));

  fastify.get(`${options.prefix}/public/share-report/evidence`, { schema: { summary: '免登录-分享人才的任务证据', query: codeQuery({ taskId: { type: 'string' } }) } }, async request => services.shareReport.publicEvidence(request.query));
});
