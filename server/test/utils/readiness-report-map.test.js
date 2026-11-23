const test = require('node:test');
const assert = require('node:assert/strict');
const { aiLevelToNum, buildPersonAnalysis, buildRolePreview, buildPositionOutlook } = require('../../libs/utils/readiness-report-map');

test('aiLevelToNum 识别 A1–A5 与 unknown', () => {
  assert.equal(aiLevelToNum('A3'), 3);
  assert.equal(aiLevelToNum('a1'), 1);
  assert.equal(aiLevelToNum(4), 4);
  assert.equal(aiLevelToNum('unknown'), 0);
  assert.equal(aiLevelToNum(null), 0);
});

test('buildPersonAnalysis 用 forecast 任务 + assess 等级生成 skills，并在报告无差距时推导优先差距', () => {
  const analysis = buildPersonAnalysis({
    report: { result: { readiness_score: 50, where_they_stand: 'stand', months_to_close: 2, priority_gaps: [] } },
    assess: {
      result: {
        tasks: [
          { task_id: 't1', task: 'Develop HR strategy', ai_level: 'A1', evidence: [{ title: 'e1', source: 's', summary: 'x' }] },
          { task_id: 't2', task: 'Lead HR planning', ai_level: 'unknown' }
        ]
      }
    },
    forecast: {
      result: {
        tasks: [
          { task_id: 't1', task: 'Develop HR strategy', expected_ai_level: 'A3', importance_now: 4, importance_year: 4, change: 'Stable' },
          { task_id: 't2', task: 'Lead HR planning', expected_ai_level: 'A2', importance_now: 3, importance_year: 3, change: 'Increasing' }
        ]
      }
    }
  });
  assert.equal(analysis.readiness, 50);
  assert.equal(analysis.summary, 'stand');
  assert.equal(analysis.skills.length, 2);
  assert.deepEqual(
    analysis.skills.map(item => ({ name: item.name, current: item.current, required: item.required, status: item.status })),
    [
      { name: 'Develop HR strategy', current: 1, required: 3, status: 'critical' },
      { name: 'Lead HR planning', current: 0, required: 2, status: 'unknown' }
    ]
  );
  assert.equal(analysis.priorityGaps.length, 1);
  assert.equal(analysis.priorityGaps[0].title, 'Develop HR strategy');
  assert.equal(analysis.metrics.monthsToClose, 2);
  assert.equal(analysis.metrics.criticalGaps, 1);
});

test('buildRolePreview 把 forecast 与 role_report 转成 RoleInsights 结构', () => {
  const role = buildRolePreview({
    report: {
      result: {
        headline: 'h',
        what_drives_success_now: 'now',
        how_the_role_is_changing: 'change',
        workforce_strategy: [{ action: 'BUILD', title: 'Hire', detail: 'd' }]
      }
    },
    forecast: {
      result: {
        tasks: [{ task_id: 't1', task: 'Develop HR strategy', importance_now: 4, importance_year: 5, change: 'Increasing', ai_exposure: 'high', evidence: [] }]
      }
    }
  });
  assert.equal(role.verdict.summary, 'h');
  assert.equal(role.verdict.today, 'now');
  assert.equal(role.skills[0].change, 'enhanced');
  assert.equal(role.skills[0].importanceNow, 4);
  assert.equal(role.strategies[0].action, 'BUILD');
  assert.deepEqual(buildPositionOutlook({ result: { headline: 'h', what_drives_success_now: 'now', how_the_role_is_changing: 'f' } }).drivesSuccessNow, ['now']);
});
