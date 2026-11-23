/**
 * 确认问卷后发布到 AI 面试的纯函数：
 *   访谈题（interview）→ 题库问题；问卷题（questionnaire）→ 项目问卷 schema；
 *   截止日期、项目命名、数字人挑选。
 */
const dayjs = require('dayjs');
const utc = require('dayjs/plugin/utc');
const timezone = require('dayjs/plugin/timezone');

dayjs.extend(utc);
dayjs.extend(timezone);

const DISPLAY_TZ = 'Asia/Shanghai';
// 中文问卷的题型为「单选 / 多选」
const SINGLE_TYPES = ['single', 'radio', '单选'];
const MULTIPLE_TYPES = ['multiple', 'multi', 'checkbox', '多选'];

const asArray = value => (Array.isArray(value) ? value : []);
const text = value => (value == null ? '' : String(value).trim());

/** 项目名：roleName-YYYY-MM-DD-毫秒时间戳 */
const buildProjectName = (roleName, now = Date.now()) => `${text(roleName)}-${dayjs(now).tz(DISPLAY_TZ).format('YYYY-MM-DD')}-${dayjs(now).valueOf()}`;

/** 截止日期规范为 YYYY-MM-DD（UTC+8）；必填，且不能早于今天 */
const normalizeDeadline = (value, now = Date.now()) => {
  if (value == null || value === '') {
    throw new Error('请填写问卷截止日期');
  }
  const parsed = dayjs.tz(typeof value === 'string' ? value.slice(0, 10) : value, DISPLAY_TZ);
  if (!parsed.isValid()) {
    throw new Error('问卷截止日期格式不正确');
  }
  if (parsed.startOf('day').isBefore(dayjs(now).tz(DISPLAY_TZ).startOf('day'))) {
    throw new Error('问卷截止日期不能早于今天');
  }
  return parsed.format('YYYY-MM-DD');
};

/** 截止日期当天 23:59:59.999（UTC+8）对应的 ISO 时间 */
const deadlineEndTime = deadline => dayjs.tz(deadline, DISPLAY_TZ).endOf('day').toISOString();

/** 上游选项：[{ label: '选项文案', value: 'A' }]；value 为字母，与 show_if.values 对齐，展示为 "A. 文案"；非数组视为无选项 */
const parseOptions = value =>
  asArray(value)
    .map(item => ({ label: text(item?.label), value: text(item?.value).toUpperCase() }))
    .filter(option => option.label && option.value)
    .map(option => ({ label: `${option.value}. ${option.label}`, value: option.value }));

/**
 * 上游问卷的 module 是内部分组码（如 "Trigger · Impact"），受访人和确认人都看不懂，展示时换成通俗标题与一句话说明。
 * 未收录的 module 原样展示。
 */
const MODULE_INFO = {
  'confirm · task': {
    'zh-CN': { title: '岗位职责确认', description: '确认这项工作是否属于该岗位的职责，以及它有多重要' },
    'en-US': { title: 'Role duties', description: 'Confirm whether this work belongs to the role and how important it is' }
  },
  'trigger · impact': {
    'zh-CN': { title: '工作量变化', description: '与以前相比，这项工作对团队来说是变重了还是变轻了' },
    'en-US': { title: 'Workload change', description: 'Compared with before, is this work heavier or lighter for the team' }
  },
  'trigger · change': {
    'zh-CN': { title: '做法变化（含 AI 影响）', description: '这项工作的完成方式与以前相比有没有变化，例如是否已由 AI 协助' },
    'en-US': { title: 'Change in approach (incl. AI)', description: 'Has the way this work is done changed, for example with AI assistance' }
  }
};

const moduleInfo = (module, language) => {
  const raw = text(module);
  const info = MODULE_INFO[raw.toLowerCase().replace(/\s+/g, ' ')]?.[language === 'en-US' ? 'en-US' : 'zh-CN'];
  return { title: info?.title || raw, description: info?.description || '' };
};

// show_if.op：in / eq（与 in 同判）= 依赖题答案字母落在 values 里才显示；not_in = 不在 values 里才显示
const NEGATIVE_OPS = ['not_in'];
const POSITIVE_OPS = ['in', 'eq'];
const showIfOp = showIf => text(showIf?.op).toLowerCase() || 'in';

const showIfHint = (showIf, language) => {
  if (!showIf || !showIf.no) {
    return '';
  }
  const en = language === 'en-US';
  const values = asArray(showIf.values).join(en ? ', ' : '、');
  if (NEGATIVE_OPS.includes(showIfOp(showIf))) {
    return en ? `Answer only if ${showIf.no} is not ${values}` : `仅当第 ${showIf.no} 题未选择 ${values} 时作答`;
  }
  return en ? `Answer only if ${showIf.no} is ${values}` : `仅当第 ${showIf.no} 题选择 ${values} 时作答`;
};

/**
 * show_if（前序题选了哪些选项才出现）→ form-creator 字段 visibleWhen。
 * 选项值是字母（A/B/…），与 parseOptions 的 value 一致；op：in / eq → 单选前序题用 in，多选前序题用 includesAny；not_in → 单选前序题每个值一条 neq。
 * 前序题不在问卷里、op 不认识、或 not_in 遇上多选前序题（无对应运算符）时返回 null，调用方降级为选填 + 文字说明。
 */
