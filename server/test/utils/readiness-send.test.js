const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizeRecipients, groupItemsByEmail, classifyRuns } = require('../../libs/utils/readiness-send');
const { prepareMessageProps } = require('../../libs/utils/messageProps');

test('收件人去重（忽略大小写）并分出无效邮箱', () => {
  const { valid, invalid } = normalizeRecipients([{ name: 'A', email: 'a@x.com' }, { name: 'A2', email: 'A@X.com ' }, { email: 'bad' }, { email: '' }, { email: 'b@x.com' }]);
  assert.deepEqual(valid, [
    { name: 'A', email: 'a@x.com', employeeId: null },
    { name: 'b@x.com', email: 'b@x.com', employeeId: null }
  ]);
  assert.deepEqual(invalid, [{ name: '', email: 'bad' }]);
  assert.equal(normalizeRecipients([{ email: 'c@x.com', employeeId: 7 }]).valid[0].employeeId, '7');
});

test('同一邮箱的多个 Role 聚合成一封邮件', () => {
  const groups = groupItemsByEmail([
    { email: 'a@x.com', name: 'A', runId: '1', roleName: '前端', url: 'u1' },
    { email: 'b@x.com', name: 'B', runId: '1', roleName: '前端', url: 'u2' },
    { email: 'A@x.com', name: 'A', runId: '2', roleName: '后端', url: 'u3' },
    { email: 'a@x.com', name: 'A', runId: '2', roleName: '后端', url: 'u3' }
  ]);
  assert.equal(groups.length, 2);
  assert.deepEqual(groups[0].items, [
    { runId: '1', name: '前端', url: 'u1' },
    { runId: '2', name: '后端', url: 'u3' }
  ]);
  assert.equal(groups[1].items.length, 1);
});

test('Role 之间独立：未确认的只被跳过，不拖累其它 Role', () => {
  const runs = [
    { id: '1', roleName: '前端', stage: 'manager_send' },
    { id: '2', roleName: '后端', stage: 'manager_confirm' },
    { id: '3', roleName: '测试', stage: 'manager_send' }
  ];
  const { eligible, skipped } = classifyRuns(runs, run => (run.stage === 'manager_send' ? '' : '尚未确认'));
  assert.deepEqual(
    eligible.map(run => run.id),
    ['1', '3']
  );
  assert.deepEqual(skipped, [{ runId: '2', roleName: '后端', reason: '尚未确认' }]);
});

test('READINESSQUESTIONNAIRE 邮件派生：标题、按钮文案与链接', () => {
  const props = {
    companyName: '乐聘',
    themeColor: '#123456',
    themeTint: '#eef',
    themeBorder: '#ddd',
    items: [
      { name: '前端 <工程师>', url: 'http://i/invite?nl=abc' },
      { name: '后端', url: 'http://i/invite?nl=def' }
    ]
  };
  const zh = prepareMessageProps({ code: 'READINESSQUESTIONNAIRE[zh-CN]', props });
  assert.equal(zh.itemsCount, 2);
  assert.match(zh.subjectText, /岗位就绪度问卷/);
  assert.match(zh.itemsHtml, /填写问卷/);
  assert.match(zh.itemsHtml, /前端 &lt;工程师&gt;/);
  assert.match(zh.itemsText, /http:\/\/i\/invite\?nl=def/);
  const en = prepareMessageProps({ code: 'READINESSQUESTIONNAIRE[en-US]', props });
  assert.match(en.itemsHtml, /Fill in questionnaire/);
  assert.match(en.subjectText, /Role Readiness Questionnaire/);
});

test('READINESSCONFIRM 邮件派生：共用入口按钮与岗位列表', () => {
  const props = {
    companyName: '乐聘',
    themeColor: '#123456',
    themeTint: '#eef',
    themeBorder: '#ddd',
    items: [{ name: '前端工程师' }, { name: '后端工程师' }],
    sharedConfirmUrl: 'http://i/readiness-confirm?code=abc'
  };
  const zh = prepareMessageProps({ code: 'READINESSCONFIRM[zh-CN]', props });
  assert.match(zh.subjectText, /请确认岗位就绪度问卷/);
  assert.match(zh.itemsHtml, /前端工程师/);
  assert.match(zh.itemsHtml, /后端工程师/);
  assert.doesNotMatch(zh.itemsHtml, /readiness-confirm\?code=abc/);
  assert.match(zh.confirmCtaHtml, /确认问卷/);
  assert.match(zh.confirmCtaHtml, /readiness-confirm\?code=abc/);
  assert.match(zh.itemsText, /确认问卷：http:\/\/i\/readiness-confirm\?code=abc/);
  const en = prepareMessageProps({ code: 'READINESSCONFIRM[en-US]', props });
  assert.match(en.confirmCtaHtml, /Confirm questionnaire/);
});
