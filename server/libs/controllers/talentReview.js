const fp = require('fastify-plugin');

module.exports = fp(async (fastify, options) => {
  const { services } = fastify[options.name];
  const { authenticate } = fastify.account;
  const { authenticate: tenantAuthenticate } = fastify.tenant;
  const onRequest = [authenticate.user, tenantAuthenticate.tenantUser];
  const base = `${options.prefix}/tenant/talent-review`;
  const tenantIdOf = request => request.tenantUserInfo.tenantId;

  const idQuery = {
    type: 'object',
    properties: { id: { type: 'string' } },
    required: ['id']
  };

  fastify.get(`${base}/project/list`, { onRequest, schema: { summary: '人才盘点-项目列表（含进度）' } }, async request => {
    return services.talentReview.projectList({ tenantId: tenantIdOf(request) });
  });

  fastify.get(`${base}/project/detail`, { onRequest, schema: { summary: '人才盘点-项目详情', query: idQuery } }, async request => {
    return services.talentReview.projectDetail({ tenantId: tenantIdOf(request), id: request.query.id });
  });

  fastify.get(`${base}/interview-report`, { onRequest, schema: { summary: '人才盘点-个人报告（面试详情与远程组件地址），id 为 clientUserId', query: idQuery } }, async request => {
    return services.talentReview.interviewReport({ tenantId: tenantIdOf(request), id: request.query.id });
  });

  fastify.post(
    `${base}/project/create`,
    {
      onRequest,
      schema: {
        summary: '人才盘点-创建项目（建项目、关联题目并开启）',
        body: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            language: { type: 'string' },
            description: { type: 'string' },
            startTime: { type: 'string' },
            endTime: { type: 'string' },
            authentication: { type: 'string' },
            maxCount: { type: 'number' },
            questionModelId: { type: 'string' },
            setting: { type: 'object', additionalProperties: true },
            questions: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  questionDigitalId: { type: 'string' },
                  dimensionTypes: { type: 'array', items: { type: 'string' } }
                }
              }
            }
          },
          required: ['name', 'questionModelId']
        }
      }
    },
    async request => {
      return services.talentReview.projectCreate({ tenantId: tenantIdOf(request), data: request.body });
    }
  );

  fastify.post(
    `${base}/project/save`,
    {
      onRequest,
      schema: {
        summary: '人才盘点-编辑草稿项目（admin 创建的项目仅保存盘点信息与评估设置）',
        body: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            name: { type: 'string' },
            language: { type: 'string' },
            description: { type: 'string' },
            startTime: { type: 'string' },
            endTime: { type: 'string' },
            questionModelId: { type: 'string' },
            setting: { type: 'object', additionalProperties: true },
            questions: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  questionDigitalId: { type: 'string' },
                  dimensionTypes: { type: 'array', items: { type: 'string' } }
                }
              }
            }
          },
          required: ['id']
        }
      }
    },
    async request => {
      return services.talentReview.projectSave({ tenantId: tenantIdOf(request), data: request.body });
    }
  );

  fastify.post(
    `${base}/project/status`,
    {
      onRequest,
      schema: {
        summary: '人才盘点-开启/结束项目',
        body: {
          type: 'object',
          properties: { id: { type: 'string' }, status: { type: 'string', enum: ['open', 'closed'] } },
          required: ['id', 'status']
        }
      }
    },
    async request => {
      return services.talentReview.projectStatus(Object.assign({ tenantId: tenantIdOf(request) }, request.body));
    }
  );

  fastify.get(`${base}/project/org`, { onRequest, schema: { summary: '人才盘点-项目组织与参与人', query: idQuery } }, async request => {
    return services.talentReview.projectOrg({ tenantId: tenantIdOf(request), id: request.query.id });
  });

  fastify.get(
    `${base}/project/report`,
    {
      onRequest,
      schema: {
        summary: '人才盘点-项目盘点报告数据',
        query: { type: 'object', properties: { id: { type: 'string' }, locale: { type: 'string' } }, required: ['id'] }
      }
    },
    async request => {
      return services.talentReview.projectReport(Object.assign({ tenantId: tenantIdOf(request) }, request.query));
    }
  );

  fastify.get(
    `${base}/model/list`,
    {
      onRequest,
      schema: {
        summary: '人才盘点-AI 模型列表',
        query: {
          type: 'object',
          properties: {
            perPage: { type: 'number' },
            currentPage: { type: 'number' },
            filter: { type: 'object', additionalProperties: true }
          }
        }
      }
    },
    async request => {
      return services.talentReview.modelList(Object.assign({ tenantId: tenantIdOf(request) }, request.query));
    }
  );

  fastify.get(`${base}/model/detail`, { onRequest, schema: { summary: '人才盘点-AI 模型详情', query: idQuery } }, async request => {
    return services.talentReview.modelDetail({ tenantId: tenantIdOf(request), id: request.query.id });
  });

  fastify.get(
    `${base}/model/questions`,
    {
      onRequest,
      schema: {
        summary: '人才盘点-模型下可选题目',
        query: {
          type: 'object',
          properties: { questionModelId: { type: 'string' }, language: { type: 'string' }, digitalId: { type: 'string' } },
          required: ['questionModelId']
        }
      }
    },
    async request => {
      return services.talentReview.modelQuestions(Object.assign({ tenantId: tenantIdOf(request) }, request.query));
    }
  );

  fastify.get(`${base}/org-source`, { onRequest, schema: { summary: '人才盘点-本租户组织与员工（邀请选人）' } }, async request => {
    return services.talentReview.orgSource({ tenantId: tenantIdOf(request) });
  });

  fastify.post(
    `${base}/project/invite`,
    {
      onRequest,
      schema: {
        summary: '人才盘点-发送邀请（同步组织人员、邀请参与人与评估人）',
        body: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            employeeIds: { type: 'array', items: { type: 'string' } },
            evaluators: { type: 'object', additionalProperties: true },
            expires: { type: 'string' },
            needNotice: { type: 'boolean' }
          },
          required: ['id', 'employeeIds']
        }
      }
    },
    async request => {
      return services.talentReview.invite(Object.assign({ tenantId: tenantIdOf(request) }, request.body));
    }
  );

  fastify.post(
    `${base}/project/resend-member`,
    {
      onRequest,
      schema: {
        summary: '人才盘点-重新邀请参与人',
        body: {
          type: 'object',
          properties: { id: { type: 'string' }, memberId: { type: 'string' }, expires: { type: 'string' } },
          required: ['id', 'memberId']
        }
      }
    },
    async request => {
      return services.talentReview.resendMember(Object.assign({ tenantId: tenantIdOf(request) }, request.body));
    }
  );

  fastify.post(
    `${base}/project/resend-evaluator`,
    {
      onRequest,
      schema: {
        summary: '人才盘点-重新发送评估人邀请',
        body: {
          type: 'object',
          properties: { memberId: { type: 'string' }, role: { type: 'string' } },
          required: ['memberId', 'role']
        }
      }
    },
    async request => {
      return services.talentReview.resendEvaluator(Object.assign({ tenantId: tenantIdOf(request) }, request.body));
    }
  );
});
