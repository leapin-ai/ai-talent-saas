import dayjs from 'dayjs';
import { getDefaultCellMap } from '../constants';

let seed = 0;
export const uid = prefix => `${prefix}_${Date.now().toString(36)}_${(seed++).toString(36)}`;

export const createDimension = () => ({ key: uid('dim'), type: undefined, modelId: undefined, modelName: '', selected: {} });

export const createQuestion = () => ({ key: uid('q'), title: '', type: 'RadioGroup', required: true, options: [] });

export const initialValue = () => ({
  info: {},
  questions: [],
  dimensions: [createDimension()],
  groupOrder: [],
  performance: { enable: true, scoreScale: 100 },
  assessment: {
    enableManualScore: false,
    ai: 50,
    manual: 50,
    superior: 50,
    peer: 50,
    gridType: 9,
    nineSquareGrid: {}
  }
});

export const UNGROUPED = '__ungrouped__';

/** 题目所属模型分组：选题面板与编辑回填共用，保证预览按同一 groupName 聚合 */
export const questionGroup = (question, model, ungroupedLabel) => {
  const group = (question?.groups || [])[0];
  const code = !group ? UNGROUPED : typeof group === 'object' ? group.code || group.name || UNGROUPED : group;
  const fallback = group && typeof group === 'object' ? group.name : undefined;
  const name = (model?.groups || []).find(item => item.code === code)?.name || fallback || (code === UNGROUPED ? ungroupedLabel : code);
  return { code, name };
};

const QUESTION_TYPE_VALUES = ['RadioGroup', 'CheckboxGroup', 'TextArea'];

/** 问卷 schema → 对象信息题目卡片；含卡片无法表达的结构（多分组、其它字段类型）时返回 null，编辑时保持原问卷不动 */
export const questionnaireToQuestions = questionnaire => {
  if (!questionnaire?.enabled) return [];
  const blocks = questionnaire.schema?.blocks || [];
  if (blocks.length > 1 || blocks.some(block => block.kind !== 'formInfo')) return null;
  const list = blocks[0]?.list || [];
  if (list.some(field => !QUESTION_TYPE_VALUES.includes(field.type))) return null;
  return list.map(field => ({
    key: field.id || uid('q'),
    title: field.label || '',
    type: field.type,
    required: /\bREQ\b/.test(field.rule || ''),
    options: (field.props?.options || []).map(item => (typeof item === 'object' ? item.label : item)).filter(Boolean)
  }));
};

const toPercent = (value, fallback) => Math.round(Number(value == null ? fallback : value) * 100);

/** 项目详情 → 向导表单值（编辑回填）；models 用于还原题目分组名 */
export const projectToValue = (project, { models = [], ungroupedLabel } = {}) => {
  const setting = project.setting || {};
  const rows = [...(project.projectQuestions || [])].sort((a, b) => (a.index || 0) - (b.index || 0));
  const dimensionList = (setting.dimensions || []).filter(item => item?.type);
  const groupOrder = [];
  const dimensions = dimensionList.map(dim => {
    const model = models.find(item => String(item.id) === String(dim.questionModelId));
    const selected = {};
    rows.forEach(row => {
      const types = row.options?.projectDimension;
      if (Array.isArray(types) ? !types.includes(dim.type) : dimensionList.length > 1) return;
      const question = row.questionDigital?.question || {};
      const groupName = questionGroup(question, model, ungroupedLabel).name;
      selected[String(row.questionDigitalId)] = { title: question.title || row.questionDigital?.title || '', answerType: question.answerType, groupName };
      const key = `${dim.type}-${groupName}`;
      if (!groupOrder.includes(key)) groupOrder.push(key);
    });
    return { key: uid('dim'), type: dim.type, modelId: dim.questionModelId ? String(dim.questionModelId) : undefined, modelName: dim.questionModelName || model?.name || '', selected };
  });
  const questions = questionnaireToQuestions(setting.questionnaire);
  const nineSquareGrid = setting.nineSquareGrid || {};
  const { type: gridType, ...gridCells } = nineSquareGrid;
  return {
    info: {
      name: project.name,
      period: project.startTime && project.endTime ? [dayjs(project.startTime), dayjs(project.endTime)] : undefined,
      language: project.language,
      owner: setting.owner ? { value: setting.owner.id, label: setting.owner.name } : undefined,
      description: project.description
    },
    questions: questions || [],
    questionnaireLocked: questions === null,
    dimensions: dimensions.length ? dimensions : [createDimension()],
    groupOrder,
    performance: { enable: setting.enablePerformance !== false, scoreScale: Number(setting.scoreScale) === 5 ? 5 : 100 },
    assessment: {
      enableManualScore: !!setting.enableManualScore,
      ai: toPercent(setting.scoreSourceWeight?.ai, 1),
      manual: toPercent(setting.scoreSourceWeight?.manual, 0),
      superior: toPercent(setting.manualRoleWeight?.superior, 0.5),
      peer: toPercent(setting.manualRoleWeight?.peer, 0.5),
      gridType: Number(gridType) === 4 ? 4 : 9,
      nineSquareGrid: gridCells
    }
  };
};

