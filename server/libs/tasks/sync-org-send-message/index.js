const get = require('lodash/get');

const runner = async (fastify, options, { task }) => {
  const { tenantId, syncSource, config: orgSyncConfig, touser, msgtype = 'text', content, toparty, totag, safe = 0, enable_id_trans = 0, enable_duplicate_check = 0, duplicate_check_interval = 1800 } = task.input;

  const syncOrgSecret = fastify.config.SYNC_ORG_SECRET;
  const syncOrgHost = fastify.config.SYNC_ORG_HOST;

  if (!syncOrgSecret || !syncOrgHost) {
    throw new Error('SYNC_ORG_SECRET 或 SYNC_ORG_HOST 未配置');
  }

  if (!orgSyncConfig.enabled || !orgSyncConfig.targetId) {
    throw new Error('未找到有效的组织同步配置');
  }

  const agentId = get(orgSyncConfig, 'props.agentid');

  if (!agentId) {
    throw new Error('无法从环境变量中解析出 agentId');
  }

  if (!touser || !Array.isArray(touser) || touser.length === 0) {
    throw new Error('touser 不能为空，且必须为非空数组');
  }

  if (!content || (typeof content === 'object' && !content.content) || (typeof content === 'string' && !content.trim())) {
    throw new Error('消息内容 content 不能为空');
  }

  // 1. 获取 token
  const tokenResponse = await fetch(`${syncOrgHost}/api/v1/system/auth/external/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ secret_key: syncOrgSecret })
  });

  if (tokenResponse.status !== 200) {
    throw new Error(`获取 token 失败: ${tokenResponse.status} ${tokenResponse.statusText}`);
  }

  const tokenData = await tokenResponse.json();

  const token = get(tokenData, 'data.access_token');

  if (!token) {
    throw new Error('获取 token 返回数据中未找到 token');
  }

  // 2. 构造消息请求体
  const platform = syncSource || 'wecom';

  let messageContent = content;

  // markdown 模式下，将图片本地路径替换为 OSS 签名 URL
  if (msgtype === 'markdown' && typeof content.content === 'string') {
    const fileUrlRegex = /!\[([^\]]*)\]\((\/api\/v\d+\/static\/file-id\/([0-9a-f-]+))\)/g;
    const matches = [...content.content.matchAll(fileUrlRegex)];
    if (matches.length > 0) {
      const replacements = await Promise.all(
        matches.map(async match => {
          const fileId = match[3];
          try {
            const ossUrl = await fastify.fileManager.services.getFileUrl({ id: fileId });
            return { original: match[0], replacement: `![${match[1]}](${ossUrl})` };
          } catch (e) {
            return { original: match[0], replacement: match[0] };
          }
        })
      );
      let text = content.content;
      for (const { original, replacement } of replacements) {
        text = text.replace(original, replacement);
      }
      messageContent = { ...content, content: text };
    }
  }

  const messageBody = {
    to_user: touser,
    msg_type: msgtype,
    content: messageContent,
    safe,
    enable_id_trans,
    enable_duplicate_check,
    duplicate_check_interval
  };

  if (toparty && Array.isArray(toparty) && toparty.length > 0) {
    messageBody.toparty = toparty;
  }

  if (totag && Array.isArray(totag) && totag.length > 0) {
    messageBody.totag = totag;
  }

  // 3. 调用发送消息接口
  const sendResponse = await fetch(`${syncOrgHost}/api/v1/message/${platform}/send?agent_id=${encodeURIComponent(agentId)}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify(messageBody)
  });

  if (sendResponse.status !== 200) {
    const errorText = await sendResponse.text();
    throw new Error(`发送消息失败: ${sendResponse.status} ${sendResponse.statusText} - ${errorText}`);
  }

  const sendResult = await sendResponse.json();

  return {
    tenantId,
    syncSource,
    result: sendResult
  };
};

module.exports = runner;
