import { useEffect, useMemo, useRef, useState } from 'react';
import { App, Button, Select } from 'antd';
import { createWithRemoteLoader } from '@kne/remote-loader';
import { CHANGE_VALUES, LEVEL_VALUES, ORIGIN_VALUES, createEmptySkill, createSkillId, normalizeSkills, normalizeVerdict } from '@components/Position/Detail/SkillList/skillModel';
import AnalysisFormLayout from './AnalysisFormLayout';
import style from './style.module.scss';

const AI_FILL_LANGUAGE_OPTIONS = [
  { label: '中文', value: 'zh-CN' },
  { label: 'English', value: 'en-US' }
];
const EMPLOYEE_SKILL_STATUS = [
  { label: '严重缺口', value: 'critical' },
  { label: '缺口', value: 'gap' },
  { label: '达标', value: 'onTarget' },
  { label: '超出', value: 'above' }
];

const PLAN_TONES = [
  { label: 'primary', value: 'primary' },
  { label: 'cyan', value: 'cyan' },
  { label: 'rose', value: 'rose' }
];

const CHANGE_OPTIONS = CHANGE_VALUES.map(value => ({
  value,
  label: {
    must_build: '必须建设',
    ai_emerging: 'AI新兴',
    new: '新增',
    enhanced: '增强',
    stable: '稳定',
    declining: '衰退'
  }[value]
}));

const ORIGIN_OPTIONS = ORIGIN_VALUES.map(value => ({
  value,
  label: value === 'existing' ? '已有' : '新增'
}));

const LEVEL_OPTIONS = LEVEL_VALUES.map(value => ({ value, label: value }));

const IMPORTANCE_OPTIONS = [1, 2, 3, 4, 5].map(value => ({ label: String(value), value }));

const emptyEmployeeSkill = (fromPositionSkill = null) => ({
  id: fromPositionSkill?.id || createSkillId(),
  name: fromPositionSkill?.name || '',
  current: 0,
  required: Number(fromPositionSkill?.importanceNow) || 3,
  status: undefined,
  evidence: ''
});

const emptyPriorityGap = (rank = 1) => ({
  rank,
  title: '',
  description: '',
  current: null,
  required: null
});

const emptyPlanItem = () => ({ tag: '', title: '', meta: '' });

const emptyHorizon = (index = 0) => ({
  key: ['short', 'mid', 'long'][index] || String(index + 1),
  label: ['短期', '中期', '长期'][index] || '',
  period: ['0-3个月', '3-6个月', '6-12个月'][index] || '',
  title: '',
  tone: PLAN_TONES[index]?.value || 'primary',
  items: [emptyPlanItem(), emptyPlanItem(), emptyPlanItem()],
  target: ''
});

const seedEmployeeSkills = (analysis, positionSkills) => {
  if (Array.isArray(analysis?.skills) && analysis.skills.length > 0) {
    return analysis.skills.map(item => ({
      id: item.id || createSkillId(),
      name: item.name || '',
      current: item.current ?? 0,
      required: item.required ?? 0,
      status: item.status,
      evidence: item.evidence || ''
    }));
  }
  return (positionSkills || []).map(item => emptyEmployeeSkill(item));
};

const seedPriorityGaps = analysis => {
  if (Array.isArray(analysis?.priorityGaps) && analysis.priorityGaps.length > 0) {
    return analysis.priorityGaps.map((item, index) => ({
      rank: item.rank ?? index + 1,
      title: item.title || '',
      description: item.description || '',
      current: item.current ?? null,
      required: item.required ?? null
    }));
  }
  return [emptyPriorityGap(1)];
};

const padPlanItems = items => {
  const list = Array.isArray(items)
    ? items.map(row => ({
        tag: row?.tag || '',
        title: row?.title || '',
        meta: row?.meta || ''
      }))
    : [];
  while (list.length < 3) {
    list.push(emptyPlanItem());
  }
  return list.slice(0, 3);
};

