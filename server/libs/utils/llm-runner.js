/**
 * AI 调用工具：
 * 1) azure：直连 Azure OpenAI（对齐 telent-coach live-components-ai 的环境变量）
 * 2) runner：LLM Runner completion（对齐 coach i18n-translate；需已注册 config_id）
 *
 * person 步发展计划：基础一次 + short/mid/long 分次生成 items，再合并。
 */

const parseJsonLoose = value => {
  if (value == null) {
    return null;
  }
  if (typeof value === 'object') {
    return value;
  }
  if (typeof value !== 'string') {
    return null;
  }
  const text = value.trim();
  if (!text) {
    return null;
  }
  try {
    return JSON.parse(text);
  } catch (e) {
    const matched = text.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
    if (!matched) {
      return null;
    }
    try {
      return JSON.parse(matched[0]);
    } catch (err) {
      return null;
    }
  }
};

/** 兼容 data / data.Result / data.Report.Result / 纯 JSON 字符串 */
const unwrapCompletionData = data => {
  if (data == null) {
    return null;
  }
  const candidates = [data, data?.Result, data?.result, data?.Report?.Result, data?.output, data?.data];
  for (const item of candidates) {
    const parsed = parseJsonLoose(item);
    if (parsed && typeof parsed === 'object') {
      return parsed;
    }
  }
  return parseJsonLoose(data);
};

const requestCompletion = async (fastify, { configId, promptData }) => {
  const host = String(fastify.config.LLM_RUNNER_URL || 'https://llm-runner.staging.leapin-ai.com').replace(/\/$/, '');
  const token = fastify.config.LLM_RUNNER_TOKEN;
  if (!token) {
    throw new Error('未配置 LLM_RUNNER_TOKEN');
  }
  if (!configId) {
    throw new Error('未配置 LLM config_id');
  }

  const response = await fetch(`${host}/api/v1/completion`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Accept: 'application/json'
    },
    body: JSON.stringify({
      config_id: configId,
      prompt_data: promptData || {}
    })
  });

  let payload;
  try {
    payload = await response.json();
  } catch (e) {
    throw new Error(`LLM 接口返回非 JSON: HTTP ${response.status}`);
  }

  if (!response.ok || (payload.code != null && payload.code !== 0)) {
    const message = payload?.message || payload?.detail || payload?.error_msg || `LLM 调用失败 HTTP ${response.status}`;
    throw new Error(message);
  }

  return payload.data;
};

const requestAzureChatJson = async (fastify, { system, user, maxTokens }) => {
  const apiKey = String(fastify.config.AZURE_OPENAI_API_KEY || '').trim();
  const resourceName = String(fastify.config.AZURE_OPENAI_RESOURCE_NAME || '').trim();
  const deployment = String(fastify.config.AZURE_OPENAI_CHAT_DEPLOYMENT || '').trim();
  const apiVersion = String(fastify.config.AZURE_OPENAI_API_VERSION || '2024-08-01-preview').trim();

  if (!apiKey || !resourceName || !deployment) {
    throw new Error('未配置 Azure OpenAI（AZURE_OPENAI_API_KEY / RESOURCE_NAME / CHAT_DEPLOYMENT）');
  }
  if (/^https?:\/\//i.test(deployment)) {
    throw new Error('AZURE_OPENAI_CHAT_DEPLOYMENT 应为部署名（如 gpt-4o），不是 URL');
  }

  const url = `https://${resourceName}.openai.azure.com/openai/deployments/${encodeURIComponent(deployment)}/chat/completions?api-version=${encodeURIComponent(apiVersion)}`;
  const body = {
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user }
    ],
    temperature: 0.3,
    response_format: { type: 'json_object' },
    max_completion_tokens: Number(maxTokens) > 0 ? Number(maxTokens) : 12288
  };
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'api-key': apiKey
    },
    body: JSON.stringify(body)
  });

  let payload;
  try {
    payload = await response.json();
  } catch (e) {
    throw new Error(`Azure OpenAI 返回非 JSON: HTTP ${response.status}`);
  }

  if (!response.ok) {
    const message = payload?.error?.message || payload?.message || `Azure OpenAI 调用失败 HTTP ${response.status}`;
    throw new Error(message);
  }

  const content = payload?.choices?.[0]?.message?.content;
  const parsed = parseJsonLoose(content);
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Azure OpenAI 未返回有效 JSON');
  }
  return parsed;
};

