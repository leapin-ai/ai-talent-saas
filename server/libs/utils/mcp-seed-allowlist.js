const { scenariosFromOperation } = require('@kne/fastify-mcp');

/**
 * 路径兜底场景（路由尚未声明 x-mcp-scenarios / tags 时用）。
 * 优先应在 schema 写 `x-mcp-scenarios`；本函数仅作迁移期回退。
 */
const inferScenariosByPath = apiPathOrOp => {
  const path = typeof apiPathOrOp === 'string' ? apiPathOrOp : String(apiPathOrOp?.path || '');
  if (/\/tenant\/admin\//.test(path) || /\/admin\/(readiness|mcp|getUser|addUser|saveUser|initSuper)/.test(path)) {
    return ['平台超管'];
  }
  if (/\/tenant\/position\//.test(path)) {
    return ['岗位管理'];
  }
  if (/\/tenant\/employee\//.test(path) || /\/tenant\/performance\//.test(path)) {
    return ['员工档案'];
  }
  if (/\/tenant\/.*readiness|\/admin\/readiness/.test(path)) {
    return ['就绪度'];
  }
  if (/\/tenant\/talent-review/.test(path)) {
    return ['人才盘点'];
  }
  if (/\/tenant\/.*talent-collect-invite|\/tenant\/resume\/|\/public\/talent-collect/.test(path)) {
    return ['人才采集'];
  }
  if (/\/tenant\/ai-interview|\/tenant\/share-report|\/tenant\/market\/|\/public\/share-report/.test(path)) {
    return ['AI面试与分享'];
  }
  if (/\/tenant\/home-setting/.test(path)) {
    return ['租户设置'];
  }
  if (/\/tenant\/(role|permission|org|user|shared-group|mail-setting)/.test(path)) {
    return ['租户权限与组织'];
  }
  if (/\/tenant-extra\//.test(path)) {
    return ['租户扩展'];
  }
  if (/\/public\//.test(path)) {
    return ['公开免登录'];
  }
  if (/\/signature\//.test(path)) {
    return ['开放API密钥'];
  }
  if (/\/(account|user|oidc|file-manager|task|message|app-manager)/.test(path)) {
    return ['系统与账号'];
  }
  return ['其它'];
};

/**
 * seedFromSwagger.getScenarios：优先 schema（x-mcp-scenarios / tags），否则路径兜底。
 */
const resolveSeedScenarios = op => {
  const fromSchema = scenariosFromOperation(op);
  if (fromSchema.length) {
    return fromSchema;
  }
  return inferScenariosByPath(op);
};

module.exports = { resolveSeedScenarios, inferScenariosByPath, inferScenarios: inferScenariosByPath };
