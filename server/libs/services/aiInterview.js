const fp = require('fastify-plugin');

const SECRET_KEY = 'AI_INTERVIEW_SECRET_KEY';

const toPublic = ({ cdnUrl, apiUrl, appId, hasSecretKey }) => ({
  cdnUrl: cdnUrl ? String(cdnUrl).trim() : '',
  apiUrl: apiUrl ? String(apiUrl).trim() : '',
  appId: appId ? String(appId).trim() : '',
  hasSecretKey: !!hasSecretKey
});

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
    const nextOptions = Object.assign({}, settingRow.options || {}, {
      aiInterview: {
        cdnUrl: publicData.cdnUrl,
        apiUrl: publicData.apiUrl,
        appId: publicData.appId,
        hasSecretKey: publicData.hasSecretKey
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
      apiUrl: raw.apiUrl,
      appId: raw.appId,
      hasSecretKey: !!(legacySecret || existingSecret)
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
      apiUrl: raw.apiUrl,
      appId: raw.appId,
      hasSecretKey: !!(secretValue || raw.hasSecretKey)
    });
  };

  const save = async ({ tenantId, cdnUrl, apiUrl, appId, secretKey }) => {
    const settingRow = await getSettingRow(tenantId);
    await migrateLegacySecret(settingRow);
    await settingRow.reload();

    const existingSecret = (settingRow.secrets || []).find(item => item.key === SECRET_KEY)?.value;
    const nextSecret = secretKey ? String(secretKey).trim() : existingSecret;

    const publicData = toPublic({
      cdnUrl,
      apiUrl,
      appId,
      hasSecretKey: !!nextSecret
    });

    if (!publicData.cdnUrl || !publicData.apiUrl || !publicData.appId || !nextSecret) {
      throw new Error('AI面试设置字段不完整');
    }

    await upsertSecret({ secretKey: nextSecret, settingRow });
    writePublicOptions({ settingRow, publicData });
    await settingRow.save();

    return publicData;
  };

  Object.assign(fastify[options.name].services, {
    aiInterview: {
      detail,
      save,
      getSecretKey: async ({ tenantId }) => readSecretValue(tenantId)
    }
  });
});
