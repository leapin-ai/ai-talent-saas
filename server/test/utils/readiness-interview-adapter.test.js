const test = require('node:test');
const assert = require('node:assert/strict');
const { createAdapter } = require('../../libs/utils/readiness-interview-adapter');

const fakeServices = ({ rows, details, pageSize = 2 }) => {
  const calls = { list: [], detail: [] };
  return {
    calls,
    services: {
      aiInterview: {
        getInterviewList: async ({ currentPage, perPage }) => {
          calls.list.push({ currentPage, perPage });
          // 模拟 open-api 上限：每页最多 pageSize 条，忽略请求的 perPage
          const start = (currentPage - 1) * pageSize;
          return { pageData: rows.slice(start, start + pageSize), totalCount: rows.length };
        },
        getInterviewDetail: async ({ id }) => {
          calls.detail.push(id);
          return details[id];
        }
      }
    }
  };
};

test('回收答卷：按免登录码对上邀请，只取已提交且有答案的问卷', async () => {
  const rows = [
    { id: 'c1', code: 'sh-a' },
    { id: 'c2', code: 'sh-b' },
    { id: 'c3', code: 'sh-c' }
  ];
  const details = {
    c1: { options: { questionnaire: { submittedAt: '2026-11-20T00:00:00.000Z', answers: { Q01: 'A' } } } },
    c2: { options: { questionnaire: { answers: { Q01: 'B' } } } },
    c3: { options: { questionnaire: { submittedAt: '2026-11-20T00:00:00.000Z', answers: {} } } }
  };
  const { services, calls } = fakeServices({ rows, details });
  const adapter = createAdapter({ services });
  const result = await adapter.collectAnswers({
    tenantId: 't1',
    projectId: 'p1',
    invites: [
      { inviteId: 'i1', shorten: 'sh-a' },
      { inviteId: 'i2', shorten: 'sh-b' },
      { inviteId: 'i3', shorten: 'sh-c' },
      { inviteId: 'i4', shorten: 'sh-x' }
    ]
  });
  assert.deepEqual(result, [{ inviteId: 'i1', shorten: 'sh-a', answers: { Q01: 'A' }, videoAnswers: [] }]);
  assert.deepEqual(calls.detail, ['c1', 'c2', 'c3']);
  assert.deepEqual(
    calls.list.map(item => item.currentPage),
    [1, 2]
  );
});

test('回收答卷：没有待回收的邀请时不请求 open-api', async () => {
  const { services, calls } = fakeServices({ rows: [], details: {} });
  const result = await createAdapter({ services }).collectAnswers({ tenantId: 't1', projectId: 'p1', invites: [] });
  assert.deepEqual(result, []);
  assert.equal(calls.list.length, 0);
});

test('回收答卷：免登录码对不上时按邮箱对应面试记录', async () => {
  const rows = [{ id: 'c9', code: 'other-code', email: 'Boss@Example.com' }];
  const details = { c9: { options: { questionnaire: { submittedAt: '2026-11-20T00:00:00.000Z', answers: { Q01: 'C' } } } } };
  const { services } = fakeServices({ rows, details });
  const result = await createAdapter({ services }).collectAnswers({
    tenantId: 't1',
    projectId: 'p1',
    invites: [{ inviteId: 'i1', shorten: 'sh-z', email: 'boss@example.com' }]
  });
  assert.deepEqual(result, [{ inviteId: 'i1', shorten: 'sh-z', answers: { Q01: 'C' }, videoAnswers: [] }]);
});