const seedDevelopmentPlan = analysis => {
  const plan = analysis?.developmentPlan;
  if (plan && Array.isArray(plan.horizons) && plan.horizons.length > 0) {
    const horizons = [0, 1, 2].map(index => {
      const horizon = plan.horizons[index] || {};
      const base = emptyHorizon(index);
      return {
        key: horizon.key || base.key,
        label: horizon.label || base.label,
        period: horizon.period || base.period,
        title: horizon.title || '',
        tone: horizon.tone || base.tone,
        target: horizon.target || '',
        items: padPlanItems(horizon.items)
      };
    });
    return {
      subtitle: plan.subtitle || '',
      horizons
    };
  }
  return {
    subtitle: '',
    horizons: [emptyHorizon(0), emptyHorizon(1), emptyHorizon(2)]
  };
};

const buildInitialValues = context => {
  const department = (context?.position?.orgEnums || []).find(item => String(item.value) === String(context?.position?.tenantOrgId))?.description || '-';
  const verdict = normalizeVerdict(context?.position?.verdict);
  const positionSkills = normalizeSkills(context?.position?.skill);

  return {
    org: {
      departmentName: department,
      tenantOrgId: context?.position?.tenantOrgId || null
    },
    position: {
      verdict,
      description: context?.position?.description || '',
      requirement: context?.position?.requirement || '',
      developmentGoal: context?.position?.developmentGoal || '',
      skill: positionSkills.length > 0 ? positionSkills : [createEmptySkill()]
    },
    employees: (context?.employees || []).map(employee => {
      const analysis = employee.analysis || {};
      const developmentPlan = seedDevelopmentPlan(analysis);
      return {
        employeeId: employee.id,
        employeeName: employee.name || employee.nameEn || employee.id,
        readiness: analysis.readiness ?? null,
        summary: analysis.summary || '',
        metrics: {
          criticalGaps: analysis.metrics?.criticalGaps ?? 0,
          atOrAbove: analysis.metrics?.atOrAbove ?? 0,
          monthsToClose: analysis.metrics?.monthsToClose ?? null
        },
        skills: seedEmployeeSkills(analysis, positionSkills),
        priorityGaps: seedPriorityGaps(analysis),
        developmentPlan
      };
    })
  };
};

const reshapePositionData = data => ({
  description: data?.description || '',
  requirement: data?.requirement || '',
  developmentGoal: data?.developmentGoal || '',
  skill: normalizeSkills(data?.skill),
  verdict: normalizeVerdict(data?.verdict)
});

const reshapeEmployees = list =>
  (Array.isArray(list) ? list : []).map(item => ({
    employeeId: item.employeeId,
    readiness: item.readiness,
    summary: item.summary || '',
    metrics: item.metrics || {},
    skills: item.skills || [],
    priorityGaps: item.priorityGaps || [],
    developmentPlan: item.developmentPlan || null
  }));

const looksLikePositionPayload = raw => {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return false;
  }
  return Array.isArray(raw.skill) || (raw.verdict && typeof raw.verdict === 'object') || typeof raw.roleName === 'string';
};

const normalizeImportedOrg = (raw, context) => {
  const src = raw && typeof raw === 'object' ? raw : {};
  const fallbackOrgId = context?.position?.tenantOrgId ?? null;
  const fallbackName = (context?.position?.orgEnums || []).find(item => String(item.value) === String(fallbackOrgId))?.description || src.departmentName || '-';
  return {
    departmentName: typeof src.departmentName === 'string' && src.departmentName ? src.departmentName : fallbackName,
    tenantOrgId: src.tenantOrgId !== undefined ? src.tenantOrgId : fallbackOrgId
  };
};

const normalizeImportedPosition = (raw, context) => {
  const src = raw && typeof raw === 'object' ? raw : {};
  const skills = normalizeSkills(src.skill);
  return {
    verdict: normalizeVerdict(src.verdict || context?.position?.verdict),
    description: typeof src.description === 'string' ? src.description : context?.position?.description || '',
    requirement: typeof src.requirement === 'string' ? src.requirement : context?.position?.requirement || '',
    developmentGoal: typeof src.developmentGoal === 'string' ? src.developmentGoal : context?.position?.developmentGoal || '',
    skill: skills.length > 0 ? skills : normalizeSkills(context?.position?.skill).length ? normalizeSkills(context?.position?.skill) : [createEmptySkill()]
  };
};