const HORIZON_META_ZH = {
  short: { key: 'short', label: '短期', period: '0-3个月', tone: 'primary' },
  mid: { key: 'mid', label: '中期', period: '3-6个月', tone: 'cyan' },
  long: { key: 'long', label: '长期', period: '6-12个月', tone: 'rose' }
};

const HORIZON_META_EN = {
  short: { key: 'short', label: 'Short-term', period: '0-3 months', tone: 'primary' },
  mid: { key: 'mid', label: 'Mid-term', period: '3-6 months', tone: 'cyan' },
  long: { key: 'long', label: 'Long-term', period: '6-12 months', tone: 'rose' }
};

const normalizeOutputLanguage = language => (language === 'en-US' ? 'en-US' : 'zh-CN');

const getHorizonMeta = (horizonKey, language) => {
  const map = normalizeOutputLanguage(language) === 'en-US' ? HORIZON_META_EN : HORIZON_META_ZH;
  return map[horizonKey] || map.mid;
};

const languageInstruction = language => {
  if (normalizeOutputLanguage(language) === 'en-US') {
    return ' OUTPUT_LANGUAGE=en-US. All human-readable text fields (names of content, summaries, titles, descriptions, tags that are words, plan items, verdict, etc.) MUST be written in English. Do not use Chinese.';
  }
  return ' OUTPUT_LANGUAGE=zh-CN. 所有可读文案字段（摘要、标题、描述、计划条目、研判等）必须使用简体中文，不要使用英文句子。';
};

/**
 * 岗位分析 AI 填充基础调用。
 * person 步由上层再按 short/mid/long 分次补 items 后合并。
 */
const requestPositionAnalysisFill = async (fastify, { step, schema, context, draft, maxTokens, language }) => {
  const outputLanguage = normalizeOutputLanguage(language || context?.outputLanguage || context?.position?.language);
  const provider = String(fastify.config.LLM_POSITION_ANALYSIS_PROVIDER || 'azure')
    .trim()
    .toLowerCase();
  const instruction =
    '根据 CONTEXT 与 DRAFT 生成当前步骤可直接写入表单的 JSON。只返回 JSON 对象，不要 markdown。保留 DRAFT 中已有的 id/employeeId/employeeName。内容需与岗位详情/人才分析展示字段一致。' +
    languageInstruction(outputLanguage) +
    (step === 'position'
      ? ' skill 每项必须填写 change（must_build|ai_emerging|new|enhanced|stable|declining），按 importanceNow→importanceYear 与 origin 合理分配，禁止全部写成 stable；上升且 origin=new 优先 ai_emerging/new，下降优先 declining，关键缺口用 must_build。'
      : '') +
    (step === 'person'
      ? ' 生成每位员工的 readiness/summary/metrics/skills/priorityGaps，以及 developmentPlan.subtitle 与 horizons（恰好 short/mid/long，含 label/period/title/tone/target）。本轮可只写满短期 items；中长期 items 允许先空，后续会分次补全。horizons.label/period 也要使用 OUTPUT_LANGUAGE。'
      : '');

  const promptContext = Object.assign({}, context, { outputLanguage });

  if (provider === 'runner') {
    const configId = fastify.config.LLM_POSITION_ANALYSIS_CONFIG_ID || 'talent-saas-position-analysis-fill';
    const completionData = await requestCompletion(fastify, {
      configId,
      promptData: {
        STEP: step,
        INSTRUCTION: instruction,
        SCHEMA: JSON.stringify(schema),
        CONTEXT: JSON.stringify(promptContext),
        DRAFT: JSON.stringify(draft || {})
      }
    });
    const raw = unwrapCompletionData(completionData);
    if (!raw) {
      throw new Error('LLM Runner 未返回有效 JSON 数据');
    }
    return raw;
  }

  return requestAzureChatJson(fastify, {
    system: `${instruction}\nSTEP=${step}\nSCHEMA=${JSON.stringify(schema)}`,
    user: JSON.stringify({
      CONTEXT: promptContext,
      DRAFT: draft || {}
    }),
    maxTokens: Number(maxTokens) > 0 ? Number(maxTokens) : 8192
  });
};

