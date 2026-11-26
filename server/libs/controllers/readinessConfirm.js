const fp = require('fastify-plugin');

/** 确认问卷免登录页：凭邮件里的短链 code 查看待确认题目并提交确认 */
module.exports = fp(async (fastify, options) => {
  const { services } = fastify[options.name];

  fastify.get(
    `${options.prefix}/public/readiness-confirm`,
    {
      schema: {
        tags: ['readiness'],
        summary: '免登录-确认问卷详情',
        query: { type: 'object', properties: { code: { type: 'string' } }, required: ['code'] }
      }
    },
    async request => services.readinessConfirm.publicDetail(request.query)
  );

  fastify.post(
    `${options.prefix}/public/readiness-confirm`,
    {
      schema: {
        tags: ['readiness'],
        summary: '免登录-确认本批中的一份问卷并填写截止日期',
        body: {
          type: 'object',
          properties: {
            code: { type: 'string' },
            deadline: { type: 'string' },
            key: { type: 'string' },
            runId: { type: 'string' },
            kind: { type: 'string' },
            personId: { type: 'string' }
          },
          required: ['code', 'deadline']
        }
      }
    },
    async request => services.readinessConfirm.publicConfirm(request.body)
  );

  fastify.post(
    `${options.prefix}/public/readiness-confirm/reject`,
    {
      schema: {
        tags: ['readiness'],
        summary: '免登录-驳回确认问卷（必须填写修改意见）',
        body: {
          type: 'object',
          properties: {
            code: { type: 'string' },
            comment: { type: 'string' },
            key: { type: 'string' },
            runId: { type: 'string' },
            kind: { type: 'string' },
            personId: { type: 'string' }
          },
          required: ['code', 'comment']
        }
      }
    },
    async request => services.readinessConfirm.publicReject(request.body)
  );
});
