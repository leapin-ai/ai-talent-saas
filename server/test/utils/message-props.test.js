const test = require('node:test');
const assert = require('node:assert/strict');
const { prepareMessageProps } = require('../../libs/utils/messageProps');

test('非业务模板编码原样返回 props', () => {
  const props = { code: '123456' };
  assert.equal(prepareMessageProps({ code: 'UNKNOWN', props }), props);
  assert.equal(prepareMessageProps({ code: 'REGISTERCODE[zh-CN]', props }), props);
});

test('CANDIDATECODE 缺省主题色', () => {
  assert.equal(prepareMessageProps({ code: 'CANDIDATECODE[zh-CN]', props: {} }).themeColor, '#2A5CAA');
  assert.equal(prepareMessageProps({ code: 'CANDIDATECODE[zh-CN]', props: { themeColor: '#123456' } }).themeColor, '#123456');
});

test('问卷与采集邀请：主题与机构名派生', () => {
  const questionnaire = prepareMessageProps({ code: 'EMPLOYEEQUESTIONNAIRE[en-US]', props: { tenantName: 'T', projectName: 'P' } });
  assert.equal(questionnaire.orgName, 'T');
  assert.equal(questionnaire.teamDisplay, 'T');
  assert.equal(questionnaire.subjectText, 'T | Questionnaire: P');

  const collect = prepareMessageProps({ code: 'INVITETALENTCOLLECT[zh-CN]', props: { companyName: 'C', tenantName: 'T', isManager: true } });
  assert.equal(collect.orgName, 'C');
  assert.equal(collect.subjectText, 'C 人才队伍就绪度 | 经理岗位访谈');

  const custom = prepareMessageProps({ code: 'INVITETALENTCOLLECT[zh-CN]', props: { subject: '自定义', isManager: false } });
  assert.equal(custom.subjectText, '自定义');
});

test('分享报告：数量、首字、主题与缺省公司名', () => {
  const props = {
    isSelf: false,
    themeColor: '#111111',
    themeTint: '#222222',
    themeBorder: '#333333',
    items: [
      { name: 'abc', url: 'https://x.test/a' },
      { name: 'def', url: 'https://x.test/b' }
    ]
  };
  const en = prepareMessageProps({ code: 'SHARETALENTREPORT[en-US]', props });
  assert.equal(en.itemsCount, 2);
  assert.equal(en.peopleWord, 'people');
  assert.equal(en.itemsPlural, 's');
  assert.equal(en.companyOrWe, 'we');
  assert.equal(en.companyOrBrand, 'LeapIn');
  assert.equal(en.companyInitial, '·');
  assert.equal(en.subjectText, 'Talent Readiness Report');

  const zh = prepareMessageProps({ code: 'SHAREPOSITIONREPORT[zh-CN]', props: Object.assign({}, props, { companyName: '公司' }) });
  assert.equal(zh.companyOrWe, '公司');
  assert.equal(zh.companyInitial, '公');
  assert.equal(zh.subjectText, '公司 岗位洞察报告分享');
  assert.match(zh.itemsText, /abc\n查看报告：https:\/\/x\.test\/a\n/);
});

test('分享报告：用户输入在 itemsHtml 中被转义', () => {
  const props = { themeColor: '#111111', themeTint: '#222222', themeBorder: '#333333', items: [{ name: '<img src=x onerror=1>', department: 'a&b', url: 'https://x.test/?a=1&b="2"' }] };
  const { itemsHtml } = prepareMessageProps({ code: 'SHAREPOSITIONREPORT[zh-CN]', props });
  assert.ok(!itemsHtml.includes('<img'));
  assert.ok(itemsHtml.includes('&lt;img src=x onerror=1&gt;'));
  assert.ok(itemsHtml.includes('a&amp;b'));
  assert.ok(itemsHtml.includes('?a=1&amp;b=&quot;2&quot;'));
});

test('不修改传入的 props 对象', () => {
  const props = { companyName: 'C' };
  const result = prepareMessageProps({ code: 'INVITETENANT[zh-CN]', props });
  assert.notEqual(result, props);
  assert.equal(props.orgName, undefined);
});
