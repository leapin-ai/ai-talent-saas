const fp = require('fastify-plugin');

module.exports = fp(async (fastify, options) => {
  const { services } = fastify[options.name];
  const { services: tenantServices, authenticate: tenantAuthenticate } = fastify.tenant;
  const { authenticate } = fastify.account;
  fastify.get(
    `${options.prefix}/tenant-extra/user-list`,
    {
      onRequest: [authenticate.user, tenantAuthenticate.tenantUser],
      schema: {
        summary: '租户用户列表',
        query: {
          type: 'object',
          properties: {
            filter: {
              type: 'object'
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
      return services.employee.userList(request.tenantUserInfo, request.query);
    }
  );

  fastify.get(
    `${options.prefix}/tenant-extra/admin/user-list`,
    {
      onRequest: [authenticate.user, authenticate.admin],
      schema: {
        summary: '平台管理-租户用户列表（含岗位、员工）',
        query: {
          type: 'object',
          properties: {
            tenantId: { type: 'string' },
            filter: { type: 'object' },
            perPage: { type: 'number', default: 20 },
            currentPage: { type: 'number', default: 1 }
          },
          required: ['tenantId']
        }
      }
    },
    async request => {
      const { tenantId, ...query } = request.query;
      return services.employee.adminUserList({ tenantId }, query);
    }
  );

  fastify.post(
    `${options.prefix}/tenant-extra/parse-join-token`,
    {
      onRequest: [authenticate.user],
      schema: {
        summary: '解析加入租户邀请（含岗位列表）',
        body: {
          type: 'object',
          properties: {
            token: { type: 'string' }
          },
          required: ['token']
        }
      }
    },
    async request => {
      const parsed = await tenantServices.user.parseToken(request.body);
      const tenantUser = parsed.tenantUser;
      const tenantId = parsed.tenant?.id;

      const rawPosition = tenantUser?.options?.position;
      const positionId = rawPosition == null || rawPosition === '' ? null : typeof rawPosition === 'object' && rawPosition.id != null ? rawPosition.id : rawPosition;

      let positionList = [];
      if (tenantId && positionId != null) {
        const positionResult = await services.position.list(
          { tenantId },
          {
            filter: { ids: [String(positionId)] },
            perPage: 1,
            currentPage: 1
          }
        );
        positionList = positionResult.pageData || [];
      }

      const roleDetails = tenantUser?.roleDetails;
      const roles = Array.isArray(roleDetails) && roleDetails.length ? roleDetails : tenantUser?.roles;

      return Object.assign({}, parsed, {
        tenantUser: Object.assign({}, tenantUser?.toJSON ? tenantUser.toJSON() : tenantUser, { roles }),
        positionList
      });
    }
  );
});
