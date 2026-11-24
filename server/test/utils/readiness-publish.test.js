const test = require('node:test');
const assert = require('node:assert/strict');
const { buildProjectName, normalizeDeadline, deadlineEndTime, parseOptions, buildQuestionnaireSchema, buildInterviewQuestions, digitalsOf, moduleInfo } = require('../../libs/utils/readiness-publish');

// 2026-11-20 10:00 UTC+8
const NOW = Date.parse('2026-11-20T02:00:00.000Z');

test('项目名：roleName-YYYY-MM-DD（UTC+8）-毫秒时间戳', () => {
  assert.equal(buildProjectName('前端工程师', NOW), `前端工程师-2026-11-20-${NOW}`);
  // UTC 已是 11-19 的 17 点，北京时间已经是 11-20 凌晨
  const late = Date.parse('2026-11-19T17:30:00.000Z');
  assert.equal(buildProjectName(' PM ', late), `PM-2026-11-20-${late}`);
});

test('截止日期：必填、格式正确、不能早于今天（UTC+8），当天可选', () => {
  assert.equal(normalizeDeadline('2026-11-20', NOW), '2026-11-20');
  assert.equal(normalizeDeadline('2026-12-01T08:00:00.000Z', NOW), '2026-12-01');
  assert.throws(() => normalizeDeadline('', NOW), /请填写问卷截止日期/);
  assert.throws(() => normalizeDeadline(undefined, NOW), /请填写问卷截止日期/);
  assert.throws(() => normalizeDeadline('2026-11-19', NOW), /不能早于今天/);
  assert.throws(() => normalizeDeadline('not-a-date', NOW), /格式不正确/);
});

test('项目结束时间：截止日期当天 23:59:59.999（UTC+8）', () => {
  assert.equal(deadlineEndTime('2026-11-20'), '2026-11-20T15:59:59.999Z');
});

test('选项解析：上游 [{ label: 文案, value: 字母 }]，展示为 "字母. 文案"，value 保持字母', () => {
  assert.deepEqual(
    parseOptions([
      { label: 'Without it, the role cannot fulfill its duties', value: 'A' },
      { label: 'This work is not done now', value: 'F' }
    ]),
    [
      { label: 'A. Without it, the role cannot fulfill its duties', value: 'A' },
      { label: 'F. This work is not done now', value: 'F' }
    ]
  );
  assert.deepEqual(parseOptions([{ label: '其他', value: 'g' }, { label: '', value: 'H' }, { value: 'I' }]), [{ label: 'G. 其他', value: 'G' }]);
  assert.deepEqual(parseOptions(undefined), []);
  assert.deepEqual(parseOptions('A. 旧格式字符串'), []);
});

test('问卷 schema：按 module 分块，字段名=题号，题号写进题干，条件题配置 visibleWhen 且保持必填', () => {
  const schema = buildQuestionnaireSchema({
    language: 'zh-CN',
    questionnaire: [
      {
        no: 'Q01',
        type: 'single',
        question: '是否使用 AI',
        options: [
          { label: '是', value: 'A' },
          { label: '否', value: 'B' }
        ],
        module: '使用情况'
      },
      {
        no: 'Q02',
        type: 'multiple',
        question: '使用场景',
        options: [
          { label: '写作', value: 'A' },
          { label: '编码', value: 'B' }
        ],
        module: '使用情况',
        show_if: { no: 'Q01', op: 'in', values: ['A'] }
      },
      { no: 'Q03', type: 'open', question: '补充说明', module: '其他' },
      { no: '', question: '没有题号的会被忽略' }
    ]
  });
  assert.equal(schema.blocks.length, 2);
  assert.deepEqual(
    schema.blocks.map(block => [block.id, block.title, block.kind, block.column]),
    [
      ['block-1', '使用情况', 'formInfo', 1],
      ['block-2', '其他', 'formInfo', 1]
    ]
  );
  const [q1, q2] = schema.blocks[0].list;
  assert.equal(q1.name, 'Q01');
  assert.equal(q1.label, 'Q01. 是否使用 AI');
  assert.equal(q1.type, 'RadioGroup');
  assert.equal(q1.rule, 'REQ');
  assert.equal(q1.visibleWhen, undefined);
  assert.deepEqual(q1.props.options, [
    { label: 'A. 是', value: 'A' },
    { label: 'B. 否', value: 'B' }
  ]);
  assert.equal(q2.type, 'CheckboxGroup');
  assert.equal(q2.rule, 'REQ');
  assert.equal(q2.description, undefined);
  assert.deepEqual(q2.visibleWhen, { logic: 'and', conditions: [{ field: 'Q01', operator: 'in', value: ['A'] }] });
  const q3 = schema.blocks[1].list[0];
  assert.equal(q3.type, 'TextArea');
  assert.equal(q3.rule, 'REQ');
});

