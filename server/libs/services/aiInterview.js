const fp = require('fastify-plugin');
const qs = require('qs');
const generateSignature = require('@kne/fastify-signature/generateSignature');

const SECRET_KEY = 'AI_INTERVIEW_SECRET_KEY';

const normalizeFeatureBindings = list => {
  if (!Array.isArray(list)) {
    return [];
  }
  return list
    .map(item => ({
      key: item?.key ? String(item.key).trim() : '',
      projectId: item?.projectId ? String(item.projectId).trim() : '',
      projectName: item?.projectName ? String(item.projectName).trim() : '',
      clientId: item?.clientId ? String(item.clientId).trim() : ''
    }))
    .filter(item => item.key && item.projectId);
};

const toPublic = ({ cdnUrl, version, apiUrl, appId, hasSecretKey, featureBindings }) => ({
  cdnUrl: cdnUrl ? String(cdnUrl).trim() : '',
  version: version ? String(version).trim() : '',
  apiUrl: apiUrl ? String(apiUrl).trim() : '',
  appId: appId ? String(appId).trim() : '',
  hasSecretKey: !!hasSecretKey,
  featureBindings: normalizeFeatureBindings(featureBindings)
});

/**
 * API 根路径格式示例：
 * https://api.gw.leapin-ai.com/ai-interview/cn-staging/api/v1
 * open-api 最终：{apiBase}/open-api/project/list
 */
const getApiBase = apiUrl => {
  const parsed = new URL(String(apiUrl).trim());
  let pathname = (parsed.pathname || '').replace(/\/+$/, '');
  // 若粘贴了完整接口（如 .../api/v1/signature/list），截到 /api/v1
  const apiVMatch = pathname.match(/^(.*\/api\/v\d+)(?:\/|$)/i);
  if (apiVMatch) {
    pathname = apiVMatch[1];
  } else if (!pathname) {
    pathname = '/api/v1';
  } else {
    // 仅网关前缀时补 /api/v1，保留 /ai-interview/cn-staging 等路径
    pathname = `${pathname}/api/v1`.replace(/\/{2,}/g, '/');
  }
  return `${parsed.origin}${pathname}`;
};

const buildOpenApiUrl = (apiUrl, pathname, query) => {
  const apiBase = getApiBase(apiUrl);
  const path = String(pathname || '').replace(/^\/+/, '');
  // 显式字符串拼接，避免 new URL(相对路径, base) 吃掉末段 v1
  const url = new URL(`${apiBase}/open-api/${path}`);
  if (query) {
    url.search = qs.stringify(query);
  }
  return { apiBase, requestUrl: url.toString() };
};