/**
 * 单次只生成某一个阶段（short|mid|long）的 items。
 * 返回 { employees: [{ employeeId, horizon: { key, title?, target?, items } }] }
 */
const requestHorizonItemsFill = async (fastify, { horizonKey, context, employees, language }) => {
  const outputLanguage = normalizeOutputLanguage(language || context?.outputLanguage || context?.position?.language);
  const meta = getHorizonMeta(horizonKey, outputLanguage);
  const system =
    `只为发展计划的「${meta.label}」（key=${meta.key}，period=${meta.period}）生成 items。` +
    '返回 JSON：{ employees: [{ employeeId, horizon: { key, title, target, items: [{ tag, title, meta }] } }] }。' +
    '每位员工必须有 2～3 条 items；tag≤8 字符；title/meta 非空。不要返回其它阶段。不要 markdown。' +
    languageInstruction(outputLanguage);

  const user = JSON.stringify({
    HORIZON: meta,
    OUTPUT_LANGUAGE: outputLanguage,
    CONTEXT: {
      position: context?.position
        ? {
            id: context.position.id,
            name: context.position.name,
            skill: context.position.skill,
            language: context.position.language
          }
        : null
    },
    EMPLOYEES: (employees || []).map(item => ({
      employeeId: item.employeeId,
      employeeName: item.employeeName,
      summary: item.summary,
      priorityGaps: item.priorityGaps,
      developmentPlan: {
        subtitle: item.developmentPlan?.subtitle,
        horizon: (item.developmentPlan?.horizons || []).find(h => h && h.key === meta.key) || (item.developmentPlan?.horizons || [])[['short', 'mid', 'long'].indexOf(horizonKey)] || null
      }
    }))
  });

  const provider = String(fastify.config.LLM_POSITION_ANALYSIS_PROVIDER || 'azure')
    .trim()
    .toLowerCase();
  if (provider === 'runner') {
    const configId = fastify.config.LLM_POSITION_ANALYSIS_CONFIG_ID || 'talent-saas-position-analysis-fill';
    const completionData = await requestCompletion(fastify, {
      configId,
      promptData: {
        STEP: 'person-horizon',
        INSTRUCTION: system,
        CONTEXT: user,
        DRAFT: '{}'
      }
    });
    const raw = unwrapCompletionData(completionData);
    if (!raw) {
      throw new Error('LLM Runner 未返回阶段 items');
    }
    return raw;
  }

  return requestAzureChatJson(fastify, {
    system,
    user,
    maxTokens: 4096
  });
};

/** 将单次阶段 items 合并进 employees[].developmentPlan.horizons */
const mergeHorizonItemsIntoEmployees = (employees, horizonKey, chunk, language) => {
  const meta = getHorizonMeta(horizonKey, language);
  const list = Array.isArray(employees) ? employees : [];
  const chunkEmployees = Array.isArray(chunk?.employees) ? chunk.employees : [];
  const keyIndex = ['short', 'mid', 'long'].indexOf(horizonKey);

  return list.map((emp, index) => {
    const hit = chunkEmployees.find(item => String(item.employeeId) === String(emp.employeeId)) || chunkEmployees[index] || null;
    const horizonPatch = hit?.horizon && typeof hit.horizon === 'object' ? hit.horizon : null;
    const items = Array.isArray(horizonPatch?.items) ? horizonPatch.items : Array.isArray(hit?.items) ? hit.items : null;
    if (!items || items.length === 0) {
      return emp;
    }

    const plan = emp.developmentPlan && typeof emp.developmentPlan === 'object' ? emp.developmentPlan : { subtitle: '', horizons: [] };
    const horizons = Array.isArray(plan.horizons) ? plan.horizons.slice() : [];
    while (horizons.length < 3) {
      horizons.push(null);
    }
    let idx = horizons.findIndex(h => h && (h.key === meta.key || h.key === horizonKey));
    if (idx < 0) {
      idx = keyIndex >= 0 ? keyIndex : 0;
    }
    const current = horizons[idx] && typeof horizons[idx] === 'object' ? horizons[idx] : {};
    horizons[idx] = Object.assign({}, current, {
      key: current.key || meta.key || horizonKey,
      label: current.label || meta.label || '',
      period: current.period || meta.period || '',
      tone: current.tone || meta.tone,
      title: (typeof horizonPatch?.title === 'string' && horizonPatch.title) || current.title || '',
      target: (typeof horizonPatch?.target === 'string' && horizonPatch.target) || current.target || '',
      items
    });

    return Object.assign({}, emp, {
      developmentPlan: Object.assign({}, plan, { horizons })
    });
  });
};

