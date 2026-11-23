/**
 * Readiness 写回岗位：把 forecast / role_report 落到 position（任务、outlook、策略），
 * 并把各参与人的 person_reports + assess 写成 skillAnalysis。
 * input.params = { positionId, forecast, role_report, persons[] }
 */
const { buildPersonAnalysis, buildPositionOutlook, buildPositionTasks, buildRolePreview, buildRoleStrategies } = require('../../utils/readiness-report-map');

const runner = async (fastify, options, { task, log }) => {
  const { params = {}, tenantId } = task.input || {};
  const { positionId, forecast, role_report: roleReport, persons = [] } = params;
  const { services } = fastify.project;

  const step = async (message, data) => log({ message, data });
  const fail = async message => {
    await step('写回失败', { error: message });
    throw new Error(message);
  };

  if (!tenantId) {
    await fail('写回任务缺少 tenantId');
  }
  if (!positionId) {
    await fail('流程未关联岗位，无法写回 Role');
  }
  if (!forecast || !roleReport) {
    await fail('缺少 forecast 或 role_report，无法写回');
  }

  const auth = { tenantId };
  const tasks = buildPositionTasks(forecast);
  const outlook = buildPositionOutlook(roleReport);
  const workforceStrategy = buildRoleStrategies(roleReport);

  await step('写回岗位任务与洞察', {
    positionId,
    taskCount: tasks.length,
    strategyCount: workforceStrategy.length
  });

  await services.workforce.replaceTasks(auth, {
    positionId: String(positionId),
    tasks,
    outlook,
    workforceStrategy
  });

  const personResults = [];
  const personAnalyses = [];
  for (const person of persons) {
    if (!person?.employeeId) {
      continue;
    }
    const analysis = buildPersonAnalysis({
      report: person.report,
      assess: person.assess,
      forecast
    });
    await services.position.skillAnalysisSave(auth, {
      positionId: String(positionId),
      employeeId: String(person.employeeId),
      readiness: analysis.readiness,
      summary: analysis.summary,
      metrics: analysis.metrics,
      skills: analysis.skills,
      priorityGaps: analysis.priorityGaps,
      keySkillGaps: analysis.keySkillGaps,
      replaceReadiness: true
    });
    personResults.push({
      personId: person.personId,
      employeeId: String(person.employeeId),
      name: person.name || '',
      readiness: analysis.readiness,
      skillCount: analysis.skills.length
    });
    personAnalyses.push({
      person: {
        id: person.personId,
        employeeId: String(person.employeeId),
        name: person.name || ''
      },
      analysis
    });
    await step('写回个人就绪度', {
      employeeId: String(person.employeeId),
      name: person.name,
      readiness: analysis.readiness
    });
  }

  return {
    appliedAt: new Date().toISOString(),
    positionId: String(positionId),
    taskCount: tasks.length,
    strategyCount: workforceStrategy.length,
    outlookSummary: outlook.summary || '',
    personCount: personResults.length,
    persons: personResults,
    // 阶段结果展示：岗位洞察 + 人才就绪（多人，与岗位详情同结构）
    role: buildRolePreview({ report: roleReport, forecast }),
    personAnalyses
  };
};

module.exports = runner;
