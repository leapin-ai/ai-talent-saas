/**
 * 超管为任意用户管理 MCP 密钥；客户端自助走 @kne/fastify-mcp 自带的 `{prefix}/mcp-keys`（只能管自己）。
 * 复用插件的 services.key 与 models.key。
 */
const registerMcpAdminKeys = (fastify, { prefix, mcpName = 'mcp', authenticate, getUserModel }) => {
  const base = `${prefix}/admin/mcp/mcp-keys`;
  const mcp = () => fastify[mcpName];

  const attachUsers = async rows => {
    const ids = [...new Set(rows.map(row => String(row.subjectId)))];
    const users = ids.length && getUserModel ? await getUserModel().findAll({ where: { id: ids } }) : [];
    const userMap = new Map(users.map(user => [String(user.id), user]));
    return rows.map(row => {
      const user = userMap.get(String(row.subjectId));
      return {
        id: String(row.id),
        name: row.name || '',
        secret: '********',
        subjectId: String(row.subjectId),
        user: user ? { id: String(user.id), nickname: user.nickname, email: user.email, phone: user.phone } : null,
        createdAt: row.createdAt
      };
    });
  };

  fastify.get(
    base,
    {
      onRequest: authenticate,
      schema: {
        tags: ['MCP Keys Admin'],
        summary: '超管 MCP 密钥列表（默认全部用户，可按 subjectId 筛选；secret 打码）',
        querystring: {
          type: 'object',
          properties: {
            subjectId: { type: 'string' },
            perPage: { type: 'number', default: 20 },
            currentPage: { type: 'number', default: 1 }
          }
        }
      }
    },
    async request => {
      const { subjectId, perPage = 20, currentPage = 1 } = request.query || {};
      const { count, rows } = await mcp().models.key.findAndCountAll({
        where: subjectId ? { subjectId: String(subjectId) } : {},
        order: [
          ['createdAt', 'DESC'],
          ['id', 'DESC']
        ],
        limit: perPage,
        offset: (currentPage - 1) * perPage
      });
      return { pageData: await attachUsers(rows), totalCount: count };
    }
  );

  fastify.post(
    base,
    {
      onRequest: authenticate,
      schema: {
        tags: ['MCP Keys Admin'],
        summary: '超管为指定用户创建 MCP 密钥（明文 secret 仅返回一次）',
        body: {
          type: 'object',
          required: ['subjectId'],
          properties: {
            subjectId: { type: 'string', minLength: 1 },
            name: { type: 'string' }
          }
        }
      }
    },
    async request => {
      return mcp().services.key.create({ subjectId: request.body.subjectId, name: request.body.name });
    }
  );

  fastify.delete(
    `${base}/:id`,
    {
      onRequest: authenticate,
      schema: {
        tags: ['MCP Keys Admin'],
        summary: '超管删除任意用户的 MCP 密钥'
      }
    },
    async request => {
      const row = await mcp().models.key.findByPk(request.params.id);
      if (!row) {
        throw new Error('MCP 密钥不存在');
      }
      await row.destroy();
      return {};
    }
  );
};

module.exports = { registerMcpAdminKeys };
