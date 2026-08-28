const fp = require('fastify-plugin');
const omit = require('lodash/omit');
const { requestPositionAnalysisFill, repairDevelopmentPlanItems } = require('../utils/llm-runner');

const ANALYSIS_TASK_TYPE = 'position-ai-analysis';
const ANALYSIS_PROGRESS_START = 18;
const AI_FILL_STEPS = ['org', 'position', 'person'];
const isAnalysisRunning = status => status === 'generating' || status === 'locked';

module.exports = fp(async (fastify, options) => {
  const { models, services } = fastify[options.name];
  const { Op } = fastify.sequelize.Sequelize;

  // 组织已删除/关闭时按「未设置部门」处理，不抛错
  const resolveTenantOrgId = async (authenticatePayload, tenantOrgId) => {
    if (tenantOrgId == null || tenantOrgId === '') {
      return null;
    }
    const orgEnums = await fastify.tenant.services.org.enums(authenticatePayload, {
      ids: [tenantOrgId]
    });
    if (!orgEnums.length) {
      return null;
    }
    return tenantOrgId;
  };

  const create = async (authenticatePayload, { name, language, locationType, tenantOrgId, ...data }) => {
    const { tenantId } = authenticatePayload;

    if (!name) {
      throw new Error('名称不能为空');
    }

    if (!language) {
      throw new Error('语言要求不能为空');
    }

    if (!locationType) {
      throw new Error('工作地点类型不能为空');
    }

    const resolvedTenantOrgId = await resolveTenantOrgId(authenticatePayload, tenantOrgId);
    if (!resolvedTenantOrgId) {
      throw new Error('组织部门不能为空');
    }

    if ((await models.position.count({ where: { name, tenantId } })) > 0) {
      throw new Error('名称不能重复');
    }

    return await models.position.create(
      Object.assign({}, data, {
        tenantId,
        tenantOrgId: resolvedTenantOrgId,
        name,
        language,
        locationType,
        status: data.status || 'draft',
        capacity: data.capacity || '',
        salary: data.salary || {},
        location: data.location || {},
        analysisStatus: 'idle',
        analysisProgress: 0,
        analysisTaskId: null
      })
    );
  };
  const detail = async (authenticatePayload, { id }) => {
    const { tenantId } = authenticatePayload;
    const position = await models.position.findByPk(id);
    if (!position) {
      throw new Error('未找到职位');
    }
    if (position.tenantId !== tenantId) {
      throw new Error('未找到职位');
    }

    const orgEnums = await fastify.tenant.services.org.enums(authenticatePayload, {
      ids: position.tenantOrgId ? [position.tenantOrgId] : []
    });
    // 关联组织已删：对外当作未设置部门
    if (position.tenantOrgId && !orgEnums.length) {
      position.setDataValue('tenantOrgId', null);
    }
    position.setDataValue('orgEnums', orgEnums);

    return position;
  };

  const save = async (authenticatePayload, { id, name, language, locationType, tenantOrgId, ...data }) => {
    const position = await detail(authenticatePayload, { id });
    const { tenantId } = authenticatePayload;

    let resolvedTenantOrgId;
    if (tenantOrgId !== undefined) {
      resolvedTenantOrgId = await resolveTenantOrgId(authenticatePayload, tenantOrgId);
      if (!resolvedTenantOrgId) {
        throw new Error('组织部门不能为空');
      }
    }

    if (
      (await models.position.count({
        where: {
          name,
          tenantId,
          id: { [Op.not]: position.id }
        }
      })) > 0
    ) {
      throw new Error('名称不能重复');
    }

    // 基础编辑表单不含 skill/verdict/分析态；禁止被请求体里的空值或脏字段覆盖
    const nextData = Object.assign(
      {},
      omit(data, ['tenantId', 'publishAt', 'orgEnums', 'analysisStatus', 'analysisProgress', 'analysisTaskId', 'id', 'createdAt', 'updatedAt', 'deletedAt']),
      name && { name },
      language && { language },
      locationType && { locationType },
      tenantOrgId !== undefined && { tenantOrgId: resolvedTenantOrgId }
    );
    if (Object.prototype.hasOwnProperty.call(nextData, 'skill')) {
      if (!Array.isArray(nextData.skill)) {
        delete nextData.skill;
      } else {
        const normalizedSkill = normalizePositionSkills(nextData.skill);
        const existingSkill = Array.isArray(position.skill) ? position.skill : [];
        // 基础编辑未带技能时常见空数组；有存量则跳过，避免把分析生成的 skill 盖掉
        if (normalizedSkill.length === 0 && existingSkill.length > 0) {
          delete nextData.skill;
        } else {
          nextData.skill = normalizedSkill;
          nextData.changeMagnitude = deriveChangeMagnitude(nextData.skill);
        }
      }
    } else if (nextData.changeMagnitude !== undefined) {
      nextData.changeMagnitude = normalizeChangeMagnitude(nextData.changeMagnitude);
    }
    if (Object.prototype.hasOwnProperty.call(nextData, 'verdict')) {
      const emptyVerdict = nextData.verdict == null || typeof nextData.verdict !== 'object' || Array.isArray(nextData.verdict) || Object.keys(nextData.verdict).length === 0;
      const existingVerdict = position.verdict && typeof position.verdict === 'object' && !Array.isArray(position.verdict) ? position.verdict : null;
      if (emptyVerdict && existingVerdict && Object.keys(existingVerdict).length > 0) {
        delete nextData.verdict;
      } else if (emptyVerdict) {
        delete nextData.verdict;
      } else {
        nextData.verdict = normalizePositionVerdict(nextData.verdict);
      }
    }
    await position.update(nextData);
    return position;
  };

  const remove = async (authenticatePayload, { id }) => {
    const position = await detail(authenticatePayload, { id });
    await position.destroy();
  };

  const setStatus = async (authenticatePayload, { id, status }) => {
    const position = await detail(authenticatePayload, { id });
    const validStatuses = ['draft', 'published', 'closed'];
    if (!validStatuses.includes(status)) {
      throw new Error('状态值无效');
    }

    if (status === 'published') {
      await position.update({ status, publishAt: new Date() });
    } else {
      await position.update({ status });
    }
    return position;
  };

  const list = async (authenticatePayload, { filter = {}, perPage = 20, currentPage = 1 }) => {
    const { tenantId } = authenticatePayload;
    const whereQuery = {};

    ['status', 'language', 'locationType', 'tenantOrgId'].forEach(name => {
      if (filter[name]) {
        whereQuery[name] = filter[name];
      }
    });

    const changeMagnitudeRaw = filter.changeMagnitude;
    const changeMagnitudePick = Array.isArray(changeMagnitudeRaw) ? changeMagnitudeRaw[0] : changeMagnitudeRaw;
    const changeMagnitudeValue = changeMagnitudePick && typeof changeMagnitudePick === 'object' ? changeMagnitudePick.value || changeMagnitudePick.id || null : changeMagnitudePick;
    if (['low', 'medium', 'high'].includes(changeMagnitudeValue)) {
      whereQuery.changeMagnitude = changeMagnitudeValue;
    }

    if (filter['ids'] && filter['ids'].length > 0) {
      whereQuery.id = {
        [Op.in]: filter['ids']
      };
    }

    if (filter['keyword']) {
      whereQuery[Op.or] = [
        {
          name: {
            [Op.like]: `%${filter['keyword']}%`
          }
        },
        {
          description: {
            [Op.like]: `%${filter['keyword']}%`
          }
        }
      ];
    }

    const { count, rows } = await models.position.findAndCountAll({
      where: Object.assign({}, whereQuery, {
        tenantId
      }),
      offset: perPage * (currentPage - 1),
      limit: perPage,
      order: [
        ['createdAt', 'DESC'],
        ['id', 'DESC']
      ]
    });

    const allOrgIds = [...new Set(rows.map(item => item.tenantOrgId).filter(id => id != null && id !== ''))];
    const orgEnums =
      allOrgIds.length > 0
        ? await fastify.tenant.services.org.enums(authenticatePayload, {
            ids: allOrgIds
          })
        : [];
    const validOrgIdSet = new Set(orgEnums.map(item => String(item.value)));

    const positionIds = rows.map(item => String(item.id));
    const employeeCountMap = new Map();
    if (positionIds.length > 0) {
      const sequelize = fastify.sequelize.instance;
      const [countRows] = await sequelize.query(
        `
        SELECT CASE
                 WHEN jsonb_typeof("options"->'position') = 'string' THEN "options"->>'position'
                 ELSE COALESCE("options"->'position'->>'id', '')
               END AS position_id,
               COUNT(*)::int AS employee_count
        FROM t_employee
        WHERE deleted_at IS NULL
          AND tenant_id = :tenantId
          AND CASE
                WHEN jsonb_typeof("options"->'position') = 'string' THEN "options"->>'position'
                ELSE COALESCE("options"->'position'->>'id', '')
              END IN (:positionIds)
        GROUP BY 1
        `,
        {
          replacements: {
            tenantId,
            positionIds
          }
        }
      );
      (countRows || []).forEach(row => {
        if (row.position_id) {
          employeeCountMap.set(String(row.position_id), Number(row.employee_count) || 0);
        }
      });
    }

    const pageData = rows.map(row => {
      const plain = row.toJSON ? row.toJSON() : row;
      const tenantOrgId = plain.tenantOrgId != null && plain.tenantOrgId !== '' && validOrgIdSet.has(String(plain.tenantOrgId)) ? plain.tenantOrgId : null;
      return Object.assign({}, plain, {
        tenantOrgId,
        employeeCount: employeeCountMap.get(String(plain.id)) || 0,
        changeMagnitude: CHANGE_MAGNITUDE_VALUES.includes(plain.changeMagnitude) ? plain.changeMagnitude : deriveChangeMagnitude(plain.skill)
      });
    });

    return {
      orgEnums,
      pageData,
      totalCount: count
    };
  };

  const isPositionBigintId = value => /^\d+$/.test(value);

  const enums = async (authenticatePayload, { ids, names }) => {
    const { tenantId } = authenticatePayload;
    const idList = [];
    const nameList = (names || []).map(item => (item == null || item === '' ? null : String(typeof item === 'object' ? item.name || item.description : item))).filter(Boolean);
    (ids || [])
      .map(item => (item == null || item === '' ? null : String(typeof item === 'object' ? item.id || item.value : item)))
      .filter(Boolean)
      .forEach(value => {
        if (isPositionBigintId(value)) {
          idList.push(value);
        } else {
          // options.position / intentionPosition 可能存岗位名，不能放进 bigint id IN
          nameList.push(value);
        }
      });
    const uniqueIds = [...new Set(idList)];
    const uniqueNames = [...new Set(nameList)];
    if (!uniqueIds.length && !uniqueNames.length) {
      return [];
    }
    const orConditions = [];
    if (uniqueIds.length) {
      orConditions.push({ id: { [Op.in]: uniqueIds } });
    }
    if (uniqueNames.length) {
      orConditions.push({ name: { [Op.in]: uniqueNames } });
    }
    const whereQuery = {
      tenantId,
      ...(orConditions.length === 1 ? orConditions[0] : { [Op.or]: orConditions })
    };
    const positions = await models.position.findAll({
      where: whereQuery
    });

    return positions.map(item => {
      return {
        value: item.id != null ? String(item.id) : item.id,
        description: item.name,
        tenantOrgId: item.tenantOrgId || null
      };
    });
  };

  const normalizeReadiness = value => {
    if (value == null || value === '') {
      return null;
    }
    const num = Number(value);
    if (!Number.isFinite(num)) {
      return null;
    }
    return Math.min(100, Math.max(0, Math.round(num)));
  };

  const normalizeSkillRows = skills => {
    if (!Array.isArray(skills)) {
      return [];
    }
    const allowedStatus = new Set(['critical', 'gap', 'onTarget', 'above']);
    return skills
      .map(item => {
        if (!item || typeof item !== 'object') {
          return null;
        }
        const name = typeof item.name === 'string' ? item.name.trim() : '';
        if (!name) {
          return null;
        }
        const current = Number(item.current);
        const required = Number(item.required);
        const status = typeof item.status === 'string' && allowedStatus.has(item.status) ? item.status : undefined;
        const evidence = typeof item.evidence === 'string' ? item.evidence.trim().slice(0, 100) : '';
        return {
          id: typeof item.id === 'string' && item.id ? item.id : undefined,
          name: name.slice(0, 200),
          current: Number.isFinite(current) ? Math.min(5, Math.max(0, Math.round(current))) : 0,
          required: Number.isFinite(required) ? Math.min(5, Math.max(0, Math.round(required))) : 0,
          ...(status ? { status } : {}),
          ...(evidence ? { evidence } : {})
        };
      })
      .filter(Boolean);
  };

  const normalizePriorityGaps = gaps => {
    if (!Array.isArray(gaps)) {
      return [];
    }
    return gaps
      .map((item, index) => {
        if (!item || typeof item !== 'object') {
          return null;
        }
        const title = typeof item.title === 'string' ? item.title.trim() : '';
        if (!title) {
          return null;
        }
        const rank = Number(item.rank);
        const current = Number(item.current);
        const required = Number(item.required);
        return {
          rank: Number.isFinite(rank) ? Math.round(rank) : index + 1,
          title: title.slice(0, 200),
          description: typeof item.description === 'string' ? item.description : '',
          ...(Number.isFinite(current) ? { current: Math.min(5, Math.max(0, Math.round(current))) } : {}),
          ...(Number.isFinite(required) ? { required: Math.min(5, Math.max(0, Math.round(required))) } : {})
        };
      })
      .filter(Boolean);
  };

  const normalizeDevelopmentPlan = plan => {
    if (!plan || typeof plan !== 'object' || Array.isArray(plan)) {
      return null;
    }
    const horizons = Array.isArray(plan.horizons) ? plan.horizons : [];
    const normalizedHorizons = horizons
      .map((item, index) => {
        if (!item || typeof item !== 'object') {
          return null;
        }
        const rawItems = Array.isArray(item.items) ? item.items : Array.isArray(item.actions) ? item.actions : Array.isArray(item.tasks) ? item.tasks : [];
        const items = rawItems
          .map(row => {
            if (!row || typeof row !== 'object') {
              return null;
            }
            const titleRaw = (typeof row.title === 'string' && row.title) || (typeof row.name === 'string' && row.name) || (typeof row.content === 'string' && row.content) || (typeof row.text === 'string' && row.text) || '';
            const title = titleRaw.trim();
            if (!title) {
              return null;
            }
            const tagRaw = typeof row.tag === 'string' ? row.tag : typeof row.label === 'string' ? row.label : '';
            const metaRaw = typeof row.meta === 'string' ? row.meta : typeof row.description === 'string' ? row.description : typeof row.detail === 'string' ? row.detail : '';
            return {
              tag: tagRaw.trim().slice(0, 8),
              title: title.slice(0, 200),
              meta: metaRaw.trim().slice(0, 120)
            };
          })
          .filter(Boolean);
        return {
          key: typeof item.key === 'string' ? item.key : String(index + 1),
          label: typeof item.label === 'string' ? item.label.slice(0, 40) : '',
          period: typeof item.period === 'string' ? item.period.slice(0, 40) : '',
          title: typeof item.title === 'string' ? item.title.slice(0, 80) : '',
          tone: typeof item.tone === 'string' ? item.tone.slice(0, 20) : undefined,
          items,
          target: typeof item.target === 'string' ? item.target.slice(0, 120) : ''
        };
      })
      .filter(Boolean);

    if (normalizedHorizons.length === 0) {
      return null;
    }

    return {
      subtitle: typeof plan.subtitle === 'string' ? plan.subtitle.slice(0, 80) : '',
      horizons: normalizedHorizons
    };
  };

  const fillEmptyHorizonItems = plan => {
    const normalized = normalizeDevelopmentPlan(plan);
    if (!normalized) {
      return null;
    }
    const horizons = normalized.horizons.map(horizon => {
      if (Array.isArray(horizon.items) && horizon.items.length >= 2) {
        return horizon;
      }
      const focus = horizon.title || horizon.label || '阶段目标';
      return Object.assign({}, horizon, {
        items: [
          {
            tag: 'focus',
            title: `落实：${focus}`.slice(0, 200),
            meta: (horizon.target || '对照阶段目标推进并复盘').slice(0, 120)
          },
          {
            tag: 'practice',
            title: `专项练习：${focus}`.slice(0, 200),
            meta: '通过实际任务练习并记录卡点与改进'.slice(0, 120)
          }
        ]
      });
    });
    return Object.assign({}, normalized, { horizons });
  };

  const ensureDevelopmentPlan = async (plan, contextHint) => {
    let normalized = normalizeDevelopmentPlan(plan);
    if (!normalized) {
      return null;
    }
    const incomplete = normalized.horizons.some(h => !h.items || h.items.length < 2);
    if (incomplete) {
      const repaired = await repairDevelopmentPlanItems(fastify, normalized, contextHint);
      normalized = normalizeDevelopmentPlan(repaired) || normalized;
    }
    return fillEmptyHorizonItems(normalized);
  };

  const normalizeMetrics = metrics => {
    if (!metrics || typeof metrics !== 'object') {
      return {};
    }
    const criticalGaps = Number(metrics.criticalGaps);
    const atOrAbove = Number(metrics.atOrAbove);
    const monthsToClose = Number(metrics.monthsToClose);
    return {
      criticalGaps: Number.isFinite(criticalGaps) ? Math.max(0, Math.round(criticalGaps)) : 0,
      atOrAbove: Number.isFinite(atOrAbove) ? Math.max(0, Math.round(atOrAbove)) : 0,
      monthsToClose: Number.isFinite(monthsToClose) ? Math.max(0, Math.round(monthsToClose)) : null
    };
  };

  const normalizePositionSkillItem = raw => {
    if (!raw || typeof raw !== 'object') {
      return null;
    }
    const originValues = ['existing', 'new'];
    const changeValues = ['must_build', 'ai_emerging', 'new', 'enhanced', 'stable', 'declining'];
    const levelValues = ['high', 'medium', 'low'];
    const name = typeof raw.name === 'string' ? raw.name.trim() : '';
    if (!name) {
      return null;
    }
    const clampImportance = value => {
      const num = Number(value);
      if (!Number.isFinite(num)) {
        return 1;
      }
      return Math.min(5, Math.max(1, Math.round(num)));
    };
    const normalizeContentItem = raw => {
      if (!raw || typeof raw !== 'object') {
        return null;
      }
      const title = typeof raw.title === 'string' ? raw.title.trim() : '';
      const description =
        typeof raw.description === 'string' ? raw.description.trim() : typeof raw.desc === 'string' ? raw.desc.trim() : typeof raw.text === 'string' ? raw.text.trim() : typeof raw.content === 'string' ? raw.content.trim() : '';
      const source = typeof raw.source === 'string' ? raw.source.trim() : '';
      if (!title && !description && !source) {
        return null;
      }
      return {
        title: title.slice(0, 200),
        description: description.slice(0, 2000),
        source: source.slice(0, 200)
      };
    };
    const normalizeContentItems = value => {
      if (typeof value === 'string') {
        const text = value.trim();
        return text ? [{ title: '', description: text.slice(0, 2000), source: '' }] : [];
      }
      if (Array.isArray(value)) {
        return value.map(normalizeContentItem).filter(Boolean);
      }
      if (value && typeof value === 'object') {
        if (Array.isArray(value.items)) {
          return normalizeContentItems(value.items);
        }
        if (typeof value.text === 'string' || typeof value.desc === 'string' || typeof value.content === 'string' || typeof value.source === 'string' || typeof value.title === 'string' || typeof value.description === 'string') {
          const legacy = normalizeContentItem(value);
          return legacy ? [legacy] : [];
        }
      }
      return [];
    };
    const normalizeLegacyContentBlock = (value, defaultTitle) => {
      const items = normalizeContentItems(value);
      if (!items.length && typeof value === 'string' && value.trim()) {
        return [{ title: defaultTitle, description: value.trim().slice(0, 2000), source: '' }];
      }
      return items.map(item => ({
        ...item,
        title: item.title || defaultTitle
      }));
    };
    const normalizeSkillContentItems = raw => {
      if (!raw || typeof raw !== 'object') {
        return [];
      }
      const merged = [...normalizeContentItems(raw.contentItems), ...normalizeLegacyContentBlock(raw.jd, '职位描述 / 胜任力'), ...normalizeLegacyContentBlock(raw.shockReport, '冲击报告')];
      const seen = new Set();
      return merged.filter(item => {
        const key = `${item.title}\0${item.description}\0${item.source}`;
        if (seen.has(key)) {
          return false;
        }
        seen.add(key);
        return true;
      });
    };
    const changeFromRaw = changeValues.includes(raw.change) ? raw.change : null;
    const importanceNow = clampImportance(raw.importanceNow);
    const importanceYear = clampImportance(raw.importanceYear);
    const origin = originValues.includes(raw.origin) ? raw.origin : 'existing';
    let change = changeFromRaw;
    if (!change) {
      if (importanceYear <= importanceNow - 1) {
        change = 'declining';
      } else if (importanceYear >= importanceNow + 2 && origin === 'new') {
        change = 'ai_emerging';
      } else if (importanceYear >= importanceNow + 1) {
        change = origin === 'new' ? 'new' : 'enhanced';
      } else {
        change = 'stable';
      }
    }
    return {
      id: typeof raw.id === 'string' && raw.id ? raw.id : `skill-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
      name: name.slice(0, 200),
      origin,
      importanceNow,
      importanceYear,
      change,
      aiExposure: levelValues.includes(raw.aiExposure) ? raw.aiExposure : 'medium',
      confidence: levelValues.includes(raw.confidence) ? raw.confidence : 'medium',
      contentItems: normalizeSkillContentItems(raw)
    };
  };

  const normalizePositionSkills = skill => {
    if (!Array.isArray(skill)) {
      return [];
    }
    return skill.map(normalizePositionSkillItem).filter(Boolean);
  };

  const CHANGE_MAGNITUDE_VALUES = ['low', 'medium', 'high'];

  const normalizeChangeMagnitude = value => (CHANGE_MAGNITUDE_VALUES.includes(value) ? value : 'low');

  /** 由岗位 skill[].change 汇总出列表用的 Low/Medium/High */
  const deriveChangeMagnitude = skill => {
    const list = normalizePositionSkills(skill);
    if (list.length === 0) {
      return 'low';
    }
    let mustBuild = 0;
    let emergingOrNew = 0;
    let enhanced = 0;
    list.forEach(item => {
      if (item.change === 'must_build') {
        mustBuild += 1;
      } else if (item.change === 'ai_emerging' || item.change === 'new') {
        emergingOrNew += 1;
      } else if (item.change === 'enhanced') {
        enhanced += 1;
      }
    });
    if (mustBuild >= 1 || emergingOrNew >= 2) {
      return 'high';
    }
    if (emergingOrNew >= 1 || enhanced >= 1) {
      return 'medium';
    }
    return 'low';
  };

  const normalizePositionVerdict = raw => {
    if (!raw || typeof raw !== 'object') {
      return { summary: '', today: '', future: '', futureLabel: '' };
    }
    return {
      summary: typeof raw.summary === 'string' ? raw.summary : '',
      today: typeof raw.today === 'string' ? raw.today : '',
      future: typeof raw.future === 'string' ? raw.future : '',
      futureLabel: typeof raw.futureLabel === 'string' ? raw.futureLabel : ''
    };
  };

  const skillAnalysisDetail = async (authenticatePayload, { positionId, employeeId }) => {
    const { tenantId } = authenticatePayload;
    if (!positionId || !employeeId) {
      throw new Error('岗位与员工不能为空');
    }

    const position = await detail(authenticatePayload, { id: positionId });
    const employee = await models.employee.findByPk(employeeId);
    if (!employee || employee.tenantId !== tenantId) {
      throw new Error('未找到员工');
    }

    const analysis = await models.positionEmployeeSkillAnalysis.findOne({
      where: {
        tenantId,
        positionId: String(positionId),
        employeeId: String(employeeId)
      }
    });

    return {
      position: {
        id: position.id,
        name: position.name
      },
      employee: {
        id: employee.id,
        name: employee.name || employee.nameEn || '',
        nameEn: employee.nameEn || '',
        avatar: employee.avatar || null
      },
      analysis: analysis
        ? {
            id: analysis.id,
            readiness: analysis.readiness,
            summary: analysis.summary || '',
            metrics: analysis.metrics || {},
            skills: analysis.skills || [],
            priorityGaps: analysis.priorityGaps || [],
            developmentPlan: analysis.developmentPlan || null
          }
        : null
    };
  };

  const skillAnalysisSave = async (authenticatePayload, { positionId, employeeId, readiness, summary, metrics, skills, priorityGaps, developmentPlan }) => {
    const { tenantId } = authenticatePayload;
    if (!positionId || !employeeId) {
      throw new Error('岗位与员工不能为空');
    }

    await detail(authenticatePayload, { id: positionId });
    const employee = await models.employee.findByPk(employeeId);
    if (!employee || employee.tenantId !== tenantId) {
      throw new Error('未找到员工');
    }

    const payload = {
      readiness: normalizeReadiness(readiness),
      summary: typeof summary === 'string' ? summary : '',
      metrics: normalizeMetrics(metrics),
      skills: normalizeSkillRows(skills),
      priorityGaps: normalizePriorityGaps(priorityGaps),
      developmentPlan: await ensureDevelopmentPlan(developmentPlan)
    };

    let analysis = await models.positionEmployeeSkillAnalysis.findOne({
      where: {
        tenantId,
        positionId: String(positionId),
        employeeId: String(employeeId)
      }
    });

    if (analysis) {
      await analysis.update(payload);
    } else {
      analysis = await models.positionEmployeeSkillAnalysis.create({
        tenantId,
        positionId: String(positionId),
        employeeId: String(employeeId),
        ...payload
      });
    }

    return {
      id: analysis.id,
      readiness: analysis.readiness,
      summary: analysis.summary || '',
      metrics: analysis.metrics || {},
      skills: analysis.skills || [],
      priorityGaps: analysis.priorityGaps || [],
      developmentPlan: analysis.developmentPlan || null
    };
  };

  const listRelatedEmployees = async (authenticatePayload, positionId) => {
    const result = await services.employee.list(authenticatePayload, {
      positionId: String(positionId),
      perPage: 200,
      currentPage: 1,
      filter: { withTalentAnalysis: true }
    });
    return result?.pageData || [];
  };

  const ensureAnalysisTask = async (authenticatePayload, position) => {
    if (position.analysisTaskId) {
      try {
        const existing = await fastify.task.services.detail({ id: position.analysisTaskId });
        if (existing && ['pending', 'running', 'waiting'].includes(existing.status)) {
          return existing;
        }
      } catch (e) {
        // 任务不存在则重建
      }
    }

    const orgEnums = position.getDataValue?.('orgEnums') || [];
    const department = orgEnums.find(item => String(item.value) === String(position.tenantOrgId))?.description || '';
    const employees = await listRelatedEmployees(authenticatePayload, position.id);
    const analyses = await models.positionEmployeeSkillAnalysis.findAll({
      where: {
        tenantId: position.tenantId,
        positionId: String(position.id)
      }
    });
    const analysisMap = new Map(analyses.map(item => [String(item.employeeId), item]));

    const skillAnalysis = {
      org: {
        tenantOrgId: position.tenantOrgId || null,
        department
      },
      position: {
        id: position.id,
        name: position.name || '',
        description: position.description || '',
        requirement: position.requirement || '',
        developmentGoal: position.developmentGoal || '',
        skill: Array.isArray(position.skill) ? position.skill : [],
        verdict: position.verdict && typeof position.verdict === 'object' ? position.verdict : {},
        changeMagnitude: position.changeMagnitude || null,
        language: position.language || null
      },
      employees: employees.map(item => {
        const analysis = analysisMap.get(String(item.id));
        return {
          id: item.id,
          name: item.name || item.nameEn || '',
          nameEn: item.nameEn || '',
          avatar: item.avatar || null,
          analysis: analysis
            ? {
                readiness: analysis.readiness,
                summary: analysis.summary || '',
                metrics: analysis.metrics || {},
                skills: analysis.skills || [],
                priorityGaps: analysis.priorityGaps || [],
                developmentPlan: analysis.developmentPlan || null
              }
            : null
        };
      })
    };

    const task = await fastify.task.services.create({
      type: ANALYSIS_TASK_TYPE,
      targetId: String(position.id),
      targetType: 'position',
      runnerType: 'manual',
      input: {
        name: position.name ? `AI岗位分析：${position.name}` : `AI岗位分析：${position.id}`,
        positionId: position.id,
        tenantId: position.tenantId,
        tenantOrgId: position.tenantOrgId || null,
        department,
        employeeIds: employees.map(item => String(item.id)),
        employees: employees.map(item => ({
          id: item.id,
          name: item.name || item.nameEn || '',
          nameEn: item.nameEn || '',
          avatar: item.avatar || null
        })),
        skillAnalysis,
        // 取消任务时用于恢复开跑前的分析状态
        analysisStateBefore: {
          analysisStatus: position.analysisStatus || 'idle',
          analysisProgress: Number.isFinite(Number(position.analysisProgress)) ? Number(position.analysisProgress) : 0,
          analysisTaskId: position.analysisTaskId || null
        }
      }
    });

    await position.update({
      analysisTaskId: task.id,
      analysisStatus: 'generating',
      analysisProgress: ANALYSIS_PROGRESS_START
    });
    return task;
  };

  const startAnalysis = async (authenticatePayload, { id }) => {
    const position = await detail(authenticatePayload, { id });
    if (isAnalysisRunning(position.analysisStatus) && position.analysisTaskId) {
      try {
        const existing = await fastify.task.services.detail({ id: position.analysisTaskId });
        if (existing && ['pending', 'running', 'waiting'].includes(existing.status)) {
          return {
            position,
            task: existing
          };
        }
      } catch (e) {
        // fallthrough recreate
      }
    }

    const task = await ensureAnalysisTask(authenticatePayload, position);
    await position.reload();
    return { position, task };
  };

  const lockAnalysis = async (authenticatePayload, { id }) => {
    const position = await detail(authenticatePayload, { id });
    if (position.analysisStatus === 'locked' || position.analysisStatus === 'completed') {
      return position;
    }
    if (position.analysisStatus !== 'generating') {
      throw new Error('当前状态无法锁定分析卡片');
    }
    await position.update({
      analysisStatus: 'locked',
      analysisProgress: 100
    });
    return position;
  };

  const getAnalysisTaskContext = async (userInfo, { taskId }) => {
    if (!taskId) {
      throw new Error('任务ID不能为空');
    }
    const task = await fastify.task.services.detail({ id: taskId });
    if (!task) {
      throw new Error('任务不存在');
    }
    if (task.type !== ANALYSIS_TASK_TYPE) {
      throw new Error('任务类型不正确');
    }

    const tenantId = task.input?.tenantId;
    const positionId = task.input?.positionId || task.targetId;
    if (!tenantId || !positionId) {
      throw new Error('任务缺少岗位信息');
    }

    const auth = { tenantId };
    const position = await detail(auth, { id: positionId });
    const employees = await listRelatedEmployees(auth, positionId);
    const analyses = await models.positionEmployeeSkillAnalysis.findAll({
      where: {
        tenantId,
        positionId: String(positionId)
      }
    });
    const analysisMap = new Map(analyses.map(item => [String(item.employeeId), item]));

    let company = null;
    try {
      const companyRow = await fastify.tenant.services.company.detail({ tenantId });
      if (companyRow) {
        company = {
          id: companyRow.id,
          name: companyRow.name || '',
          fullName: companyRow.fullName || '',
          logo: companyRow.logo || null,
          industry: companyRow.industry || '',
          scale: companyRow.scale || '',
          address: companyRow.address || '',
          phone: companyRow.phone || '',
          email: companyRow.email || '',
          website: companyRow.website || '',
          foundedDate: companyRow.foundedDate || null,
          description: companyRow.description || '',
          companyTags: companyRow.companyTags || []
        };
      }
    } catch (e) {
      company = null;
    }

    const inputSkillAnalysis = task.input?.skillAnalysis && typeof task.input.skillAnalysis === 'object' ? task.input.skillAnalysis : null;
    let previousOutput = null;
    if (task.status === 'success') {
      previousOutput = task.output || null;
    } else if (!inputSkillAnalysis?.position) {
      try {
        previousOutput = await fastify.task.models.task.findOne({
          where: {
            type: ANALYSIS_TASK_TYPE,
            targetId: String(positionId),
            targetType: 'position',
            status: 'success',
            id: { [Op.ne]: task.id }
          },
          order: [['completedAt', 'DESC']]
        });
        previousOutput = previousOutput?.output || null;
      } catch (e) {
        previousOutput = null;
      }
    }

    const snapshotPos =
      (inputSkillAnalysis?.position && typeof inputSkillAnalysis.position === 'object' && inputSkillAnalysis.position) || (previousOutput?.position && typeof previousOutput.position === 'object' && previousOutput.position) || null;
    const snapshotOrg = (inputSkillAnalysis?.org && typeof inputSkillAnalysis.org === 'object' && inputSkillAnalysis.org) || (previousOutput?.org && typeof previousOutput.org === 'object' && previousOutput.org) || null;
    const snapshotEmployees = Array.isArray(inputSkillAnalysis?.employees) ? inputSkillAnalysis.employees : Array.isArray(previousOutput?.employees) ? previousOutput.employees : [];
    const prevEmployeeMap = new Map(snapshotEmployees.map(item => [String(item.employeeId || item.id), item.analysis || item]));

    const positionSkill = Array.isArray(position.skill) && position.skill.length ? position.skill : snapshotPos?.skill || [];
    const positionVerdict = position.verdict && typeof position.verdict === 'object' && Object.keys(position.verdict).length > 0 ? position.verdict : snapshotPos?.verdict || {};
    const positionDescription = position.description || snapshotPos?.description || '';
    const positionRequirement = position.requirement || snapshotPos?.requirement || '';
    const positionDevelopmentGoal = position.developmentGoal || snapshotPos?.developmentGoal || '';
    const positionTenantOrgId = position.tenantOrgId != null ? position.tenantOrgId : (snapshotOrg?.tenantOrgId ?? null);

    return {
      task: {
        id: task.id,
        type: task.type,
        status: task.status,
        input: task.input,
        output: task.output || null
      },
      previousSubmit:
        inputSkillAnalysis || previousOutput
          ? {
              org: snapshotOrg,
              position: snapshotPos,
              employees: snapshotEmployees
            }
          : null,
      company,
      position: {
        id: position.id,
        name: position.name,
        description: positionDescription,
        requirement: positionRequirement,
        developmentGoal: positionDevelopmentGoal,
        tenantOrgId: positionTenantOrgId,
        language: position.language,
        locationType: position.locationType || null,
        location: position.location || {},
        capacity: position.capacity || '',
        salary: position.salary || {},
        status: position.status || null,
        changeMagnitude: position.changeMagnitude || prevPos?.changeMagnitude || null,
        skill: positionSkill,
        verdict: positionVerdict,
        analysisStatus: position.analysisStatus,
        analysisProgress: position.analysisProgress,
        orgEnums: position.getDataValue('orgEnums') || []
      },
      employees: employees.map(item => {
        const analysis = analysisMap.get(String(item.id));
        const prevAnalysis = prevEmployeeMap.get(String(item.id));
        const resolvedAnalysis = analysis
          ? {
              readiness: analysis.readiness,
              summary: analysis.summary || '',
              metrics: analysis.metrics || {},
              skills: analysis.skills || [],
              priorityGaps: analysis.priorityGaps || [],
              developmentPlan: analysis.developmentPlan || null
            }
          : prevAnalysis && typeof prevAnalysis === 'object'
            ? {
                readiness: prevAnalysis.readiness,
                summary: prevAnalysis.summary || '',
                metrics: prevAnalysis.metrics || {},
                skills: prevAnalysis.skills || [],
                priorityGaps: prevAnalysis.priorityGaps || [],
                developmentPlan: prevAnalysis.developmentPlan || null
              }
            : null;
        return {
          id: item.id,
          name: item.name || item.nameEn || '',
          nameEn: item.nameEn || '',
          avatar: item.avatar || null,
          gender: item.gender || null,
          email: item.email || '',
          personalEmail: item.personalEmail || '',
          phone: item.phone || '',
          city: item.city || '',
          address: item.address || '',
          status: item.status || null,
          hireDate: item.hireDate || null,
          tenantOrgIds: item.tenantOrgIds || [],
          analysis: resolvedAnalysis
        };
      })
    };
  };

  const completeAnalysis = async (userInfo, { taskId, org, position: positionPayload, employees: employeePayloads }) => {
    if (!taskId) {
      throw new Error('任务ID不能为空');
    }
    const task = await fastify.task.services.detail({ id: taskId });
    if (!task) {
      throw new Error('任务不存在');
    }
    if (task.type !== ANALYSIS_TASK_TYPE) {
      throw new Error('任务类型不正确');
    }
    if (task.status !== 'pending') {
      throw new Error('任务已处理，请勿重复完成');
    }

    const tenantId = task.input?.tenantId;
    const positionId = task.input?.positionId || task.targetId;
    const auth = { tenantId };
    const position = await detail(auth, { id: positionId });

    const orgPart = org && typeof org === 'object' ? org : {};
    const posPart = positionPayload && typeof positionPayload === 'object' ? positionPayload : {};
    const employeeList = Array.isArray(employeePayloads) ? employeePayloads : [];

    const updateFields = {};
    if (orgPart.tenantOrgId !== undefined) {
      updateFields.tenantOrgId = await resolveTenantOrgId(auth, orgPart.tenantOrgId);
    }
    if (posPart.description !== undefined) {
      updateFields.description = posPart.description;
    }
    if (posPart.requirement !== undefined) {
      updateFields.requirement = posPart.requirement;
    }
    if (posPart.developmentGoal !== undefined) {
      updateFields.developmentGoal = posPart.developmentGoal;
    }
    if (posPart.skill !== undefined) {
      updateFields.skill = normalizePositionSkills(posPart.skill);
      updateFields.changeMagnitude = deriveChangeMagnitude(updateFields.skill);
    } else if (posPart.changeMagnitude !== undefined) {
      updateFields.changeMagnitude = normalizeChangeMagnitude(posPart.changeMagnitude);
    } else if (Array.isArray(position.skill) && position.skill.length) {
      updateFields.changeMagnitude = deriveChangeMagnitude(position.skill);
    }
    if (posPart.verdict !== undefined) {
      updateFields.verdict = normalizePositionVerdict(posPart.verdict);
    }

    updateFields.analysisStatus = 'completed';
    updateFields.analysisProgress = 100;
    updateFields.analysisTaskId = task.id;

    await position.update(updateFields);

    const savedEmployees = [];
    for (const item of employeeList) {
      if (!item?.employeeId) {
        continue;
      }
      const saved = await skillAnalysisSave(auth, {
        positionId,
        employeeId: item.employeeId,
        readiness: item.readiness,
        summary: item.summary,
        metrics: item.metrics,
        skills: item.skills,
        priorityGaps: item.priorityGaps,
        developmentPlan: item.developmentPlan
      });
      savedEmployees.push(
        Object.assign(
          {
            employeeId: item.employeeId
          },
          saved && typeof saved === 'object'
            ? {
                readiness: saved.readiness,
                summary: saved.summary || '',
                metrics: saved.metrics || {},
                skills: saved.skills || [],
                priorityGaps: saved.priorityGaps || [],
                developmentPlan: saved.developmentPlan || null
              }
            : {
                readiness: item.readiness,
                summary: item.summary || '',
                metrics: item.metrics || {},
                skills: item.skills || [],
                priorityGaps: item.priorityGaps || [],
                developmentPlan: item.developmentPlan || null
              }
        )
      );
    }

    const submittedOrg = {
      tenantOrgId: updateFields.tenantOrgId !== undefined ? updateFields.tenantOrgId : position.tenantOrgId || null
    };
    const submittedPosition = {
      description: updateFields.description !== undefined ? updateFields.description : position.description || '',
      requirement: updateFields.requirement !== undefined ? updateFields.requirement : position.requirement || '',
      developmentGoal: updateFields.developmentGoal !== undefined ? updateFields.developmentGoal : position.developmentGoal || '',
      skill: updateFields.skill !== undefined ? updateFields.skill : position.skill || [],
      verdict: updateFields.verdict !== undefined ? updateFields.verdict : position.verdict || {},
      changeMagnitude: updateFields.changeMagnitude !== undefined ? updateFields.changeMagnitude : position.changeMagnitude || null
    };

    await fastify.task.services.complete({
      id: task.id,
      userId: userInfo?.id,
      status: 'success',
      output: {
        positionId,
        tenantId,
        employeeCount: savedEmployees.length,
        org: submittedOrg,
        position: submittedPosition,
        employees: savedEmployees
      }
    });

    return detail(auth, { id: positionId });
  };

  const buildPositionOverviewSchemaHint = () => ({
    verdict: { summary: 'string', today: 'string', future: 'string', futureLabel: 'string' },
    description: 'string(html ok)',
    requirement: 'string(html ok)',
    developmentGoal: 'string(optional, future business goals for this role)',
    skill: [
      {
        id: 'string',
        name: 'string',
        origin: 'existing|new'
      }
    ] // REQUIRED: skill list only (at least 3 items); no detail fields here
  });

  const buildPositionSkillDetailSchemaHint = () => ({
    skill: [
      {
        id: 'string(keep input)',
        name: 'string(keep input)',
        origin: 'existing|new',
        importanceNow: '1-5',
        importanceYear: '1-5',
        change: 'must_build|ai_emerging|new|enhanced|stable|declining',
        aiExposure: 'high|medium|low',
        confidence: 'high|medium|low',
        contentItems: [
          { title: 'string(custom basis title for THIS skill)', description: 'string', source: 'string' },
          { title: 'string(another basis title)', description: 'string', source: 'string' }
        ] // REQUIRED: >=2 依据 for THIS skill only; free-form title/description/source; no jd/shockReport
      }
    ] // REQUIRED: exactly 1 skill; never return other skills
  });

  /** 从单次 position-skill 响应中抽出目标技能（兼容 skill 为对象 / 根对象 / 误返回多条） */
  const pickPositionSkillDetailFromRaw = (raw, skillStub) => {
    const candidates = [];
    const pushCandidate = value => {
      if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return;
      }
      candidates.push(value);
    };

    if (Array.isArray(raw?.skill)) {
      raw.skill.forEach(pushCandidate);
    } else {
      pushCandidate(raw?.skill);
    }
    if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
      if (raw.name || raw.contentItems || raw.importanceNow != null || raw.change) {
        pushCandidate(raw);
      }
    }

    if (candidates.length === 0) {
      return null;
    }

    const stubId = skillStub?.id != null ? String(skillStub.id) : '';
    const stubName = typeof skillStub?.name === 'string' ? skillStub.name.trim() : '';
    const matchesTarget = item => {
      if (stubId && item.id != null && String(item.id) === stubId) {
        return true;
      }
      if (stubName && typeof item.name === 'string' && item.name.trim() === stubName) {
        return true;
      }
      return false;
    };
    const contentCount = item => (normalizePositionSkillItem(item)?.contentItems || []).length;

    // 只在目标技能候选里选，避免把其它技能的依据合并过来
    let pool = candidates.filter(matchesTarget);
    if (pool.length === 0 && candidates.length === 1) {
      pool = candidates;
    }
    if (pool.length === 0) {
      return null;
    }

    pool.sort((a, b) => contentCount(b) - contentCount(a));
    return pool[0];
  };

  const requestOnePositionSkillDetail = async ({ promptContext, skillStub, draftItem, index, total, language }) => {
    const draftContentItems = Array.isArray(draftItem.contentItems) ? draftItem.contentItems.filter(item => item && (item.title || item.description || item.source)) : [];
    const singleSkillDraft = Object.assign({}, draftItem, skillStub, {
      id: skillStub.id || draftItem.id,
      name: skillStub.name || draftItem.name,
      origin: skillStub.origin || draftItem.origin || 'existing'
    });
    delete singleSkillDraft.contentItems;
    delete singleSkillDraft.jd;
    delete singleSkillDraft.shockReport;
    if (draftContentItems.length) {
      singleSkillDraft.contentItems = draftContentItems;
    }

    const singleDraft = { skill: [singleSkillDraft] };
    const singleContext = Object.assign({}, promptContext, {
      targetSkill: {
        id: skillStub.id,
        name: skillStub.name,
        origin: skillStub.origin || 'existing',
        index: index + 1,
        total
      }
    });

    const callOnce = async () => {
      const raw = await requestPositionAnalysisFill(fastify, {
        step: 'position-skill',
        schema: buildPositionSkillDetailSchemaHint(),
        context: singleContext,
        draft: singleDraft,
        language
      });
      const picked = pickPositionSkillDetailFromRaw(raw, skillStub);
      return (
        normalizePositionSkillItem(
          Object.assign({}, singleSkillDraft, picked || {}, {
            id: skillStub.id || picked?.id || draftItem.id,
            name: skillStub.name || picked?.name || draftItem.name
          })
        ) || normalizePositionSkillItem(Object.assign({}, draftItem, skillStub))
      );
    };

    let filled = await callOnce();
    // 无依据时再请求一次，避免模型误返回空 contentItems / 整表 skill
    if (!(filled?.contentItems && filled.contentItems.length)) {
      filled = await callOnce();
    }
    return Object.assign({}, filled, {
      id: skillStub.id || filled.id,
      name: skillStub.name || filled.name,
      origin: skillStub.origin || filled.origin
    });
  };

  const buildPersonEmployeeSchemaHint = () => ({
    employees: [
      {
        employeeId: 'string(keep input)',
        employeeName: 'string(keep input)',
        readiness: '0-100',
        summary: 'string',
        metrics: { criticalGaps: 'number', atOrAbove: 'number', monthsToClose: 'number|null' },
        skills: [{ id: 'string', name: 'string', current: '0-5', required: '0-5', status: 'critical|gap|onTarget|above', evidence: 'string' }],
        priorityGaps: [{ rank: 'number', title: 'string', description: 'string', current: '0-5', required: '0-5' }],
        developmentPlan: {
          subtitle: 'string',
          horizons: [
            {
              key: 'short|mid|long',
              label: '短期|中期|长期',
              period: '0-3个月|3-6个月|6-12个月',
              title: 'string(required)',
              tone: 'primary|cyan|rose',
              target: 'string(required)',
              items: [
                {
                  tag: 'string(required, skill or focus name)',
                  title: 'string(required, action)',
                  meta: 'string(required, detail)'
                }
              ] // REQUIRED: 2-3 items for EVERY horizon; never empty
            }
          ] // REQUIRED: exactly 3 horizons
        }
      }
    ] // REQUIRED: exactly 1 employee in this response
  });

  const buildAiFillSchemaHint = step => {
    if (step === 'org') {
      return {
        departmentName: 'string',
        tenantOrgId: 'string|null'
      };
    }
    if (step === 'position') {
      return buildPositionOverviewSchemaHint();
    }
    if (step === 'position-skill') {
      return buildPositionSkillDetailSchemaHint();
    }
    if (step === 'person') {
      return buildPersonEmployeeSchemaHint();
    }
    return {};
  };

  const fillPersonEmployeesIndividually = async ({ promptContext, context, draft, language }) => {
    const contextEmployees = Array.isArray(context?.employees) ? context.employees : [];
    const draftEmployees = Array.isArray(draft?.employees) ? draft.employees : [];

    if (contextEmployees.length === 0) {
      return { employees: [] };
    }

    const employees = await Promise.all(
      contextEmployees.map(async employee => {
        const draftItem = draftEmployees.find(item => String(item?.employeeId) === String(employee.id)) || draftEmployees[contextEmployees.indexOf(employee)] || {};
        const employeeName = employee.name || employee.nameEn || employee.id;
        const singleDraft = {
          employees: [
            Object.assign({}, draftItem, {
              employeeId: employee.id,
              employeeName: draftItem.employeeName || employeeName
            })
          ]
        };
        const singleContext = Object.assign({}, promptContext, {
          employees: [
            {
              id: employee.id,
              name: employee.name,
              nameEn: employee.nameEn,
              analysis: employee.analysis
            }
          ]
        });

        const raw = await requestPositionAnalysisFill(fastify, {
          step: 'person',
          schema: buildPersonEmployeeSchemaHint(),
          context: singleContext,
          draft: singleDraft,
          language
        });
        const normalized = normalizeAiFillResult('person', raw, singleDraft, { employees: [employee] });
        const item = normalized.employees[0];
        return Object.assign({}, item, {
          developmentPlan: fillEmptyHorizonItems(normalizeDevelopmentPlan(item.developmentPlan)) || item.developmentPlan
        });
      })
    );

    return { employees };
  };

  const fillPositionSkillsIndividually = async ({ promptContext, skillList, draft, language }) => {
    const draftSkills = Array.isArray(draft?.skill) ? draft.skill : [];

    if (skillList.length === 0) {
      return [];
    }

    return Promise.all(
      skillList.map(async (skillStub, index) => {
        const draftItem = (skillStub?.id && draftSkills.find(item => String(item?.id) === String(skillStub.id))) || draftSkills[index] || {};
        return requestOnePositionSkillDetail({
          promptContext,
          skillStub,
          draftItem,
          index,
          total: skillList.length,
          language
        });
      })
    );
  };

  const fillPositionStepIndividually = async ({ promptContext, context, draft, language }) => {
    const listRaw = await requestPositionAnalysisFill(fastify, {
      step: 'position',
      schema: buildPositionOverviewSchemaHint(),
      context: promptContext,
      draft: draft || {},
      language
    });

    const verdict = normalizePositionVerdict(listRaw?.verdict || draft?.verdict || context.position?.verdict || {});
    const description = typeof listRaw?.description === 'string' ? listRaw.description : draft?.description || context.position?.description || '';
    const requirement = typeof listRaw?.requirement === 'string' ? listRaw.requirement : draft?.requirement || context.position?.requirement || '';
    const developmentGoal = typeof listRaw?.developmentGoal === 'string' ? listRaw.developmentGoal : draft?.developmentGoal || context.position?.developmentGoal || '';

    const skillList = normalizePositionSkills(listRaw?.skill || draft?.skill || context.position?.skill || []).map(item => ({
      id: item.id,
      name: item.name,
      origin: item.origin
    }));

    if (skillList.length === 0) {
      return {
        verdict,
        description,
        requirement,
        developmentGoal,
        skill: normalizePositionSkills(context.position?.skill || [])
      };
    }

    const skill = await fillPositionSkillsIndividually({
      promptContext: Object.assign({}, promptContext, { verdict, description, requirement, developmentGoal }),
      skillList,
      draft: draft || {},
      language
    });

    return {
      verdict,
      description,
      requirement,
      developmentGoal,
      skill: skill.length ? skill : normalizePositionSkills(context.position?.skill || [])
    };
  };

  const normalizeAiFillResult = (step, raw, draft, context) => {
    const data = raw && typeof raw === 'object' ? raw : {};
    if (step === 'org') {
      return {
        departmentName: data.departmentName || draft?.departmentName || context.position?.orgEnums?.[0]?.description || '-',
        tenantOrgId: data.tenantOrgId !== undefined ? data.tenantOrgId : (draft?.tenantOrgId ?? context.position?.tenantOrgId ?? null)
      };
    }
    if (step === 'position') {
      const skill = normalizePositionSkills(data.skill || draft?.skill || context.position?.skill || []);
      return {
        verdict: normalizePositionVerdict(data.verdict || draft?.verdict || context.position?.verdict || {}),
        description: typeof data.description === 'string' ? data.description : draft?.description || context.position?.description || '',
        requirement: typeof data.requirement === 'string' ? data.requirement : draft?.requirement || context.position?.requirement || '',
        developmentGoal: typeof data.developmentGoal === 'string' ? data.developmentGoal : draft?.developmentGoal || context.position?.developmentGoal || '',
        skill: skill.length ? skill : normalizePositionSkills(context.position?.skill || [])
      };
    }

    const draftEmployees = Array.isArray(draft?.employees) ? draft.employees : [];
    const contextEmployees = Array.isArray(context.employees) ? context.employees : [];
    const aiEmployees = Array.isArray(data.employees) ? data.employees : [];

    return {
      employees: contextEmployees.map((employee, index) => {
        const draftItem = draftEmployees[index] || {};
        const aiItem = aiEmployees.find(item => String(item.employeeId) === String(employee.id)) || aiEmployees[index] || {};
        const merged = Object.assign({}, draftItem, aiItem, {
          employeeId: employee.id,
          employeeName: employee.name || employee.nameEn || employee.id
        });
        return {
          employeeId: merged.employeeId,
          employeeName: merged.employeeName,
          readiness: normalizeReadiness(merged.readiness),
          summary: typeof merged.summary === 'string' ? merged.summary : '',
          metrics: normalizeMetrics(merged.metrics),
          skills: normalizeSkillRows(merged.skills),
          priorityGaps: normalizePriorityGaps(merged.priorityGaps),
          developmentPlan: normalizeDevelopmentPlan(merged.developmentPlan)
        };
      })
    };
  };

  const aiFillAnalysis = async (userInfo, { taskId, step, draft, language }) => {
    if (!taskId) {
      throw new Error('任务ID不能为空');
    }
    if (!AI_FILL_STEPS.includes(step)) {
      throw new Error('不支持的填充步骤');
    }

    const context = await getAnalysisTaskContext(userInfo, { taskId });
    const outputLanguage = language === 'en-US' ? 'en-US' : language === 'zh-CN' ? 'zh-CN' : context.position?.language === 'en-US' ? 'en-US' : 'zh-CN';
    const promptContext = {
      outputLanguage,
      position: {
        id: context.position?.id,
        name: context.position?.name,
        description: context.position?.description,
        requirement: context.position?.requirement,
        developmentGoal: context.position?.developmentGoal,
        language: context.position?.language,
        tenantOrgId: context.position?.tenantOrgId,
        orgEnums: context.position?.orgEnums,
        skill: context.position?.skill,
        verdict: context.position?.verdict
      },
      employees: (context.employees || []).map(item => ({
        id: item.id,
        name: item.name,
        nameEn: item.nameEn,
        analysis: item.analysis
      }))
    };

    const raw =
      step === 'person' || step === 'position'
        ? null
        : await requestPositionAnalysisFill(fastify, {
            step,
            schema: buildAiFillSchemaHint(step),
            context: promptContext,
            draft: draft || {},
            language: outputLanguage
          });

    let data =
      step === 'person'
        ? await fillPersonEmployeesIndividually({
            promptContext,
            context,
            draft: draft || {},
            language: outputLanguage
          })
        : step === 'position'
          ? await fillPositionStepIndividually({
              promptContext,
              context,
              draft: draft || {},
              language: outputLanguage
            })
          : normalizeAiFillResult(step, raw, draft, context);

    return {
      step,
      language: outputLanguage,
      data
    };
  };

  const createWithAutoAnalysis = async (authenticatePayload, data) => {
    const position = await create(authenticatePayload, data);
    try {
      await startAnalysis(authenticatePayload, { id: position.id });
      await position.reload();
    } catch (e) {
      fastify.log.warn({ err: e }, 'auto start position analysis failed');
    }
    return position;
  };

  /** 岗位列表洞察：高变动幅度数量与样例名称（用于 InsightBanner） */
  const insight = async authenticatePayload => {
    const { tenantId } = authenticatePayload;
    const where = {
      tenantId,
      changeMagnitude: 'high'
    };
    const highChangeCount = await models.position.count({ where });
    const samples = await models.position.findAll({
      where,
      attributes: ['id', 'name'],
      order: [['updatedAt', 'DESC']],
      limit: 3
    });
    return {
      highChangeCount,
      sampleNames: samples.map(item => item.name).filter(Boolean)
    };
  };

  const restoreAnalysisStateAfterCancel = async task => {
    if (!task || task.type !== ANALYSIS_TASK_TYPE) {
      return;
    }
    const positionId = task.input?.positionId || task.targetId;
    const tenantId = task.input?.tenantId;
    if (!positionId || !tenantId) {
      return;
    }
    const position = await models.position.findByPk(positionId);
    if (!position || String(position.tenantId) !== String(tenantId)) {
      return;
    }
    // 仅当取消的是当前挂在岗位上的分析任务时才恢复，避免误伤后续新任务
    if (position.analysisTaskId && String(position.analysisTaskId) !== String(task.id)) {
      return;
    }
    const before = task.input?.analysisStateBefore && typeof task.input.analysisStateBefore === 'object' ? task.input.analysisStateBefore : {};
    const nextStatus = typeof before.analysisStatus === 'string' && before.analysisStatus ? before.analysisStatus : 'idle';
    const nextProgress = Number.isFinite(Number(before.analysisProgress)) ? Number(before.analysisProgress) : 0;
    const nextTaskId = before.analysisTaskId || null;
    await position.update({
      analysisStatus: nextStatus,
      analysisProgress: nextProgress,
      analysisTaskId: nextTaskId
    });
  };

  const collectAnalysisTasksForCancel = async ({ id, targetId, targetType, type }) => {
    if (id) {
      try {
        const task = await fastify.task.services.detail({ id });
        return task ? [task] : [];
      } catch (e) {
        return [];
      }
    }
    if (targetId && targetType && type) {
      return fastify.task.models.task.findAll({
        where: {
          targetId,
          targetType,
          type,
          status: {
            [Op.in]: ['pending', 'running', 'waiting']
          }
        }
      });
    }
    return [];
  };

  // 包装任务取消：取消 AI 岗位分析任务时恢复岗位分析状态
  if (fastify.task?.services?.cancel && !fastify.task.services.cancel.__positionAnalysisWrapped) {
    const originalCancel = fastify.task.services.cancel.bind(fastify.task.services);
    const wrappedCancel = async params => {
      const tasks = await collectAnalysisTasksForCancel(params || {});
      const result = await originalCancel(params);
      for (const task of tasks) {
        try {
          const latest = await fastify.task.models.task.findByPk(task.id);
          if (!latest || latest.status !== 'canceled') {
            continue;
          }
          await restoreAnalysisStateAfterCancel(task);
        } catch (e) {
          fastify.log.warn({ err: e, taskId: task?.id }, 'restore position analysis state after cancel failed');
        }
      }
      return result;
    };
    wrappedCancel.__positionAnalysisWrapped = true;
    fastify.task.services.cancel = wrappedCancel;
  }

  Object.assign(fastify[options.name].services, {
    position: {
      create: createWithAutoAnalysis,
      list,
      detail,
      save,
      remove,
      setStatus,
      enums,
      skillAnalysisDetail,
      skillAnalysisSave,
      startAnalysis,
      lockAnalysis,
      getAnalysisTaskContext,
      completeAnalysis,
      aiFillAnalysis,
      insight
    }
  });
});
