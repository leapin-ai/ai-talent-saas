const test = require('node:test');
const assert = require('node:assert/strict');

const loadService = (file, { setting, tenant } = {}) => {
  const services = {};
  if (setting) {
    services.talentReviewSetting = setting;
  }
  const fastify = {
    log: { warn: () => {}, error: () => {} },
    tenant: Object.assign({ services: {}, models: {} }, tenant),
    main: { services }
  };
  const plugin = require(file);
  return plugin(fastify, { name: 'main' }).then(() => services);
};

const withFetch = async (impl, fn) => {
  const original = globalThis.fetch;
  globalThis.fetch = impl;
  try {
    return await fn();
  } finally {
    globalThis.fetch = original;
  }
};

test('aiInterview.detail：未配置时不请求远程组件地址', async () => {
  let remoteCalls = 0;
  const services = await loadService('../../libs/services/aiInterview.js', {
    setting: {
      detail: async () => ({ url: '', appId: '', origin: '', hasSecretKey: false }),
      getRemote: async () => {
        remoteCalls += 1;
        return null;
      }
    }
  });
  const detail = await services.aiInterview.detail({ tenantId: 't1' });
  assert.deepEqual(detail, { cdnUrl: '', version: '', apiUrl: '', appId: '', hasSecretKey: false });
  assert.equal(remoteCalls, 0);
});

test('aiInterview.detail：已配置时返回 AI 面试设置的连接与站点远程组件', async () => {
  let origin;
  const services = await loadService('../../libs/services/aiInterview.js', {
    setting: {
      detail: async () => ({ url: 'https://gw.example.com/ai-interview/api/v1', appId: 'app', origin: 'https://ai.example.com', hasSecretKey: true }),
      getRemote: async args => {
        origin = args.origin;
        return { url: 'https://cdn.example.com/flowup', version: '1.2.3' };
      }
    }
  });
  const detail = await services.aiInterview.detail({ tenantId: 't1' });
  assert.equal(origin, 'https://ai.example.com');
  assert.deepEqual(detail, {
    cdnUrl: 'https://cdn.example.com/flowup',
    version: '1.2.3',
    apiUrl: 'https://gw.example.com/ai-interview/api/v1',
    appId: 'app',
    hasSecretKey: true
  });
  assert.equal(services.aiInterview.getAjaxBaseUrl(detail.apiUrl), 'https://gw.example.com/ai-interview');
});

test('aiInterview.getProjects：使用 AI 面试设置的凭据调用 open-api', async () => {
  const services = await loadService('../../libs/services/aiInterview.js', {
    setting: {
      getCredentials: async tenantId => {
        assert.equal(tenantId, 't1');
        return { apiUrl: 'https://gw.example.com/ai-interview/api/v1', appId: 'app', secretKey: 'secret' };
      }
    }
  });
  let requested;
  const result = await withFetch(
    async (url, init) => {
      requested = { url, headers: init.headers };
      return { ok: true, status: 200, text: async () => JSON.stringify({ code: 0, data: { pageData: [{ id: 'p1' }] } }) };
    },
    () => services.aiInterview.getProjects({ tenantId: 't1', filter: { scene: 'dataCollection' } })
  );
  assert.deepEqual(result, { pageData: [{ id: 'p1' }] });
  assert.match(requested.url, /^https:\/\/gw\.example\.com\/ai-interview\/api\/v1\/open-api\/project\/list\?/);
  assert.equal(requested.headers['x-openapi-appid'], 'app');
});

test('aiInterview.getProjects：未完成 AI 面试设置时抛出提示', async () => {
  const services = await loadService('../../libs/services/aiInterview.js', {
    setting: {
      getCredentials: async () => {
        throw new Error('请先在平台管理中完成 AI 面试设置');
      }
    }
  });
  await assert.rejects(() => services.aiInterview.getProjects({ tenantId: 't1' }), /AI 面试设置/);
});

test('talentReviewSetting.getRemote：配置缺少 url 时用站点根作为远程组件地址，缺少 version 才视为未就绪', async () => {
  const services = await loadService('../../libs/services/talentReviewSetting.js');
  const { getRemote } = services.talentReviewSetting;
  let body = { version: '0.1.270' };
  await withFetch(
    async () => ({ ok: true, json: async () => body }),
    async () => {
      assert.deepEqual(await getRemote({ origin: 'http://localhost:3040/' }), { url: 'http://localhost:3040', version: '0.1.270' });
      body = { url: 'https://cdn.example.com/flowup' };
      assert.equal(await getRemote({ origin: 'https://nover.example.com' }), null);
    }
  );
});

test('talentReviewSetting.getRemote：成功结果缓存，失败不缓存，缺少 origin 直接返回 null', async () => {
  const services = await loadService('../../libs/services/talentReviewSetting.js');
  const { getRemote } = services.talentReviewSetting;
  let calls = 0;
  let respond = () => ({ ok: true, json: async () => ({ url: 'https://cdn.example.com/flowup', version: '2.0.0' }) });
  const fetchImpl = async () => {
    calls += 1;
    return respond();
  };

  assert.equal(await getRemote({ origin: '' }), null);

  await withFetch(fetchImpl, async () => {
    const first = await getRemote({ origin: 'https://ai.example.com/' });
    const second = await getRemote({ origin: 'https://ai.example.com' });
    assert.deepEqual(first, { url: 'https://cdn.example.com/flowup', version: '2.0.0' });
    assert.deepEqual(second, first);
    assert.equal(calls, 1);

    respond = () => {
      throw new Error('network down');
    };
    assert.equal(await getRemote({ origin: 'https://other.example.com' }), null);
    respond = () => ({ ok: true, json: async () => ({ url: 'https://cdn.example.com/flowup', version: '3.0.0' }) });
    assert.deepEqual(await getRemote({ origin: 'https://other.example.com' }), { url: 'https://cdn.example.com/flowup', version: '3.0.0' });
    assert.equal(calls, 3);
  });
});