/** 对象信息题目 → 面试前问卷，结构与 AI 面试 FormCreator schema 一致 */
export const buildQuestionnaire = (questions, title) => {
  const list = questions
    .filter(item => item.title)
    .map((item, index) => ({
      id: item.key,
      type: item.type,
      name: `q_${index + 1}`,
      label: item.title,
      tips: '',
      description: '',
      rule: item.required ? 'REQ' : '',
      block: true,
      hidden: false,
      props: ['RadioGroup', 'CheckboxGroup'].includes(item.type) ? { inline: false, options: item.options.filter(Boolean).map(label => ({ label, value: label })) } : item.type === 'TextArea' ? { rows: 3 } : {}
    }));
  if (!list.length) {
    return { enabled: false };
  }
  return {
    enabled: true,
    timing: 'before',
    title,
    description: '',
    schema: {
      title: '',
      subtitle: '',
      column: 1,
      gap: 24,
      blocks: [{ id: 'objectInfo', kind: 'formInfo', title: '', subtitle: '', column: 1, gap: 24, list }],
      actions: { showSubmit: true, showReset: false, showCancel: false, submitText: '', resetText: '', cancelText: '', align: 'center', gap: 16 }
    }
  };
};

/** 用户编辑过的格子覆盖默认文案后写入 setting.nineSquareGrid */
export const buildNineSquareGrid = (assessment, dimensionTypes, locale) => {
  const gridType = String(assessment.gridType);
  const result = { type: assessment.gridType };
  dimensionTypes.forEach(type => {
    const cells = Object.assign({}, getDefaultCellMap(gridType, type, locale), assessment.nineSquareGrid?.[type]?.cells?.[gridType]);
    result[type] = { cells: { [gridType]: cells } };
  });
  return result;
};

const fraction = value => Math.round(Number(value || 0)) / 100;

/** 已选题目按「维度 + 题目分组」聚合，并按 groupOrder（拖拽结果）排序 */
export const buildPreviewGroups = (dimensions, groupOrder = []) => {
  const groups = [];
  dimensions
    .filter(dim => dim.type)
    .forEach(dim => {
      Object.keys(dim.selected)
        .filter(id => dim.selected[id])
        .forEach(id => {
          const meta = dim.selected[id];
          const key = `${dim.type}-${meta.groupName}`;
          let group = groups.find(item => item.key === key);
          if (!group) {
            group = { key, type: dim.type, name: meta.groupName, list: [] };
            groups.push(group);
          }
          group.list.push(Object.assign({}, meta, { id }));
        });
    });
  const rank = key => {
    const index = groupOrder.indexOf(key);
    return index === -1 ? Number.MAX_SAFE_INTEGER : index;
  };
  return groups
    .map((group, index) => ({ group, index }))
    .sort((a, b) => rank(a.group.key) - rank(b.group.key) || a.index - b.index)
    .map(item => item.group);
};

export const buildPayload = (value, { locale, questionnaireTitle, dimensionName }) => {
  const { info, questions, dimensions, performance, assessment } = value;
  const usedDimensions = dimensions.filter(item => item.type && item.modelId);
  const types = usedDimensions.map(item => item.type);
  const equalWeight = types.length ? Math.round((1 / types.length) * 100) / 100 : 0;
  const questionList = [];
  buildPreviewGroups(usedDimensions, value.groupOrder).forEach(group => {
    group.list.forEach(({ id: questionDigitalId }) => {
      const exists = questionList.find(item => item.questionDigitalId === questionDigitalId);
      if (exists) {
        if (!exists.dimensionTypes.includes(group.type)) exists.dimensionTypes.push(group.type);
      } else {
        questionList.push({ questionDigitalId, dimensionTypes: [group.type] });
      }
    });
  });
  const [start, end] = (info.period || []).map(item => (item ? dayjs(item) : item));
  return {
    name: info.name,
    language: info.language,
    description: info.description,
    startTime: start ? start.startOf('day').toISOString() : undefined,
    endTime: end ? end.endOf('day').toISOString() : undefined,
    questionModelId: String(usedDimensions[0]?.modelId || ''),
    questions: questionList,
    setting: {
      owner: info.owner ? { id: info.owner.value, name: info.owner.label } : undefined,
      dimensions: usedDimensions.map(item => ({ type: item.type, name: dimensionName(item.type), questionModelId: item.modelId, questionModelName: item.modelName })),
      dimensionWeight: types.reduce((result, type) => Object.assign(result, { [type]: equalWeight }), {}),
      enablePerformance: performance.enable,
      scoreScale: performance.scoreScale,
      enableManualScore: assessment.enableManualScore,
      scoreSourceWeight: assessment.enableManualScore ? { ai: fraction(assessment.ai), manual: fraction(assessment.manual) } : { ai: 1, manual: 0 },
      manualRoleWeight: { superior: fraction(assessment.superior), peer: fraction(assessment.peer), subordinate: 0 },
      nineSquareGrid: buildNineSquareGrid(assessment, types, locale),
      questionnaire: buildQuestionnaire(questions, questionnaireTitle)
    }
  };
};