module.exports = fp(async (fastify, options) => {
  const tenantServices = fastify.tenant.services;
  const tenantModels = fastify.tenant.models;

  const getSettingRow = async tenantId => {
    await tenantServices.setting.detail({ tenantId });
    return tenantModels.setting.findOne({ where: { tenantId } });
  };

  const readSecretValue = async tenantId => {
    return tenantServices.setting.getSecrets({ tenantId, key: SECRET_KEY });
  };

  const upsertSecret = async ({ secretKey, settingRow }) => {
    const secrets = Array.isArray(settingRow.secrets) ? settingRow.secrets.slice(0) : [];
    const index = secrets.findIndex(item => item.key === SECRET_KEY);
    const nextItem = { key: SECRET_KEY, value: secretKey };
    if (index === -1) {
      secrets.push(nextItem);
    } else {
      secrets.splice(index, 1, nextItem);
    }
    settingRow.set('secrets', secrets);
    settingRow.changed('secrets', true);
  };

  const writePublicOptions = ({ settingRow, publicData }) => {
    const prev = settingRow.options?.aiInterview || {};
    const nextOptions = Object.assign({}, settingRow.options || {}, {
      aiInterview: {
        cdnUrl: publicData.cdnUrl,
        version: publicData.version,
        apiUrl: publicData.apiUrl,
        appId: publicData.appId,
        hasSecretKey: publicData.hasSecretKey,
        featureBindings: Array.isArray(publicData.featureBindings) ? normalizeFeatureBindings(publicData.featureBindings) : normalizeFeatureBindings(prev.featureBindings)
      }
    });
    settingRow.set('options', nextOptions);
    settingRow.changed('options', true);
  };

  /** 把 options 里遗留的 secretKey 迁到 secrets，并清洗 options */
  const migrateLegacySecret = async settingRow => {
    const raw = settingRow.options?.aiInterview || {};
    if (!raw.secretKey) {
      return false;
    }
    const legacySecret = String(raw.secretKey).trim();
    const existingSecret = (settingRow.secrets || []).find(item => item.key === SECRET_KEY)?.value;
    if (legacySecret && !existingSecret) {
      await upsertSecret({ secretKey: legacySecret, settingRow });
    }
    const publicData = toPublic({
      cdnUrl: raw.cdnUrl,
      version: raw.version,
      apiUrl: raw.apiUrl,
      appId: raw.appId,
      hasSecretKey: !!(legacySecret || existingSecret),
      featureBindings: raw.featureBindings
    });
    writePublicOptions({ settingRow, publicData });
    await settingRow.save();
    return true;
  };

  const detail = async ({ tenantId }) => {
    const settingRow = await getSettingRow(tenantId);
    await migrateLegacySecret(settingRow);
    await settingRow.reload();
    const raw = settingRow.options?.aiInterview || {};
    const secretValue = (settingRow.secrets || []).find(item => item.key === SECRET_KEY)?.value;
    return toPublic({
      cdnUrl: raw.cdnUrl,
      version: raw.version,
      apiUrl: raw.apiUrl,
      appId: raw.appId,
      hasSecretKey: !!(secretValue || raw.hasSecretKey),
      featureBindings: raw.featureBindings
    });
  };

  const save = async ({ tenantId, cdnUrl, version, apiUrl, appId, secretKey }) => {
    const settingRow = await getSettingRow(tenantId);
    await migrateLegacySecret(settingRow);
    await settingRow.reload();

    const existingSecret = (settingRow.secrets || []).find(item => item.key === SECRET_KEY)?.value;
    const nextSecret = secretKey ? String(secretKey).trim() : existingSecret;
    const prevBindings = settingRow.options?.aiInterview?.featureBindings;

    const publicData = toPublic({
      cdnUrl,
      version,
      apiUrl,
      appId,
      hasSecretKey: !!nextSecret,
      featureBindings: prevBindings
    });

    if (!publicData.cdnUrl || !publicData.version || !publicData.apiUrl || !publicData.appId || !nextSecret) {
      throw new Error('AI面试设置字段不完整');
    }

    await upsertSecret({ secretKey: nextSecret, settingRow });
    writePublicOptions({ settingRow, publicData });
    await settingRow.save();

    return publicData;
  };

  const getCredentials = async tenantId => {
    const publicData = await detail({ tenantId });
    if (!(publicData.apiUrl && publicData.appId && publicData.hasSecretKey)) {
      throw new Error('请先完成 AI 面试基础设置');
    }
    const secretKey = await readSecretValue(tenantId);
    if (!secretKey) {
      throw new Error('请先完成 AI 面试基础设置');
    }
    return {
      apiUrl: publicData.apiUrl,
      appId: publicData.appId,
      secretKey
    };
  };

  const throwOpenApiError = message => {
    const error = new Error(message || 'AI interview open-api request failed');
    // 不透传 open-api 的业务 code / HTTP status，统一 500 + 错误信息
    error.statusCode = 500;
    error.code = 500;
    throw error;
  };

  const openApiRequest = async (credentials, pathname, { method = 'GET', body, query } = {}) => {
    const { apiBase, requestUrl } = buildOpenApiUrl(credentials.apiUrl, pathname, query);
    let response;
    try {
      const signaturePayload = generateSignature(credentials.appId, credentials.secretKey, 60);
      response = await fetch(requestUrl, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'x-openapi-appid': signaturePayload.appId,
          'x-openapi-timestamp': String(signaturePayload.timestamp),
          'x-openapi-expire': String(signaturePayload.expire),
          'x-openapi-signature': signaturePayload.signature
        },
        body: body ? JSON.stringify(body) : undefined
      });
    } catch (e) {
      throwOpenApiError(e.message || 'AI interview open-api 请求失败');
    }
    const text = await response.text();
    let data = {};
    if (text) {
      try {
        data = JSON.parse(text);
      } catch (e) {
        throwOpenApiError(`AI interview open-api 返回非 JSON（status=${response.status}）requestUrl=${requestUrl} bodyPreview=${text.slice(0, 120)}`);
      }
    }
    if (!response.ok) {
      throwOpenApiError(data.msg || data.message || data.error || text || `AI interview open-api request failed: ${response.status}`);
    }
    if (Object.prototype.hasOwnProperty.call(data, 'code') && data.code !== 0) {
      throwOpenApiError(data.msg || data.message || data.error || 'AI interview open-api request failed');
    }
    if (Object.prototype.hasOwnProperty.call(data, 'code')) {
      return data.data;
    }
    return data;
  };

  const getProjects = async ({ tenantId, currentPage = 1, perPage = 20, filter }) => {
    const credentials = await getCredentials(tenantId);
    const now = new Date().toISOString();
    return openApiRequest(credentials, 'project/list', {
      query: {
        currentPage,
        perPage,
        filter: Object.assign({}, filter || {}, {
          status: 'open',
          startTime: { endTime: now },
          endTime: { startTime: now }
        })
      }
    });
  };

  const saveFeatureBinding = async ({ tenantId, key, projectId, projectName, clientId }) => {
    const featureKey = key ? String(key).trim() : '';
    const nextProjectId = projectId ? String(projectId).trim() : '';
    if (!featureKey || !nextProjectId) {
      throw new Error('功能项与项目不能为空');
    }

    const settingRow = await getSettingRow(tenantId);
    await migrateLegacySecret(settingRow);
    await settingRow.reload();

    const raw = settingRow.options?.aiInterview || {};
    const secretValue = (settingRow.secrets || []).find(item => item.key === SECRET_KEY)?.value;
    if (!(raw.apiUrl && raw.appId && secretValue)) {
      throw new Error('请先完成 AI 面试基础设置');
    }

    const nextBinding = {
      key: featureKey,
      projectId: nextProjectId,
      projectName: projectName ? String(projectName).trim() : '',
      clientId: clientId ? String(clientId).trim() : ''
    };
    const prevBindings = normalizeFeatureBindings(raw.featureBindings);
    const index = prevBindings.findIndex(item => item.key === featureKey);
    const featureBindings = prevBindings.slice(0);
    if (index === -1) {
      featureBindings.push(nextBinding);
    } else {
      featureBindings.splice(index, 1, nextBinding);
    }

    const publicData = toPublic({
      cdnUrl: raw.cdnUrl,
      version: raw.version,
      apiUrl: raw.apiUrl,
      appId: raw.appId,
      hasSecretKey: true,
      featureBindings
    });
    writePublicOptions({ settingRow, publicData });
    await settingRow.save();
    return publicData;
  };

  const removeFeatureBinding = async ({ tenantId, key }) => {
    const featureKey = key ? String(key).trim() : '';
    if (!featureKey) {
      throw new Error('功能项不能为空');
    }

    const settingRow = await getSettingRow(tenantId);
    await migrateLegacySecret(settingRow);
    await settingRow.reload();

    const raw = settingRow.options?.aiInterview || {};
    const secretValue = (settingRow.secrets || []).find(item => item.key === SECRET_KEY)?.value;
    const featureBindings = normalizeFeatureBindings(raw.featureBindings).filter(item => item.key !== featureKey);
    const publicData = toPublic({
      cdnUrl: raw.cdnUrl,
      version: raw.version,
      apiUrl: raw.apiUrl,
      appId: raw.appId,
      hasSecretKey: !!(secretValue || raw.hasSecretKey),
      featureBindings
    });
    writePublicOptions({ settingRow, publicData });
    await settingRow.save();
    return publicData;
  };

  Object.assign(fastify[options.name].services, {
    aiInterview: {
      detail,
      save,
      getProjects,
      saveFeatureBinding,
      removeFeatureBinding,
      getSecretKey: async ({ tenantId }) => readSecretValue(tenantId),
      getFeatureBinding: async ({ tenantId, key }) => {
        const publicData = await detail({ tenantId });
        const featureKey = key ? String(key).trim() : '';
        const binding = (publicData.featureBindings || []).find(item => item.key === featureKey);
        if (!binding?.projectId) {
          throw new Error(`未配置功能项「${featureKey}」对应的项目`);
        }
        return { binding, setting: publicData };
      },
      inviteCandidate: async ({ tenantId, projectId, name, email, phone, description, expires }) => {
        const credentials = await getCredentials(tenantId);
        return openApiRequest(credentials, 'project/invite-candidate', {
          method: 'POST',
          body: {
            id: projectId,
            name,
            email: email || undefined,
            phone: phone || undefined,
            description: description || undefined,
            expires,
            needLoginShorten: true
          }
        });
      },
      getInterviewList: async ({ tenantId, projectId, currentPage = 1, perPage = 10, filter }) => {
        const credentials = await getCredentials(tenantId);
        return openApiRequest(credentials, 'project/interview-list', {
          query: {
            id: projectId,
            currentPage,
            perPage,
            filter: filter || {}
          }
        });
      },
      /** ajax 根地址：去掉末尾 /api/v1，供前端直连面试接口 */
      getAjaxBaseUrl: apiUrl => {
        const apiBase = getApiBase(apiUrl);
        return apiBase.replace(/\/api\/v\d+$/i, '');
      }
    }
  });
});