const normalizeImportedEmployees = (rawList, context) => {
  const contextEmployees = Array.isArray(context?.employees) ? context.employees : [];
  const incoming = Array.isArray(rawList) ? rawList : [];
  const positionSkills = normalizeSkills(context?.position?.skill);
  return contextEmployees.map((employee, index) => {
    const byId = incoming.find(item => String(item?.employeeId || item?.id) === String(employee.id));
    const item = byId || incoming[index] || {};
    const analysis = item.analysis && typeof item.analysis === 'object' ? item.analysis : item;
    return {
      employeeId: employee.id,
      employeeName: employee.name || employee.nameEn || employee.id,
      readiness: analysis.readiness ?? null,
      summary: analysis.summary || '',
      metrics: {
        criticalGaps: analysis.metrics?.criticalGaps ?? 0,
        atOrAbove: analysis.metrics?.atOrAbove ?? 0,
        monthsToClose: analysis.metrics?.monthsToClose ?? null
      },
      skills: seedEmployeeSkills(analysis, positionSkills),
      priorityGaps: seedPriorityGaps(analysis),
      developmentPlan: seedDevelopmentPlan(analysis)
    };
  });
};

/**
 * 剪贴板 JSON 支持：
 * 1) 岗位导出格式：{ roleName, verdict, skill, ... }（见 converted-skills/*.json）
 * 2) 岗位数组：[{ roleName, verdict, skill }, ...]（按角色名匹配，否则取第一项）
 * 3) 三步整包：{ org?, position?, employees? }；position 也可直接是格式 1
 * 4) 完成分析提交体：{ org, position, employees }
 */
const parseClipboardImportPayload = (text, context) => {
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (e) {
    throw new Error('剪贴板不是合法 JSON');
  }

  let root = parsed;
  if (Array.isArray(parsed)) {
    if (!parsed.length) {
      throw new Error('剪贴板 JSON 数组为空');
    }
    const roleName = context?.position?.name;
    root = (roleName && parsed.find(item => item && typeof item === 'object' && String(item.roleName || '').toLowerCase() === String(roleName).toLowerCase())) || parsed.find(item => looksLikePositionPayload(item)) || parsed[0];
  }

  if (!root || typeof root !== 'object') {
    throw new Error('无法识别剪贴板数据结构');
  }

  const hasBundleKeys = root.org != null || root.position != null || root.employees != null;
  const positionRaw = hasBundleKeys
    ? looksLikePositionPayload(root.position)
      ? root.position
      : root.position && typeof root.position === 'object'
        ? root.position
        : looksLikePositionPayload(root)
          ? root
          : null
    : looksLikePositionPayload(root)
      ? root
      : null;

  if (!positionRaw && !root.org && !Array.isArray(root.employees)) {
    throw new Error('未识别到 org / position(skill|verdict) / employees');
  }

  const bundle = {
    generation: Date.now(),
    org: null,
    position: null,
    employees: null
  };

  if (root.org != null || positionRaw || hasBundleKeys) {
    bundle.org = normalizeImportedOrg(root.org, context);
  }
  if (positionRaw) {
    bundle.position = normalizeImportedPosition(positionRaw, context);
  }
  if (Array.isArray(root.employees)) {
    bundle.employees = normalizeImportedEmployees(root.employees, context);
  }

  if (!bundle.org && !bundle.position && !bundle.employees) {
    throw new Error('剪贴板没有可导入的字段');
  }

  return bundle;
};

const applyFormDataWithRetry = (openApi, formDataToSet, step) => {
  if (!openApi?.setFormData || !formDataToSet) {
    return;
  }
  openApi.setFormData(formDataToSet, false);
  if ((step === 'position' && Array.isArray(formDataToSet.skill)) || (step === 'person' && Array.isArray(formDataToSet.employees))) {
    setTimeout(() => {
      openApi.setFormData(formDataToSet, false);
    }, 500);
  }
};

const formDataForStep = (step, bundle, formData) => {
  if (!bundle) {
    return null;
  }
  if (step === 'org' && bundle.org) {
    return Object.assign({}, formData || {}, bundle.org);
  }
  if (step === 'position' && bundle.position) {
    return Object.assign({}, formData || {}, bundle.position);
  }
  if (step === 'person' && Array.isArray(bundle.employees)) {
    return Object.assign({}, formData || {}, { employees: bundle.employees });
  }
  return null;
};

