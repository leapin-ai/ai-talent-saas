import { useMemo, useRef, useState } from 'react';
import { App, Button, Flex, Select, Typography } from 'antd';
import { createWithRemoteLoader } from '@kne/remote-loader';
import { CHANGE_VALUES, LEVEL_VALUES, ORIGIN_VALUES, createEmptySkill, createSkillId, normalizeSkills, normalizeVerdict } from '@components/Position/Detail/SkillList/skillModel';
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

const AiFillToolbar = ({ FormInfo, step, taskId, ajax, fillApi, message, defaultLanguage, languageRef }) => {
  const { FormApiButton } = FormInfo;
  const [loading, setLoading] = useState(false);
  const [language, setLanguage] = useState(() => languageRef?.current || defaultLanguage || 'zh-CN');

  if (!fillApi) {
    return null;
  }

  const changeLanguage = value => {
    setLanguage(value);
    if (languageRef) {
      languageRef.current = value;
    }
  };

  return (
    <Flex className={style['ai-fill-bar']} align="center" gap={12} wrap="wrap">
      <Flex align="center" gap={8}>
        <Typography.Text type="secondary">生成语言</Typography.Text>
        <Select size="small" style={{ width: 120 }} value={language || 'zh-CN'} options={AI_FILL_LANGUAGE_OPTIONS} disabled={loading} onChange={changeLanguage} />
      </Flex>
      <FormApiButton
        type="primary"
        ghost
        loading={loading}
        disabled={loading}
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
            // 嵌套 List/TableList：先垫满 3 阶段×3 条目槽位，再写入，避免 setFormData 丢中长期 items
            let payload = nextData;
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
            openApi.setFormData(Object.assign({}, formData, payload), false);
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
      <Typography.Text type="secondary">基于当前表单与岗位上下文生成，不会自动提交</Typography.Text>
    </Flex>
  );
};

const OrgStep = ({ FormInfo, aiFillProps }) => {
  const { Input } = FormInfo.fields;
  return (
    <div className={style.body}>
      <AiFillToolbar FormInfo={FormInfo} step="org" {...aiFillProps} />
      <FormInfo column={1} title="组织/部门" list={[<Input name="departmentName" label="部门" disabled key="departmentName" />, <Input name="tenantOrgId" label="tenantOrgId" hidden key="tenantOrgId" />]} />
    </div>
  );
};

const PositionStep = ({ FormInfo, aiFillProps }) => {
  const { List } = FormInfo;
  const { Input, TextArea, Select } = FormInfo.fields;
  return (
    <div className={style.body}>
      <AiFillToolbar FormInfo={FormInfo} step="position" {...aiFillProps} />
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
          <TextArea name="jd.text" label="JD 说明" block rule="LEN-0-2000" />,
          <Input name="jd.source" label="JD 来源" rule="LEN-0-200" />,
          <TextArea name="shockReport.text" label="冲击说明" block rule="LEN-0-2000" />,
          <Input name="shockReport.source" label="冲击来源" rule="LEN-0-200" />
        ]}
      />
      <FormInfo column={1} title="工作内容 / 要求" list={[<TextArea name="description" label="工作内容" block key="description" />, <TextArea name="requirement" label="工作要求" block key="requirement" />]} />
    </div>
  );
};

const PersonStep = ({ FormInfo, employeeCount, aiFillProps }) => {
  const { List, TableList } = FormInfo;
  const { Input, TextArea, Select, InputNumber } = FormInfo.fields;

  if (!employeeCount) {
    return <Typography.Text type="secondary">当前岗位暂无关联人员，完成时仅写回岗位分析结果。</Typography.Text>;
  }

  return (
    <div className={style.body}>
      <AiFillToolbar FormInfo={FormInfo} step="person" {...aiFillProps} />
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
  );
};

const CompletePositionAnalysisTask = createWithRemoteLoader({
  modules: ['components-core:Global@usePreset', 'components-core:FormInfo']
})(({ remoteModules, data, onSuccess, children, ...props }) => {
  const [usePreset, FormInfo] = remoteModules;
  const { apis, ajax } = usePreset();
  const { message } = App.useApp();
  const useFormStepModal = FormInfo.useFormStepModal;
  const formStepModal = useFormStepModal();
  const [loading, setLoading] = useState(false);
  const fillLanguageRef = useRef('zh-CN');

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

      formStepModal({
        title: '完成 AI 岗位分析',
        size: 'large',
        completeText: '完成分析',
        nextText: '下一步',
        cancelText: '取消',
        items: [
          {
            title: '组织/部门',
            formProps: {
              data: initial.org,
              onSubmit: () => {}
            },
            children: <OrgStep FormInfo={FormInfo} aiFillProps={aiFillProps} />
          },
          {
            title: '岗位',
            formProps: {
              data: initial.position,
              onSubmit: data => {
                if (!normalizeSkills(data?.skill).length) {
                  message.error('请至少填写一项有效岗位技能');
                  return false;
                }
              }
            },
            children: <PositionStep FormInfo={FormInfo} aiFillProps={aiFillProps} />
          },
          {
            title: '个人',
            formProps: {
              data: { employees: initial.employees },
              onSubmit: async (personData, { stepCacheRef }) => {
                const org = stepCacheRef.current[0]?.data || {};
                const positionRaw = stepCacheRef.current[1]?.data || {};
                const position = reshapePositionData(positionRaw);
                if (!position.skill.length) {
                  message.error('请至少填写一项有效岗位技能');
                  return false;
                }
                const contextEmployees = context.employees || [];
                const employees = reshapeEmployees(personData?.employees).map((item, index) =>
                  Object.assign({}, item, {
                    employeeId: item.employeeId || contextEmployees[index]?.id
                  })
                );
                if (employees.some(item => !item.employeeId)) {
                  message.error('人员数据缺少 employeeId，请关闭后重试');
                  return false;
                }

                const { data: submitRes } = await ajax(
                  Object.assign({}, completeApi, {
                    data: {
                      taskId: data.id,
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
              }
            },
            children: <PersonStep FormInfo={FormInfo} employeeCount={employeeCount} aiFillProps={aiFillProps} />
          }
        ]
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