test('问卷 schema：前序题是多选用 includesAny，eq 与 in 同判，not_in 用 neq，选项字母统一大写', () => {
  const [, multi, eq, , negative] = buildQuestionnaireSchema({
    language: 'zh-CN',
    questionnaire: [
      {
        no: 'Q1',
        type: 'multiple',
        question: '多选',
        options: [
          { label: 'a', value: 'A' },
          { label: 'b', value: 'B' },
          { label: 'c', value: 'C' }
        ]
      },
      { no: 'Q2', type: 'open', question: '追问', show_if: { no: 'Q1', op: 'in', values: ['a', 'B'] } },
      { no: 'Q3', type: 'open', question: '同判', show_if: { no: 'Q4', op: 'eq', values: ['A'] } },
      {
        no: 'Q4',
        type: 'single',
        question: '单选',
        options: [
          { label: 'a', value: 'A' },
          { label: 'b', value: 'B' },
          { label: 'c', value: 'C' }
        ]
      },
      { no: 'Q5', type: 'open', question: '否则', show_if: { no: 'Q4', op: 'not_in', values: ['A', 'B'] } }
    ]
  }).blocks[0].list;
  assert.deepEqual(multi.visibleWhen, { logic: 'and', conditions: [{ field: 'Q1', operator: 'includesAny', value: ['A', 'B'] }] });
  assert.deepEqual(eq.visibleWhen, { logic: 'and', conditions: [{ field: 'Q4', operator: 'in', value: ['A'] }] });
  assert.deepEqual(negative.visibleWhen, {
    logic: 'and',
    conditions: [
      { field: 'Q4', operator: 'neq', value: 'A' },
      { field: 'Q4', operator: 'neq', value: 'B' }
    ]
  });
});

test('问卷 schema：条件题紧跟依赖它的题，不按 module 全局归并（上游同题组各题 module 不同）', () => {
  const group = (n, trigger) => [
    {
      no: `Q${n}1`,
      type: 'single',
      question: 'a',
      options: [
        { label: 'x', value: 'A' },
        { label: 'y', value: 'B' }
      ],
      module: 'Confirm · task'
    },
    { no: `Q${n}2`, type: 'single', question: 'b', options: [{ label: 'x', value: 'A' }], module: 'Trigger · Impact', show_if: { no: `Q${n}1`, op: 'in', values: ['A'] } },
    { no: `Q${n}3`, type: 'single', question: 'c', options: [{ label: 'x', value: 'A' }], module: 'Trigger · Change', show_if: { no: `Q${n}1`, op: 'in', values: ['A'] } }
  ];
  const { blocks } = buildQuestionnaireSchema({ language: 'zh-CN', questionnaire: [...group(1), ...group(2), { no: 'Z1', type: 'open', question: '末尾', module: 'Other' }] });
  assert.equal(blocks.length, 2);
  assert.deepEqual(
    blocks[0].list.map(field => field.name),
    ['Q11', 'Q12', 'Q13', 'Q21', 'Q22', 'Q23']
  );
  assert.deepEqual(
    blocks[1].list.map(field => field.name),
    ['Z1']
  );
});