const submitCompleteAnalysis = async ({ taskId, org, positionRaw, employeesInput, contextEmployees, ajax, completeApi, message, onSuccess }) => {
  const position = reshapePositionData(positionRaw);
  if (!position.skill.length) {
    message.error('请至少填写一项有效岗位技能');
    return false;
  }
  const employees = reshapeEmployees(employeesInput).map((item, index) =>
    Object.assign({}, item, {
      employeeId: item.employeeId || contextEmployees[index]?.id
    })
  );
  if (employees.length > 0 && employees.some(item => !item.employeeId)) {
    message.error('人员数据缺少 employeeId，请关闭后重试');
    return false;
  }

  const { data: submitRes } = await ajax(
    Object.assign({}, completeApi, {
      data: {
        taskId,
        org: { tenantOrgId: org.tenantOrgId ?? null },
        position,
        employees
      }
    })
  );
  if (submitRes.code !== 0) {
    throw new Error(submitRes.msg || '完成分析任务失败');
  }
  message.success('AI岗位分析已完成');
  onSuccess && onSuccess();
  return true;
};

const validatePositionStep = (data, message) => {
  if (!normalizeSkills(data?.skill).length) {
    message.error('请至少填写一项有效岗位技能');
    return false;
  }
};

/**
 * 嵌套 List/TableList 首次靠 formProps.data 灌入常丢子项。
 * 仅在每个步骤「首次进入」时用 seed 回填；返回上一步时不再回填，以免覆盖 stepCache 里的编辑结果。
 */
const RehydrateNestedFormData = ({ FormInfo, data, onceKey, onceRef }) => {
  const { openApi } = FormInfo.useFormContext();

  useEffect(() => {
    if (!openApi?.setFormData || !data || typeof data !== 'object' || !onceKey || !onceRef) {
      return undefined;
    }
    if (onceRef.current[onceKey]) {
      return undefined;
    }
    onceRef.current[onceKey] = true;
    const apply = () => {
      openApi.setFormData(data, false);
    };
    apply();
    const timer = setTimeout(apply, 500);
    return () => clearTimeout(timer);
  }, [openApi, data, onceKey, onceRef]);

  return null;
};

const ApplyClipboardImport = ({ FormInfo, step, importBundleRef }) => {
  const { openApi } = FormInfo.useFormContext();
  const appliedGenerationRef = useRef(0);

  useEffect(() => {
    if (!importBundleRef || !openApi?.setFormData) {
      return undefined;
    }

    const apply = bundle => {
      if (!bundle?.generation || appliedGenerationRef.current === bundle.generation) {
        return;
      }
      const next = formDataForStep(step, bundle, openApi.formData || {});
      if (!next) {
        return;
      }
      appliedGenerationRef.current = bundle.generation;
      // 晚于 RehydrateNestedFormData 的 500ms，避免被初始空数据盖住
      setTimeout(() => {
        applyFormDataWithRetry(openApi, next, step);
      }, 600);
    };

    if (!importBundleRef.current) {
      importBundleRef.current = { value: null, listeners: new Set() };
    }
    if (!(importBundleRef.current.listeners instanceof Set)) {
      const existing = importBundleRef.current.value || importBundleRef.current;
      importBundleRef.current = {
        value: existing?.generation ? existing : null,
        listeners: new Set()
      };
    }

    const { listeners, value } = importBundleRef.current;
    listeners.add(apply);
    if (value) {
      apply(value);
    }
    return () => {
      listeners.delete(apply);
    };
  }, [FormInfo, openApi, step, importBundleRef]);

  return null;
};