const buildVisibleWhen = (showIf, typeByNo) => {
  const field = text(showIf?.no);
  const values = asArray(showIf?.values)
    .map(value => text(value).toUpperCase())
    .filter(Boolean);
  const sourceType = typeByNo.get(field);
  if (!field || !values.length || !sourceType) {
    return null;
  }
  const multiple = MULTIPLE_TYPES.includes(sourceType);
  const op = showIfOp(showIf);
  if (POSITIVE_OPS.includes(op)) {
    return { logic: 'and', conditions: [{ field, operator: multiple ? 'includesAny' : 'in', value: values }] };
  }
  if (NEGATIVE_OPS.includes(op) && !multiple) {
    return { logic: 'and', conditions: values.map(value => ({ field, operator: 'neq', value })) };
  }
  return null;
};

const buildField = (item, language, typeByNo) => {
  const type = text(item.type).toLowerCase();
  const options = parseOptions(item.options);
  // 题号写进题干：受访人看到的序号与确认页、条件说明一致（form-creator 的 showIndex 按区块内位置编号，与题号对不上）
  const base = { name: text(item.no), label: `${text(item.no)}. ${text(item.question)}`, block: true };
  const visibleWhen = item.show_if ? buildVisibleWhen(item.show_if, typeByNo) : null;
  // 条件成立才显示、显示后必填；条件无法表达时降级为选填并在题下说明作答条件
  const hint = item.show_if && !visibleWhen ? showIfHint(item.show_if, language) : '';
  const required = item.show_if && !visibleWhen ? {} : { rule: 'REQ' };
  const description = hint ? { description: hint } : {};
  const condition = visibleWhen ? { visibleWhen } : {};
  if (options.length && SINGLE_TYPES.includes(type)) {
    return Object.assign(base, required, description, condition, { type: 'RadioGroup', props: { inline: false, options } });
  }
  if (options.length && MULTIPLE_TYPES.includes(type)) {
    return Object.assign(base, required, description, condition, { type: 'CheckboxGroup', props: { inline: false, options } });
  }
  return Object.assign(base, required, description, condition, { type: 'TextArea', props: { rows: 3 } });
};

/**
 * 问卷题 → FormCreator schema：字段名 = 题号，提交的答卷即「题号 → 答」。
 * 保持上游题序：条件题（show_if 指向问卷里的前序题）紧跟在当前区块里；
 * 无条件的题 module 与当前区块不同时才另起区块（module 即区块标题）。
 * 不能按 module 全局归并：上游同一题组（Q01/Q02/Q03）的 module 各不相同，归并后条件题会被甩到别的区块、离触发题很远。
 */
const buildQuestionnaireSchema = ({ questionnaire, language }) => {
  const blocks = [];
  const items = asArray(questionnaire).filter(item => text(item?.no) && text(item?.question));
  // 条件题的前序题类型：决定用单选还是多选的比较运算符；只有「有选项的单选/多选」才可能成为触发题
  const typeByNo = new Map(items.map(item => [text(item.no), parseOptions(item.options).length ? text(item.type).toLowerCase() : '']));
  let current = null;
  let currentModule = null;
  items.forEach(item => {
    const follows = current && item.show_if && typeByNo.has(text(item.show_if.no));
    const module = text(item.module);
    if (!follows && (!current || module !== currentModule)) {
      current = { id: `block-${blocks.length + 1}`, kind: 'formInfo', title: moduleInfo(module, language).title, column: 1, list: [] };
      currentModule = module;
      blocks.push(current);
    }
    current.list.push(buildField(item, language, typeByNo));
  });
  return { blocks };
};

/** 访谈题 → 题库问题入参（视频作答、数据采集场景）；评分设计与追问方向写入判定规则供模型使用 */
const buildInterviewQuestions = ({ interview, language }) =>
  asArray(interview)
    .filter(item => text(item?.question))
    .map(item => {
      const follow = asArray(item.options)
        .map(option => text(option?.label))
        .filter(Boolean);
      const determinant = [text(item.design), follow.length ? `${language === 'en-US' ? 'Follow-up directions' : '追问方向'}：\n${follow.join('\n')}` : ''].filter(Boolean).join('\n\n');
      return {
        no: text(item.no),
        body: Object.assign({ title: text(item.question), type: 'main', language, answerType: 'video', enableDataCollection: true }, determinant ? { determinant } : {})
      };
    });

/** AI 面试客户已分配的数字人 → [{ id, name, language }]，供确认时选择与发布前校验 */
const digitalsOf = items =>
  asArray(items)
    .filter(item => item?.digitalId || item?.digital?.id)
    .map(item => ({ id: String(item.digitalId || item.digital.id), name: text(item.digital?.name), language: text(item.digital?.language) }));

module.exports = { DISPLAY_TZ, moduleInfo, buildProjectName, normalizeDeadline, deadlineEndTime, parseOptions, buildQuestionnaireSchema, buildInterviewQuestions, digitalsOf };
