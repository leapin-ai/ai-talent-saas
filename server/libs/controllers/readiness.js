const fp = require('fastify-plugin');

/**
 * 就绪度流程路由：平台 Admin → 租户管理 → 某租户 →「就绪度流程」tab（与「就绪纠错反馈」并列）。
 * 仅超级管理员可用，tenantId 由请求体传入。
 */
module.exports = fp(async (fastify, options) => {
  const { services } = fastify[options.name];
  const { authenticate } = fastify.account;

  const kindSchema = { type: 'string', enum: ['manager', 'staff', 'reassess'] };
  const scopeSchema = { type: 'string', enum: ['role', 'person'] };
  const stringArray = { type: 'array', items: { type: 'string' } };

  const base = `${options.prefix}/tenant/admin/readiness`;
  const onRequest = [authenticate.user, authenticate.admin];
  const auth = request => ({ tenantId: String(request.body?.tenantId || ''), userId: null });

  const post = (path, summary, body, handler) =>
    fastify.post(
      `${base}/${path}`,
      {
        onRequest,
        schema: {
          tags: ['readiness'],
          summary: `Readiness 流程：${summary}`,
          body: Object.assign({}, body, { properties: Object.assign({ tenantId: { type: 'string' } }, body.properties), required: [...(body.required || []), 'tenantId'] })
        }
      },
      async request => handler(auth(request), request.body || {})
    );

  post('list', '列表', { type: 'object', properties: { currentPage: { type: 'number' }, perPage: { type: 'number' }, filter: { type: 'object' } } }, (info, body) => services.readiness.list(info, body));

  post('detail', '详情（含各阶段版本、参与人、邀请）', { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] }, (info, body) => services.readiness.detail(info, body));

  post('stage/detail', '某一阶段版本的输入输出与任务日志', { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] }, (info, body) => services.readiness.stageDataDetail(info, body));

  post(
    'create',
    '新建流程',
    {
      type: 'object',
      properties: {
        positionId: { type: 'string' },
        roleName: { type: 'string' },
        jd: { type: 'string' },
        language: { type: 'string', enum: ['zh-CN', 'en-US'] },
        hasStaffQuestionnaire: { type: 'boolean' },
        employeeIds: stringArray,
        managers: {
          type: 'array',
          items: { type: 'object', properties: { name: { type: 'string' }, tenantUserId: { type: 'string' }, email: { type: 'string' } } }
        },
        employees: {
          type: 'array',
          items: { type: 'object', properties: { name: { type: 'string' }, tenantUserId: { type: 'string' }, email: { type: 'string' }, employeeId: { type: 'string' } } }
        }
      }
    },
    (info, body) => services.readiness.createRun(info, body)
  );

  post('cancel', '取消流程（非已完成）', { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] }, (info, body) => services.readiness.cancel(info, body));

  post(
    'manual/confirm',
    '管理员直接确认问卷（须填写问卷截止日期，确认后自动发布到 AI 面试）',
    { type: 'object', properties: { runId: { type: 'string' }, kind: kindSchema, personId: { type: 'string' }, deadline: { type: 'string' }, digitalId: { type: 'string' } }, required: ['runId', 'kind', 'deadline', 'digitalId'] },
    (info, body) => services.readiness.confirm(info, body)
  );

  post(
    'manual/questionnaire-edit',
    '确认阶段拉取问卷 FormCreator Schema（含驳回意见）',
    { type: 'object', properties: { runId: { type: 'string' }, kind: kindSchema, personId: { type: 'string' } }, required: ['runId', 'kind'] },
    (info, body) => services.readiness.questionnaireEditPayload(info, body)
  );

  post(
    'manual/questionnaire-update',
    '确认阶段用 FormCreator Schema 更新问卷题目',
    {
      type: 'object',
      properties: { runId: { type: 'string' }, kind: kindSchema, personId: { type: 'string' }, schema: { type: 'object' }, questionnaire: { type: 'array' } },
      required: ['runId', 'kind']
    },
    (info, body) => services.readiness.updateQuestionnaire(info, body)
  );

  post('manual/project-preview', '预览已发布的 AI 面试项目', { type: 'object', properties: { runId: { type: 'string' }, kind: kindSchema, personId: { type: 'string' } }, required: ['runId', 'kind'] }, (info, body) =>
    services.readinessSend.projectPreview(info, body)
  );

  post('manual/digitals', '确认问卷时可选的数字人（AI 面试客户已分配）', { type: 'object', properties: { runId: { type: 'string' } } }, (info, body) => services.readiness.listDigitals(info, body));

  post(
    'manual/confirm-mail/send',
    '给有关人发送确认问卷邮件（可多份问卷共用一封邮件与一个入口链接；页内逐份确认）',
    {
      type: 'object',
      properties: {
        runId: { type: 'string' },
        kind: kindSchema,
        personId: { type: 'string' },
        targets: {
          type: 'array',
          items: {
            type: 'object',
            properties: { runId: { type: 'string' }, kind: kindSchema, personId: { type: 'string' } },
            required: ['runId', 'kind']
          }
        },
        recipients: { type: 'array', items: { type: 'object', properties: { name: { type: 'string' }, email: { type: 'string' }, employeeId: { type: 'string' } } } },
        language: { type: 'string' },
        digitalId: { type: 'string' }
      },
      required: ['recipients', 'digitalId']
    },
    (info, body) => services.readinessConfirm.sendMails(info, body)
  );

  post('manual/skip-reassess-confirm', '人工跳过补充问卷确认，直接进入更新个人评估', { type: 'object', properties: { runId: { type: 'string' }, personId: { type: 'string' } }, required: ['runId', 'personId'] }, (info, body) =>
    services.readiness.skipReassessConfirm(info, body)
  );

  post('manual/advance-answers', '确认答卷并进入下一阶段（须已回收到答卷）', { type: 'object', properties: { runId: { type: 'string' }, kind: kindSchema, personId: { type: 'string' } }, required: ['runId', 'kind'] }, (info, body) =>
    services.readiness.advanceAnswers(info, body)
  );

  post('manual/reanswer', '重新回答：作废当前答卷并按原收件人自动重发问卷', { type: 'object', properties: { runId: { type: 'string' }, kind: kindSchema, personId: { type: 'string' } }, required: ['runId', 'kind'] }, (info, body) =>
    services.readiness.reanswer(info, body)
  );

  post(
    'manual/submit-answers',
    '录入答卷并继续',
    {
      type: 'object',
      properties: { runId: { type: 'string' }, kind: kindSchema, personId: { type: 'string' }, answers: {}, videoAnswers: { type: 'array' } },
      required: ['runId', 'kind']
    },
    (info, body) => services.readiness.submitAnswers(info, body)
  );

  post('trigger-report', '参与人全部完成后触发报告生成', { type: 'object', properties: { runId: { type: 'string' } }, required: ['runId'] }, (info, body) => services.readiness.triggerReports(info, body));

  const stageBody = { type: 'object', properties: { runId: { type: 'string' }, scope: scopeSchema, personId: { type: 'string' }, stage: { type: 'string' } }, required: ['runId', 'stage'] };
  post('rollback', '退回到某阶段重新执行', stageBody, (info, body) => services.readiness.rollback(info, body));
  post('retry', '重试失败阶段', stageBody, (info, body) => services.readiness.retry(info, body));
  post(
    'stage/apply',
    '退回到该阶段并以指定版本数据（不传 output 用历史版本，传 output 用修改后的当前输出）生成新版本后继续',
    { type: 'object', properties: { runId: { type: 'string' }, id: { type: 'string' }, output: {} }, required: ['id'] },
    (info, body) => services.readiness.applyStageVersion(info, body)
  );

  const recipientItem = { type: 'object', properties: { name: { type: 'string' }, email: { type: 'string' }, employeeId: { type: 'string' }, tenantUserId: { type: 'string' } } };
  const sendProperties = {
    kind: kindSchema,
    runIds: stringArray,
    recipients: { type: 'array', items: recipientItem },
    personIds: stringArray,
    // 按 Role 各自指定收件人（经理/员工批量发送时用）；有 items 时优先于共用 recipients
    items: {
      type: 'array',
      items: {
        type: 'object',
        properties: { runId: { type: 'string' }, recipients: { type: 'array', items: recipientItem }, personIds: stringArray },
        required: ['runId']
      }
    }
  };
  post('send/preview', '批量发送预览', { type: 'object', properties: sendProperties, required: ['kind'] }, (info, body) => services.readinessSend.preview(info, body));

  post('send/defaults', '发送弹窗的默认截止日期（取问卷项目有效期）', { type: 'object', properties: { kind: kindSchema, runIds: stringArray }, required: ['kind', 'runIds'] }, (info, body) => services.readinessSend.sendDefaults(info, body));

  post(
    'send/batch',
    '批量发送问卷邮件（同邮箱合并为一封；items 可按 Role 各自收件人）',
    { type: 'object', properties: Object.assign({ language: { type: 'string' }, deadline: { type: 'string' } }, sendProperties), required: ['kind'] },
    (info, body) => services.readinessSend.send(info, body)
  );

  post('invite/delete', '删除问卷邀请（参与人已提交答卷的除外）', { type: 'object', properties: { inviteIds: stringArray }, required: ['inviteIds'] }, (info, body) => services.readinessSend.deleteInvites(info, body));
  post(
    'invite/resend',
    '重发问卷邮件（deadline 为新的有效期，YYYY-MM-DD，已过期的邀请需传）',
    { type: 'object', properties: { inviteIds: stringArray, language: { type: 'string' }, deadline: { type: 'string' } }, required: ['inviteIds'] },
    (info, body) => services.readinessSend.resend(info, body)
  );

  post('answers/sync', '从 AI 面试同步答卷', { type: 'object', properties: { runId: { type: 'string' } } }, (info, body) => services.readinessSend.syncAnswers(info, body));

  /** 建流程时选参与人（员工）：与租户端 employee.list 同口径，只读 */
  fastify.post(
    `${base}/employee-options`,
    {
      onRequest,
      schema: {
        tags: ['readiness'],
        summary: 'Readiness 流程：平台管理-可选参与人（员工）',
        body: {
          type: 'object',
          properties: { tenantId: { type: 'string' }, positionId: { type: 'string' }, perPage: { type: 'number' }, currentPage: { type: 'number' } },
          required: ['tenantId']
        }
      }
    },
    async request => {
      const { tenantId, positionId, perPage = 200, currentPage = 1 } = request.body || {};
      return services.employee.list({ tenantId }, { perPage, currentPage, positionId });
    }
  );
});
