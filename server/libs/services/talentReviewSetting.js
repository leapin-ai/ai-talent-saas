const fp = require('fastify-plugin');
const { getApiBase, openApiRequest } = require('../utils/aiInterviewOpenApi');

const SECRET_KEY = 'TALENT_REVIEW_SECRET_KEY';

const trim = value => (value ? String(value).trim() : '');

const toPublic = raw => {
  const data = raw || {};
  return {
    url: trim(data.url),
    appId: trim(data.appId),
    host: trim(data.host),
    clientId: trim(data.clientId),
    clientName: trim(data.clientName),
    origin: trim(data.origin),
    hasSecretKey: !!data.hasSecretKey
  };
};

/** 远程组件与 remote-module-config.json 在去掉 /api/vN 的站点根下 */
const getSiteRoot = url => getApiBase(url).replace(/\/api\/v\d+$/i, '');

module.exports = fp(async (fastify, options) => {
  const tenantServices = fastify.tenant.services;
  const tenantModels = fastify.tenant.models;

  const getSettingRow = async tenantId => {
    await tenantServices.setting.detail({ tenantId });
    return tenantModels.setting.findOne({ where: { tenantId } });
  };

  const readSecret = settingRow => (settingRow.secrets || []).find(item => item.key === SECRET_KEY)?.value;

  const writeSecret = (settingRow, secretKey) => {
    const secrets = (Array.isArray(settingRow.secrets) ? settingRow.secrets : []).filter(item => item.key !== SECRET_KEY);
    if (secretKey) {
      secrets.push({ key: SECRET_KEY, value: secretKey });
    }
    settingRow.set('secrets', secrets);
    settingRow.changed('secrets', true);
  };

  const writeOptions = (settingRow, value) => {
    const nextOptions = Object.assign({}, settingRow.options || {}, { talentReview: value });
    settingRow.set('options', nextOptions);
    settingRow.changed('options', true);
  };

  const detail = async ({ tenantId }) => {
    const settingRow = await getSettingRow(tenantId);
    return toPublic(Object.assign({}, settingRow.options?.talentReview, { hasSecretKey: !!readSecret(settingRow) }));
  };

  const fetchClient = credentials => openApiRequest(credentials, 'client/detail');

  const save = async ({ tenantId, url, appId, secretKey }) => {
    const settingRow = await getSettingRow(tenantId);
    const nextUrl = trim(url);
    const nextAppId = trim(appId);
    const nextSecret = trim(secretKey) || readSecret(settingRow);
    if (!nextUrl || !nextAppId || !nextSecret) {
      throw new Error('人才盘点设置字段不完整');
    }
    // 保存前用新凭据调一次 open-api，凭据无效时直接报错
    const client = await fetchClient({ apiUrl: nextUrl, appId: nextAppId, secretKey: nextSecret });
    const value = {
      url: nextUrl,
      appId: nextAppId,
      host: new URL(nextUrl).host,
      clientId: client?.id ? String(client.id) : '',
      clientName: client?.name || '',
      origin: client?.origin || '',
      hasSecretKey: true
    };
    writeSecret(settingRow, nextSecret);
    writeOptions(settingRow, value);
    await settingRow.save();
    return toPublic(value);
  };

  const cancel = async ({ tenantId }) => {
    const settingRow = await getSettingRow(tenantId);
    writeSecret(settingRow, null);
    writeOptions(settingRow, null);
    await settingRow.save();
    return {};
  };

  const getCredentials = async tenantId => {
    const settingRow = await getSettingRow(tenantId);
    const raw = settingRow.options?.talentReview || {};
    const secretKey = readSecret(settingRow);
    if (!(raw.url && raw.appId && secretKey)) {
      throw new Error('请先在平台管理中完成人才盘点设置');
    }
    return { apiUrl: raw.url, appId: raw.appId, secretKey, origin: raw.origin || '' };
  };

  const getClient = async ({ tenantId }) => {
    const credentials = await getCredentials(tenantId);
    return fetchClient(credentials);
  };

  /** 租户端只需要知道是否已配置，以及远程组件所在站点根 */
  const status = async ({ tenantId }) => {
    const publicData = await detail({ tenantId });
    const configured = !!(publicData.url && publicData.appId && publicData.hasSecretKey);
    return {
      configured,
      clientName: publicData.clientName,
      origin: publicData.origin,
      siteRoot: configured ? getSiteRoot(publicData.url) : ''
    };
  };

  Object.assign(fastify[options.name].services, {
    talentReviewSetting: {
      detail,
      save,
      cancel,
      getClient,
      getCredentials,
      status
    }
  });
});
