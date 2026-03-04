const fp = require('fastify-plugin');

module.exports = fp(async (fastify, options) => {
  const { services } = fastify[options.name];
  const { services: tenantServices, authenticate } = fastify.tenant;
  const userAuthenticate = fastify.account.authenticate.user;
  fastify.get(
    `${options.prefix}/tenant-extra/user-list`,
    {
      onRequest: [userAuthenticate, authenticate.tenantUser],
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
      const userList = await tenantServices.user.list(
        Object.assign({}, request.query, {
          tenantId: request.tenantUserInfo.tenantId
        })
      );

      const ids = userList.pageData.map(item => item.options?.position).filter(item => !!item);
      const positionList = await services.position.list(request.tenantUserInfo, {
        filter: {
          ids
        },
        perPage: ids.length
      });

      return Object.assign({}, userList, { positionList: positionList.pageData });
    }
  );
});
