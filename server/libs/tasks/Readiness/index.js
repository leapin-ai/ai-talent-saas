/**
 * Readiness 任务：统一调用 Readiness 上游服务
 * input = { path, params, runId, stageDataId, personId, stage }
 * - 每次调用的接口 path 与请求参数都从 input 传入
 * - 请求、受理结果、错误全部写入任务 log（日志字段保持结构化对象，不存 JSON 字符串）
 * - 上游异步回调：受理成功后返回 false，保持任务运行中，等待 /task/callback 回调完成任务
 */
const ensureSlash = require('@kne/ensure-slash');

// ENV=local 时 ORIGIN 常为 localhost，上游访问不到，回退到本机局域网地址；其它环境一律用 ORIGIN
const LOCAL_CALLBACK_ORIGIN = 'http://192.168.50.52:3050';

const REQUEST_TIMEOUT = 30 * 1000;
const LOG_MAX_LENGTH = 8000;
const LOG_STRING_MAX = 400;
const LOG_ARRAY_MAX = 30;
const LOG_DEPTH_MAX = 8;

/** 超长字符串截断，保留可读后缀（供「查看数据」JsonView 展开，勿整段压成 preview 字符串） */
const shrinkString = (text, max = LOG_STRING_MAX) => {
  if (typeof text !== 'string' || text.length <= max) {
    return text;
  }
  return `${text.slice(0, max)}…(+${text.length - max})`;
};

/**
 * 日志值保持结构化对象，便于前端 JsonView 展示。
 * 旧逻辑整段 JSON.stringify 后塞进 preview，assess 等带 materials 的请求体会变成半截转义字符串，查看数据无法展开。
 */
const toLogValue = (value, depth = 0) => {
  if (value == null || typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }
  if (typeof value === 'string') {
    return shrinkString(value);
  }
  if (typeof value !== 'object') {
    return value;
  }
  if (depth >= LOG_DEPTH_MAX) {
    return '[…]';
  }
  if (Array.isArray(value)) {
    const items = value.slice(0, LOG_ARRAY_MAX).map(item => toLogValue(item, depth + 1));
    if (value.length > LOG_ARRAY_MAX) {
      items.push(`…(+${value.length - LOG_ARRAY_MAX} items)`);
    }
    return items;
  }
  const out = {};
  for (const [key, item] of Object.entries(value)) {
    out[key] = toLogValue(item, depth + 1);
  }
  const text = JSON.stringify(out) ?? '';
  if (text.length <= LOG_MAX_LENGTH) {
    return out;
  }
  // 仍过大：再压一层字符串叶子，避免回退成整段 preview
  const tighter = {};
  for (const [key, item] of Object.entries(out)) {
    tighter[key] = typeof item === 'string' ? shrinkString(item, Math.min(120, LOG_STRING_MAX)) : item;
  }
  return tighter;
};

// 上游返回的 JSON 文本解析为对象；非 JSON 原样保留字符串
const parseResponseText = text => {
  if (!text) {
    return {};
  }
  try {
    return JSON.parse(text);
  } catch (e) {
    return text;
  }
};

// 仅用于拼接错误信息的短文本
const briefText = (value, max) => {
  const text = typeof value === 'string' ? value : (JSON.stringify(value) ?? '');
  return text.length > max ? `${text.slice(0, max)}...` : text;
};

const runner = async (fastify, options, { task, log }) => {
  const host = String(fastify.config.READINESS_API_URL || '').replace(/\/+$/, '');
  const { path, params } = task.input || {};

  if (!host) {
    const error = new Error('READINESS_API_URL 未配置');
    await log({ message: '调用失败', data: { error: error.message } });
    throw error;
  }
  if (!path || typeof path !== 'string' || !path.startsWith('/')) {
    const error = new Error('Readiness 任务缺少合法的 input.path');
    await log({ message: '调用失败', data: { error: error.message, path } });
    throw error;
  }

  const body = Object.assign({}, params);
  if (!body.callback_url) {
    const origin = ensureSlash(fastify.config.ORIGIN || '');
    const callbackOrigin = fastify.config.ENV === 'local' ? LOCAL_CALLBACK_ORIGIN : origin;
    body.callback_url = `${callbackOrigin}${options.prefix}/callback?taskId=${encodeURIComponent(task.id)}`;
  }
  const url = `${host}${path}`;
  await log({ message: '发起调用', data: { url, body: toLogValue(body) } });

  let response;
  let text = '';
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT)
    });
    text = await response.text();
  } catch (e) {
    await log({ message: '调用失败', data: { url, error: e.message } });
    throw new Error(`Readiness 请求失败：${e.message}`);
  }

  const payload = parseResponseText(text);
  const businessCode = payload && typeof payload === 'object' ? payload.code : null;

  // code 423：岗位输入信息有误（可能 HTTP 423，也可能 HTTP 200 + body.code）
  if (response.status === 423 || Number(businessCode) === 423) {
    await log({ message: '调用失败', data: { url, status: response.status, code: 423, response: toLogValue(payload) } });
    const error = new Error(`Readiness 返回 code 423：${briefText(payload, 500) || '岗位输入信息有误'}`);
    error.code = 423;
    throw error;
  }

  if (!response.ok) {
    await log({ message: '调用失败', data: { url, status: response.status, response: toLogValue(payload) } });
    throw new Error(`Readiness 返回 HTTP ${response.status}：${briefText(payload, 500)}`);
  }

  await log({ message: '上游已受理，等待回调', data: { url, status: response.status, response: toLogValue(payload) } });
  // 返回 false：任务保持 running，由回调驱动完成
  return false;
};

module.exports = runner;
module.exports.toLogValue = toLogValue;