test('问卷 schema：条件无法表达（前序题缺失、多选 + not_in、未知 op）时降级为选填并带文字说明', () => {
  const list = buildQuestionnaireSchema({
    language: 'zh-CN',
    questionnaire: [
      {
        no: 'Q1',
        type: 'multiple',
        question: '多选',
        options: [
          { label: 'a', value: 'A' },
          { label: 'b', value: 'B' }
        ]
      },
      { no: 'Q2', type: 'open', question: '缺失前序题', show_if: { no: 'Q9', op: 'in', values: ['A'] } },
      { no: 'Q3', type: 'open', question: '多选取反', show_if: { no: 'Q1', op: 'not_in', values: ['A'] } },
      { no: 'Q4', type: 'open', question: '未知 op', show_if: { no: 'Q1', op: 'gt', values: ['A'] } }
    ]
  }).blocks[0].list;
  for (const field of list.slice(1)) {
    assert.equal(field.visibleWhen, undefined);
    assert.equal(field.rule, undefined);
  }
  assert.equal(list[1].description, '仅当第 Q9 题选择 A 时作答');
  assert.equal(list[2].description, '仅当第 Q1 题未选择 A 时作答');
});

test('问卷 schema：英文降级提示文案', () => {
  const [field] = buildQuestionnaireSchema({ language: 'en-US', questionnaire: [{ no: 'Q2', type: 'single', question: 'x', options: [{ label: 'a', value: 'A' }], show_if: { no: 'Q1', values: ['A', 'B'] } }] }).blocks[0].list;
  assert.equal(field.description, 'Answer only if Q1 is A, B');
});

test('访谈题：转成视频作答的数据采集题，评分设计与追问方向进入判定规则', () => {
  const list = buildInterviewQuestions({
    language: 'zh-CN',
    interview: [
      { no: 'I01', question: '请描述一天的工作', design: '了解任务构成', options: [{ label: '追问频率' }, { label: '追问工具' }] },
      { no: 'I02', question: '' }
    ]
  });
  assert.equal(list.length, 1);
  assert.equal(list[0].no, 'I01');
  assert.deepEqual(list[0].body, {
    title: '请描述一天的工作',
    type: 'main',
    language: 'zh-CN',
    answerType: 'video',
    enableDataCollection: true,
    determinant: '了解任务构成\n\n追问方向：\n追问频率\n追问工具'
  });
});

test('数字人：整理成 { id, name, language }，忽略没有 ID 的项', () => {
  const items = [{ digitalId: '1', digital: { id: '1', name: 'Emma', language: 'en-US' } }, { digital: { id: '2', name: '小智', language: 'zh-CN' } }, { digital: {} }];
  assert.deepEqual(digitalsOf(items), [
    { id: '1', name: 'Emma', language: 'en-US' },
    { id: '2', name: '小智', language: 'zh-CN' }
  ]);
  assert.deepEqual(digitalsOf(undefined), []);
});

test('上游内部分组码换成通俗标题，未收录的原样展示', () => {
  assert.deepEqual(moduleInfo('Trigger · Impact', 'zh-CN'), { title: '工作量变化', description: '与以前相比，这项工作对团队来说是变重了还是变轻了' });
  assert.equal(moduleInfo('trigger  ·  change', 'zh-CN').title, '做法变化（含 AI 影响）');
  assert.equal(moduleInfo('Confirm · task', 'en-US').title, 'Role duties');
  assert.deepEqual(moduleInfo('使用情况', 'zh-CN'), { title: '使用情况', description: '' });
  assert.deepEqual(moduleInfo(undefined, 'zh-CN'), { title: '', description: '' });
  const schema = buildQuestionnaireSchema({ language: 'zh-CN', questionnaire: [{ no: 'Q01', type: 'single', question: 'x', options: [{ label: 'a', value: 'A' }], module: 'Trigger · Impact' }] });
  assert.equal(schema.blocks[0].title, '工作量变化');
});

test('问卷 schema：中文题型「单选 / 多选」转成单选 / 多选字段', () => {
  const options = [
    { label: '是', value: 'A' },
    { label: '否', value: 'B' }
  ];
  const [single, multiple, follow] = buildQuestionnaireSchema({
    language: 'zh-CN',
    questionnaire: [
      { no: 'Q01', type: '单选', question: 'q1', options },
      { no: 'Q02', type: '多选', question: 'q2', options },
      { no: 'Q03', type: 'open', question: 'q3', show_if: { no: 'Q02', op: 'in', values: ['B'] } }
    ]
  }).blocks[0].list;
  assert.equal(single.type, 'RadioGroup');
  assert.equal(multiple.type, 'CheckboxGroup');
  assert.deepEqual(follow.visibleWhen, { logic: 'and', conditions: [{ field: 'Q02', operator: 'includesAny', value: ['B'] }] });
});
