const fp = require('fastify-plugin');

module.exports = fp(async (fastify, options) => {
  const { services } = fastify[options.name];
  const { authenticate } = fastify.account;
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
        summary: '完善档案生成任务：一键 AI 填充档案草稿与就绪度/成长/匹配',
        body: {
          type: 'object',
          properties: {
            taskId: { type: 'string' },
            language: { type: 'string' },
            draft: { type: 'object' },
            resumeParsed: { type: 'object' },
            submittedInfo: { type: 'object' },
            persist: { type: 'boolean' }
          },
          required: ['taskId']
        }
      }
    },
    async request => {
      return services.assessment.aiFillAndInsightGenerate(request.userInfo, request.body);
    }
  );

  fastify.post(
    `${options.prefix}/tenant/assessment/generate-talent-insight`,
    {
      onRequest: [authenticate.user, authenticate.admin],
      schema: {
        summary: '完善档案生成任务：根据面试/简历/填写信息生成就绪度与成长匹配（兼容旧调用；新流程请用 generate-ai-fill）',
        body: {
          type: 'object',
          properties: {
            taskId: { type: 'string' },
            language: { type: 'string' },
            draft: { type: 'object' },
            resumeParsed: { type: 'object' },
            submittedInfo: { type: 'object' },
            persist: { type: 'boolean' }
          },
          required: ['taskId']
        }
      }
    },
    async request => {
      return services.assessment.generateTalentInsight(request.userInfo, request.body);
    }
  );
});