const AiFillToolbar = ({ FormInfo, step, taskId, ajax, fillApi, message, defaultLanguage, languageRef, importBundleRef, context }) => {
  const { FormApiButton } = FormInfo;
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [language, setLanguage] = useState(() => languageRef?.current || defaultLanguage || 'zh-CN');

  const changeLanguage = value => {
    setLanguage(value);
    if (languageRef) {
      languageRef.current = value;
    }
  };

  const onImportClipboard = async ({ openApi, formData }) => {
    setImporting(true);
    try {
      if (!navigator?.clipboard?.readText) {
        throw new Error('当前环境不支持读取剪贴板');
      }
      const text = await navigator.clipboard.readText();
      if (!text || !String(text).trim()) {
        throw new Error('剪贴板为空');
      }
      const bundle = parseClipboardImportPayload(String(text).trim(), context);
      if (importBundleRef) {
        if (!importBundleRef.current || !(importBundleRef.current.listeners instanceof Set)) {
          importBundleRef.current = { value: null, listeners: new Set() };
        }
        importBundleRef.current.value = bundle;
        importBundleRef.current.listeners.forEach(fn => {
          try {
            fn(bundle);
          } catch (e) {
            // ignore listener errors
          }
        });
      }
      const next = formDataForStep(step, bundle, formData || {});
      if (next) {
        applyFormDataWithRetry(openApi, next, step);
      }
      const parts = [];
      if (bundle.org) {
        parts.push('组织/部门');
      }
      if (bundle.position) {
        parts.push('岗位');
      }
      if (bundle.employees) {
        parts.push('个人');
      }
      message.success(`已从剪贴板导入：${parts.join('、')}${next ? '' : '（本步无对应字段，进入对应步骤时自动回填）'}`);
    } catch (e) {
      message.error(e.message || '导入失败');
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className={style['ai-fill-bar']}>
      <div className={style['ai-fill-main']}>
        {fillApi ? (
          <label className={style['ai-fill-field']}>
            <span className={style['ai-fill-label']}>生成语言</span>
            <Select size="middle" className={style['ai-fill-select']} value={language || 'zh-CN'} options={AI_FILL_LANGUAGE_OPTIONS} disabled={loading || importing} onChange={changeLanguage} />
          </label>
        ) : null}
        <FormApiButton className={style['ai-fill-action']} loading={importing} disabled={loading || importing} onClick={onImportClipboard}>
          从剪贴板导入
        </FormApiButton>
        {fillApi ? (
          <FormApiButton
            type="primary"
            className={style['ai-fill-action']}
            loading={loading}
            disabled={loading || importing}
            onClick={async ({ openApi, formData }) => {
              setLoading(true);
              try {
                const outputLanguage = languageRef?.current || language || 'zh-CN';
                const { data: resData } = await ajax(
                  Object.assign({}, fillApi, {
                    data: {
                      taskId,
                      step,
                      language: outputLanguage,
                      draft: formData || {}
                    }
                  })
                );
                if (resData.code !== 0) {
                  throw new Error(resData.msg || 'AI 填充失败');
                }
                const nextData = resData.data?.data;
                if (!nextData || typeof nextData !== 'object') {
                  throw new Error('AI 未返回可用数据');
                }
                let payload = nextData;
                if (step === 'position' && Array.isArray(nextData.skill)) {
                  const draftSkills = Array.isArray(formData?.skill) ? formData.skill : [];
                  payload = {
                    ...nextData,
                    skill: normalizeSkills(
                      nextData.skill.map((item, index) => {
                        const draft = (item?.id && draftSkills.find(skill => skill.id === item.id)) || draftSkills[index] || {};
                        return Object.assign({}, draft, item);
                      })
                    )
                  };
                }
                if (step === 'person' && Array.isArray(nextData.employees)) {
                  payload = {
                    ...nextData,
                    employees: nextData.employees.map(emp => {
                      const plan = emp.developmentPlan || {};
                      const horizons = [0, 1, 2].map(index => {
                        const horizon = (plan.horizons || [])[index] || emptyHorizon(index);
                        const base = emptyHorizon(index);
                        return {
                          key: horizon.key || base.key,
                          label: horizon.label || base.label,
                          period: horizon.period || base.period,
                          title: horizon.title || '',
                          tone: horizon.tone || base.tone,
                          target: horizon.target || '',
                          items: padPlanItems(horizon.items)
                        };
                      });
                      return Object.assign({}, emp, {
                        developmentPlan: {
                          subtitle: plan.subtitle || '',
                          horizons
                        }
                      });
                    })
                  };
                }
                const formDataToSet = Object.assign({}, formData, payload);
                applyFormDataWithRetry(openApi, formDataToSet, step);
                message.success('已根据当前输入生成一版，可继续编辑');
              } catch (e) {
                message.error(e.message || 'AI 填充失败');
              } finally {
                setLoading(false);
              }
            }}
          >
            AI 填充
          </FormApiButton>
        ) : null}
      </div>
      <div className={style['ai-fill-hint']}>可粘贴岗位 JSON（含 verdict/skill）或 {'{ org, position, employees }'} 整包；导入后不会自动提交</div>
    </div>
  );
};

const OrgStep = ({ FormInfo, aiFillProps, context, importBundleRef }) => {
  const { Input } = FormInfo.fields;
  return (
    <AnalysisFormLayout context={context}>
      <div className={style.body}>
        <ApplyClipboardImport FormInfo={FormInfo} step="org" importBundleRef={importBundleRef} />
        <AiFillToolbar FormInfo={FormInfo} step="org" {...aiFillProps} importBundleRef={importBundleRef} context={context} />
        <FormInfo column={1} title="组织/部门" list={[<Input name="departmentName" label="部门" disabled key="departmentName" />, <Input name="tenantOrgId" label="tenantOrgId" hidden key="tenantOrgId" />]} />
      </div>
    </AnalysisFormLayout>
  );
};

const PositionStep = ({ FormInfo, Editor, aiFillProps, context, rehydrateOnceRef, importBundleRef }) => {
  const { List } = FormInfo;
  const { Input, TextArea, Select } = FormInfo.fields;
  const initialData = useMemo(() => buildInitialValues(context).position, [context]);
  const onceKey = `position:${aiFillProps?.taskId || 'task'}`;
  return (
    <AnalysisFormLayout context={context}>
      <div className={style.body}>
        <RehydrateNestedFormData FormInfo={FormInfo} data={initialData} onceKey={onceKey} onceRef={rehydrateOnceRef} />
        <ApplyClipboardImport FormInfo={FormInfo} step="position" importBundleRef={importBundleRef} />
        <AiFillToolbar FormInfo={FormInfo} step="position" {...aiFillProps} importBundleRef={importBundleRef} context={context} />
        <FormInfo
          column={1}
          title="The Verdict"
          list={[
            <TextArea name="verdict.summary" label="洞察摘要" rule="REQ" block key="verdict.summary" />,
            <TextArea name="verdict.today" label="今日结论" rule="REQ" block key="verdict.today" />,
            <TextArea name="verdict.future" label="未来结论" rule="REQ" block key="verdict.future" />,
            <Input name="verdict.futureLabel" label="未来标签" key="verdict.futureLabel" />
          ]}
        />
        <List
          name="skill"
          title="岗位技能列表"
          important
          minLength={1}
          addText="添加岗位技能"
          itemTitle={({ index }) => `技能 ${index + 1}`}
          list={[
            <Input name="id" label="id" hidden />,
            <Input name="name" label="技能名称" rule="REQ LEN-1-200" />,
            <Select name="origin" label="来源" rule="REQ" options={ORIGIN_OPTIONS} />,
            <Select name="importanceNow" label="当前重要性" rule="REQ" options={IMPORTANCE_OPTIONS} />,
            <Select name="importanceYear" label="本年重要性" rule="REQ" options={IMPORTANCE_OPTIONS} />,
            <Select name="change" label="变化" rule="REQ" options={CHANGE_OPTIONS} />,
            <Select name="aiExposure" label="AI 暴露" options={LEVEL_OPTIONS} />,
            <Select name="confidence" label="置信度" options={LEVEL_OPTIONS} />,
            <List
              name="contentItems"
              title="依据"
              block
              addText="添加依据"
              itemTitle={({ index }) => `依据 ${index + 1}`}
              list={[
                <FormInfo column={1} list={[<Input name="title" label="标题" rule="LEN-0-200" block />, <TextArea name="description" label="描述" block rule="LEN-0-2000" />, <Input name="source" label="来源" rule="LEN-0-200" block />]} />
              ]}
            />
          ]}
        />
        <FormInfo
          column={1}
          title="工作内容 / 要求"
          list={[
            <Editor name="description" label="工作内容" block rule="LEN-0-10000" key="description" />,
            <Editor name="requirement" label="工作要求" block rule="LEN-0-10000" key="requirement" />,
            <TextArea name="developmentGoal" label="发展目标" description="未来业务目标：2-3 年，这个岗位需要帮助业务实现什么？（选填）" block rule="LEN-0-2000" key="developmentGoal" />
          ]}
        />
      </div>
    </AnalysisFormLayout>
  );
};

const PersonStep = ({ FormInfo, aiFillProps, context, rehydrateOnceRef, importBundleRef }) => {
  const { List, TableList } = FormInfo;
  const { Input, TextArea, Select, InputNumber } = FormInfo.fields;
  const employeeCount = (context?.employees || []).length;
  const initialData = useMemo(() => ({ employees: buildInitialValues(context).employees }), [context]);
  const onceKey = `person:${aiFillProps?.taskId || 'task'}`;

  return (
    <AnalysisFormLayout context={context}>
      <div className={style.body}>
        <RehydrateNestedFormData FormInfo={FormInfo} data={initialData} onceKey={onceKey} onceRef={rehydrateOnceRef} />
        <ApplyClipboardImport FormInfo={FormInfo} step="person" importBundleRef={importBundleRef} />
        <AiFillToolbar FormInfo={FormInfo} step="person" {...aiFillProps} importBundleRef={importBundleRef} context={context} />
        <List
          name="employees"
          title="个人人才分析"
          important
          minLength={employeeCount}
          maxLength={employeeCount}
          itemTitle={({ index }) => `人员 ${index + 1}`}
          list={[
            <Input name="employeeId" label="employeeId" hidden />,
            <Input name="employeeName" label="姓名" disabled />,
            <InputNumber name="readiness" label="就绪度 %" rule="REQ" min={0} max={100} />,
            <TextArea name="summary" label="分析摘要" rule="REQ" block />,
            <InputNumber name="metrics.criticalGaps" label="关键缺口" min={0} />,
            <InputNumber name="metrics.atOrAbove" label="达标项" min={0} />,
            <InputNumber name="metrics.monthsToClose" label="预计月数" min={0} />,
            <List
              name="skills"
              title="技能对比"
              block
              addText="添加技能对比"
              itemTitle={({ index }) => `技能 ${index + 1}`}
              list={[
                <Input name="id" label="id" hidden />,
                <Input name="name" label="名称" rule="REQ LEN-1-200" />,
                <InputNumber name="current" label="当前" min={0} max={5} />,
                <InputNumber name="required" label="要求" min={0} max={5} />,
                <Select name="status" label="状态" options={EMPLOYEE_SKILL_STATUS} />,
                <Input name="evidence" label="证据" rule="LEN-0-100" />
              ]}
            />,
            <List
              name="priorityGaps"
              title="优先差距"
              block
              addText="添加优先差距"
              itemTitle={({ index }) => `差距 ${index + 1}`}
              list={[
                <InputNumber name="rank" label="排名" min={1} />,
                <Input name="title" label="标题" rule="REQ LEN-1-200" />,
                <TextArea name="description" label="描述" block />,
                <InputNumber name="current" label="当前分" min={0} max={5} />,
                <InputNumber name="required" label="要求分" min={0} max={5} />
              ]}
            />,
            <Input name="developmentPlan.subtitle" label="发展计划副标题" rule="LEN-0-80" />,
            <List
              name="developmentPlan.horizons"
              title="发展阶段"
              block
              addText="添加发展阶段"
              itemTitle={({ index }) => `阶段 ${index + 1}`}
              list={[
                <Input name="key" label="key" hidden />,
                <Input name="label" label="标签" rule="LEN-0-40" />,
                <Input name="period" label="周期" rule="LEN-0-40" />,
                <Select name="tone" label="色调" options={PLAN_TONES} />,
                <Input name="title" label="阶段标题" rule="LEN-0-80" />,
                <Input name="target" label="目标" rule="LEN-0-120" />,
                <TableList name="items" title="阶段条目" block addText="添加条目" list={[<Input name="tag" label="Tag" rule="LEN-0-8" />, <Input name="title" label="标题" />, <Input name="meta" label="补充" rule="LEN-0-120" />]} />
              ]}
            />
          ]}
        />
      </div>
    </AnalysisFormLayout>
  );
};

const CompletePositionAnalysisTask = createWithRemoteLoader({
  modules: ['components-core:Global@usePreset', 'components-core:FormInfo', 'components-admin:Editor']
})(({ remoteModules, data, onSuccess, children, ...props }) => {
  const [usePreset, FormInfo, Editor] = remoteModules;
  const { apis, ajax } = usePreset();
  const { message } = App.useApp();
  const useFormStepModal = FormInfo.useFormStepModal;
  const formStepModal = useFormStepModal();
  const [loading, setLoading] = useState(false);
  const fillLanguageRef = useRef('zh-CN');
  const rehydrateOnceRef = useRef({});
  const importBundleRef = useRef(null);

  const contextApi = useMemo(() => {
    const api = apis?.talentSaas?.tenant?.position?.analysisTaskContext;
    if (!api) {
      return null;
    }
    return Object.assign({}, api, { params: { taskId: data.id } });
  }, [apis, data.id]);

  const completeApi = apis?.talentSaas?.tenant?.position?.completeAnalysis;

  const openStepForm = async () => {
    if (!contextApi || !completeApi) {
      message.error('未配置 AI 岗位分析任务接口');
      return;
    }
    setLoading(true);
    try {
      rehydrateOnceRef.current = {};
      importBundleRef.current = { value: null, listeners: new Set() };
      const { data: resData } = await ajax(contextApi);
      if (resData.code !== 0) {
        throw new Error(resData.msg || '加载任务上下文失败');
      }
      const context = resData.data;
      const initial = buildInitialValues(context);
      const employeeCount = (context.employees || []).length;
      const fillApi = apis?.talentSaas?.tenant?.position?.analysisAiFill;
      const defaultLanguage = context?.position?.language === 'en-US' ? 'en-US' : 'zh-CN';
      fillLanguageRef.current = defaultLanguage;
      const aiFillProps = {
        taskId: data.id,
        ajax,
        fillApi,
        message,
        defaultLanguage,
        languageRef: fillLanguageRef
      };
      const contextEmployees = context.employees || [];
      const hasEmployees = employeeCount > 0;

      const orgStep = {
        title: '组织/部门',
        formProps: {
          data: initial.org,
          onSubmit: () => {}
        },
        children: <OrgStep FormInfo={FormInfo} aiFillProps={aiFillProps} context={context} importBundleRef={importBundleRef} />
      };

      const positionStep = {
        title: '岗位',
        formProps: {
          data: initial.position,
          onSubmit: hasEmployees
            ? data => validatePositionStep(data, message)
            : async (positionData, { stepCacheRef }) => {
                const org = stepCacheRef.current[0]?.data || {};
                return submitCompleteAnalysis({
                  taskId: data.id,
                  org,
                  positionRaw: positionData,
                  employeesInput: [],
                  contextEmployees,
                  ajax,
                  completeApi,
                  message,
                  onSuccess
                });
              }
        },
        children: <PositionStep FormInfo={FormInfo} Editor={Editor} aiFillProps={aiFillProps} context={context} rehydrateOnceRef={rehydrateOnceRef} importBundleRef={importBundleRef} />
      };

      const personStep = hasEmployees
        ? {
            title: '个人',
            formProps: {
              data: { employees: initial.employees },
              onSubmit: async (personData, { stepCacheRef }) => {
                const org = stepCacheRef.current[0]?.data || {};
                const positionRaw = stepCacheRef.current[1]?.data || {};
                return submitCompleteAnalysis({
                  taskId: data.id,
                  org,
                  positionRaw,
                  employeesInput: personData?.employees,
                  contextEmployees,
                  ajax,
                  completeApi,
                  message,
                  onSuccess
                });
              }
            },
            children: <PersonStep FormInfo={FormInfo} aiFillProps={aiFillProps} context={context} rehydrateOnceRef={rehydrateOnceRef} importBundleRef={importBundleRef} />
          }
        : null;

      formStepModal({
        title: '完成 AI 岗位分析',
        size: 'large',
        disabledScroller: true,
        completeText: '完成分析',
        nextText: '下一步',
        cancelText: '取消',
        items: hasEmployees ? [orgStep, positionStep, personStep] : [orgStep, positionStep]
      });
    } catch (e) {
      message.error(e.message || '打开完成任务表单失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button {...props} loading={loading} onClick={openStepForm}>
      {children || '完成'}
    </Button>
  );
});

export default CompletePositionAnalysisTask;
