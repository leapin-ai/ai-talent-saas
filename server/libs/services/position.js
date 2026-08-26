const fp = require('fastify-plugin');
const omit = require('lodash/omit');
const { requestPositionAnalysisFill, repairDevelopmentPlanItems, fillPersonDevelopmentPlanByHorizons } = require('../utils/llm-runner');

const ANALYSIS_TASK_TYPE = 'position-ai-analysis';
const ANALYSIS_PROGRESS_START = 18;
const AI_FILL_STEPS = ['org', 'position', 'person'];

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

    const nextData = Object.assign({}, omit(data, ['tenantId', 'publishAt', 'orgEnums']), name && { name }, language && { language }, locationType && { locationType }, tenantOrgId !== undefined && { tenantOrgId: resolvedTenantOrgId });
    if (nextData.skill !== undefined) {
      nextData.skill = normalizePositionSkills(nextData.skill);
      nextData.changeMagnitude = deriveChangeMagnitude(nextData.skill);
    } else if (nextData.changeMagnitude !== undefined) {
      nextData.changeMagnitude = normalizeChangeMagnitude(nextData.changeMagnitude);
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

  const enums = async (authenticatePayload, { ids, names }) => {
    const { tenantId } = authenticatePayload;
    const whereQuery = {
      tenantId,
      [Op.or]: [{ id: { [Op.in]: ids || [] } }, { name: { [Op.in]: names || [] } }]
    };
    const positions = await models.position.findAll({
      where: whereQuery
    });

    return positions.map(item => {
      return {
        value: item.id,
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
    const normalizeTextBlock = value => {
      if (!value || typeof value !== 'object') {
        return { text: '', source: '' };
      }
      return {
        text: typeof value.text === 'string' ? value.text : '',
        source: typeof value.source === 'string' ? value.source : ''
      };
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
      jd: normalizeTextBlock(raw.jd),
      shockReport: normalizeTextBlock(raw.shockReport)
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
        }))
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
    if (position.analysisStatus === 'generating' && position.analysisTaskId) {
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

    return {
      task: {
        id: task.id,
        type: task.type,
        status: task.status,
        input: task.input
      },
      company,
      position: {
        id: position.id,
        name: position.name,
        description: position.description || '',
        requirement: position.requirement || '',
        tenantOrgId: position.tenantOrgId,
        language: position.language,
        locationType: position.locationType || null,
        location: position.location || {},
        capacity: position.capacity || '',
        salary: position.salary || {},
        status: position.status || null,
        changeMagnitude: position.changeMagnitude || null,
        skill: position.skill || [],
        verdict: position.verdict || {},
        analysisStatus: position.analysisStatus,
        analysisProgress: position.analysisProgress,
        orgEnums: position.getDataValue('orgEnums') || []
      },
      employees: employees.map(item => {
        const analysis = analysisMap.get(String(item.id));
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

    for (const item of employeeList) {
      if (!item?.employeeId) {
        continue;
      }
      await skillAnalysisSave(auth, {
        positionId,
        employeeId: item.employeeId,
        readiness: item.readiness,
        summary: item.summary,
        metrics: item.metrics,
        skills: item.skills,
        priorityGaps: item.priorityGaps,
        developmentPlan: item.developmentPlan
      });
    }

    await fastify.task.services.complete({
      id: task.id,
      userId: userInfo?.id,
      status: 'success',
      output: {
        positionId,
        tenantId,
        employeeCount: employeeList.length
      }
    });

    return detail(auth, { id: positionId });
  };

  const buildAiFillSchemaHint = step => {
    if (step === 'org') {
      return {
        departmentName: 'string',
        tenantOrgId: 'string|null'
      };
    }
    if (step === 'position') {
      return {
        verdict: { summary: 'string', today: 'string', future: 'string', futureLabel: 'string' },
        description: 'string(html ok)',
        requirement: 'string(html ok)',
        skill: [
          {
            id: 'string',
            name: 'string',
            origin: 'existing|new',
            importanceNow: '1-5',
            importanceYear: '1-5',
            change: 'must_build|ai_emerging|new|enhanced|stable|declining',
            aiExposure: 'high|medium|low',
            confidence: 'high|medium|low',
            jd: { text: 'string', source: 'string' },
            shockReport: { text: 'string', source: 'string' }
          }
        ]
      };
    }
    return {
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
      ]
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

    const raw = await requestPositionAnalysisFill(fastify, {
      step,
      schema: buildAiFillSchemaHint(step),
      context: promptContext,
      draft: draft || {},
      language: outputLanguage
    });

    let data = normalizeAiFillResult(step, raw, draft, context);
    if (step === 'person' && Array.isArray(data.employees)) {
      // 基础结果 + short/mid/long 分次生成 items，再合并
      data = Object.assign({}, data, {
        employees: await fillPersonDevelopmentPlanByHorizons(fastify, {
          context: promptContext,
          employees: data.employees,
          alwaysKeys: ['short', 'mid', 'long'],
          language: outputLanguage
        })
      });
      data.employees = await Promise.all(
        data.employees.map(async item =>
          Object.assign({}, item, {
            developmentPlan: await ensureDevelopmentPlan(item.developmentPlan, {
              position: promptContext.position,
              outputLanguage,
              employeeName: item.employeeName,
              summary: item.summary,
              priorityGaps: item.priorityGaps
            })
          })
        )
      );
    }

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
      getAnalysisTaskContext,
      completeAnalysis,
      aiFillAnalysis,
      insight
    }
  });
});
