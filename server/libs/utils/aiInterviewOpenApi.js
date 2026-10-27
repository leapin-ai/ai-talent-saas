const qs = require('qs');
const generateSignature = require('@kne/fastify-signature/generateSignature');

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

const createSignedHeaders = ({ appId, secretKey }) => {
  const signaturePayload = generateSignature(appId, secretKey, 60);
  return {
    'Content-Type': 'application/json',
    'x-openapi-appid': signaturePayload.appId,
    'x-openapi-timestamp': String(signaturePayload.timestamp),
    'x-openapi-expire': String(signaturePayload.expire),
    'x-openapi-signature': signaturePayload.signature
  };
};

const throwOpenApiError = message => {
  const error = new Error(message || 'AI interview open-api request failed');
  // 不透传 open-api 的业务 code / HTTP status，统一 500 + 错误信息
  error.statusCode = 500;
  error.code = 500;
  throw error;
};

const openApiRequest = async (credentials, pathname, { method = 'GET', body, query, authenticate = true } = {}) => {
  const { requestUrl } = buildOpenApiUrl(credentials.apiUrl, pathname, query);
  let response;
  try {
    response = await fetch(requestUrl, {
      method,
      headers: authenticate ? createSignedHeaders(credentials) : { 'Content-Type': 'application/json' },
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

module.exports = {
  getApiBase,
  buildOpenApiUrl,
  createSignedHeaders,
  openApiRequest
};