/**
 * person 步：基础填充后，对 short/mid/long 并行（或按需）分次生成 items 并合并。
 * alwaysKeys 默认三阶段都补，已有 ≥2 条的阶段会跳过。
 */
const fillPersonDevelopmentPlanByHorizons = async (fastify, { context, employees, alwaysKeys = ['short', 'mid', 'long'], language }) => {
  const outputLanguage = normalizeOutputLanguage(language || context?.outputLanguage || context?.position?.language);
  let list = Array.isArray(employees) ? employees.slice() : [];
  if (list.length === 0) {
    return list;
  }

  const keys = alwaysKeys.filter(Boolean);
  const jobs = keys
    .map(key => {
      const need = list.filter(emp => {
        const horizons = emp?.developmentPlan?.horizons || [];
        const h = horizons.find(item => item?.key === key) || horizons[['short', 'mid', 'long'].indexOf(key)];
        return !h || !Array.isArray(h.items) || h.items.filter(row => row && (row.title || row.name)).length < 2;
      });
      if (need.length === 0) {
        return null;
      }
      return { key, need };
    })
    .filter(Boolean);

  if (jobs.length === 0) {
    return list;
  }

  const results = await Promise.all(
    jobs.map(async ({ key, need }) => {
      try {
        const data = await requestHorizonItemsFill(fastify, {
          horizonKey: key,
          context,
          employees: need,
          language: outputLanguage
        });
        return { key, data };
      } catch (e) {
        fastify.log?.warn?.({ err: e, key }, 'requestHorizonItemsFill failed');
        return { key, data: null };
      }
    })
  );

  results.forEach(({ key, data }) => {
    if (data) {
      list = mergeHorizonItemsIntoEmployees(list, key, data, outputLanguage);
    }
  });

  return list;
};

/** 单份 plan 补全：按缺失阶段分次调用后合并 */
const repairDevelopmentPlanItems = async (fastify, plan, contextHint) => {
  if (!plan || typeof plan !== 'object') {
    return null;
  }
  const stub = {
    employeeId: 'self',
    employeeName: contextHint?.employeeName || '',
    summary: contextHint?.summary || '',
    priorityGaps: contextHint?.priorityGaps || [],
    developmentPlan: plan
  };
  const [merged] = await fillPersonDevelopmentPlanByHorizons(fastify, {
    context: contextHint,
    employees: [stub],
    alwaysKeys: ['short', 'mid', 'long'],
    language: contextHint?.outputLanguage || contextHint?.position?.language
  });
  return merged?.developmentPlan || plan;
};

module.exports = {
  requestCompletion,
  requestAzureChatJson,
  requestPositionAnalysisFill,
  requestHorizonItemsFill,
  mergeHorizonItemsIntoEmployees,
  fillPersonDevelopmentPlanByHorizons,
  repairDevelopmentPlanItems,
  normalizeOutputLanguage,
  getHorizonMeta,
  HORIZON_META_ZH,
  HORIZON_META_EN,
  unwrapCompletionData,
  parseJsonLoose
};
