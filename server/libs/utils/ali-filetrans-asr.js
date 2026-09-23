/**
 * 阿里云录音文件识别（nls-filetrans POP API）
 * 文档：https://help.aliyun.com/zh/isi/developer-reference/api-reference-2
 * Node 示例：https://help.aliyun.com/zh/isi/developer-reference/node-js-demo
 */
const { RPCClient } = require('@alicloud/pop-core');

const SUCCESS_STATUS = new Set(['SUCCESS', 'SUCCESS_WITH_NO_VALID_FRAGMENT']);
const PENDING_STATUS = new Set(['RUNNING', 'QUEUEING']);

const createFiletransClient = config => {
  const accessKeyId = config.accessKeyId || config.apiKey;
  const accessKeySecret = config.accessKeySecret || config.apiSecret;
  const endpoint = config.endpoint || `https://${config.domain || 'filetrans.cn-shanghai.aliyuncs.com'}`;
  const apiVersion = config.apiVersion || '2018-08-17';
  if (!accessKeyId || !accessKeySecret) {
    throw new Error('ALI_ASR_ACCESS_KEY_ID / ALI_ASR_ACCESS_KEY_SECRET 未配置');
  }
  return new RPCClient({
    accessKeyId,
    accessKeySecret,
    endpoint,
    apiVersion,
    opts: { timeout: 20000 }
  });
};

const getAsrConfigFromEnv = env => ({
  appKey: env.ALI_ASR_APP_KEY,
  accessKeyId: env.ALI_ASR_ACCESS_KEY_ID,
  accessKeySecret: env.ALI_ASR_ACCESS_KEY_SECRET,
  region: env.ALI_ASR_REGION || 'cn-shanghai',
  domain: env.ALI_ASR_DOMAIN || 'filetrans.cn-shanghai.aliyuncs.com',
  apiVersion: env.ALI_ASR_API_VERSION || '2018-08-17',
  endpoint: env.ALI_ASR_ENDPOINT || `https://${env.ALI_ASR_DOMAIN || 'filetrans.cn-shanghai.aliyuncs.com'}`
});

/**
 * 提交识别任务
 * @returns {Promise<string>} TaskId
 */
const submitFiletransTask = async (client, { appKey, fileLink }) => {
  if (!appKey) {
    throw new Error('ALI_ASR_APP_KEY 未配置');
  }
  if (!fileLink) {
    throw new Error('file_link 不能为空');
  }
  const taskPayload = JSON.stringify({
    appkey: appKey,
    file_link: fileLink,
    version: '4.0',
    enable_words: false,
    enable_sample_rate_adaptive: true
  });
  const response = await client.request(
    'SubmitTask',
    {
      Task: taskPayload
    },
    { method: 'POST' }
  );
  if (response?.StatusText !== 'SUCCESS') {
    throw new Error(`SubmitTask 失败: ${response?.StatusText || 'UNKNOWN'} ${response?.StatusCode || ''}`);
  }
  if (!response.TaskId) {
    throw new Error('SubmitTask 未返回 TaskId');
  }
  return String(response.TaskId);
};

/**
 * 查询识别结果（单次）
 */
const getFiletransResult = async (client, taskId) => {
  return client.request('GetTaskResult', { TaskId: String(taskId) }, { method: 'GET' });
};

/**
 * 将阿里云 Result 规范为 joinAiResult 可用的 sentences
 */
const normalizeFiletransResult = result => {
  const raw = result?.Result || result || {};
  const sentencesSrc = Array.isArray(raw.Sentences) ? raw.Sentences : Array.isArray(raw) ? raw : [];
  const sentences = sentencesSrc
    .map(item => {
      if (typeof item === 'string') {
        return { message: item.trim() };
      }
      if (!item || typeof item !== 'object') {
        return null;
      }
      const message = String(item.Text || item.text || item.message || '').trim();
      if (!message) {
        return null;
      }
      return {
        message,
        beginTime: item.BeginTime ?? item.begin_time ?? null,
        endTime: item.EndTime ?? item.end_time ?? null,
        channelId: item.ChannelId ?? item.channel_id ?? null
      };
    })
    .filter(Boolean);
  const text = sentences.map(item => item.message).join('');
  return { sentences, text };
};

/**
 * 提交并轮询直到完成
 * @param {object} options.poll - { maxTimes, intervalMs, onPoll }
 */
const transcribeFileLink = async (config, fileLink, poll = {}) => {
  const client = createFiletransClient(config);
  const appKey = config.appKey;
  const taskId = await submitFiletransTask(client, { appKey, fileLink });
  const maxTimes = poll.maxTimes || 60;
  const intervalMs = poll.intervalMs || 10000;

  for (let i = 0; i < maxTimes; i++) {
    if (i > 0) {
      await new Promise(resolve => setTimeout(resolve, intervalMs));
    }
    const response = await getFiletransResult(client, taskId);
    const statusText = response?.StatusText;
    if (typeof poll.onPoll === 'function') {
      await poll.onPoll({ attempt: i + 1, statusText, taskId, response });
    }
    if (PENDING_STATUS.has(statusText)) {
      continue;
    }
    if (SUCCESS_STATUS.has(statusText)) {
      const normalized = normalizeFiletransResult(response);
      return Object.assign({}, normalized, { taskId, statusText });
    }
    throw new Error(`GetTaskResult 失败: ${statusText || 'UNKNOWN'} TaskId=${taskId}`);
  }
  throw new Error(`录音文件识别轮询超时 TaskId=${taskId}`);
};

module.exports = {
  createFiletransClient,
  getAsrConfigFromEnv,
  submitFiletransTask,
  getFiletransResult,
  normalizeFiletransResult,
  transcribeFileLink,
  SUCCESS_STATUS,
  PENDING_STATUS
};
