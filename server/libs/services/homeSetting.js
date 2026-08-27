const fp = require('fastify-plugin');

const DEFAULT_HOME_PATH = '/';

const normalizeHomePath = value => {
  let path = value == null || value === '' ? DEFAULT_HOME_PATH : String(value).trim();
  if (!path.startsWith('/')) {
    path = `/${path}`;
  }
  if (path.length > 1 && path.endsWith('/')) {
    path = path.replace(/\/+$/, '');
  }
  return path || DEFAULT_HOME_PATH;
};

module.exports = fp(async (fastify, options) => {
  const tenantServices = fastify.tenant.services;
  const tenantModels = fastify.tenant.models;

  const getSettingRow = async tenantId => {
    await tenantServices.setting.detail({ tenantId });
    return tenantModels.setting.findOne({ where: { tenantId } });
  };

  const detail = async ({ tenantId }) => {
    const settingRow = await getSettingRow(tenantId);
    const homePath = normalizeHomePath(settingRow?.options?.homePath);
    return { homePath };
  };

  const save = async ({ tenantId, homePath }) => {
    const settingRow = await getSettingRow(tenantId);
    const nextHomePath = normalizeHomePath(homePath);
    const nextOptions = Object.assign({}, settingRow.options || {}, {
      homePath: nextHomePath
    });
    settingRow.set('options', nextOptions);
    settingRow.changed('options', true);
    await settingRow.save();
    return { homePath: nextHomePath };
  };

  Object.assign(fastify[options.name].services, {
    homeSetting: {
      detail,
      save,
      normalizeHomePath
    }
  });
});
