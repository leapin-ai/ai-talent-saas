import dayjs from 'dayjs';
import { ROLE_STAGE_FILTER_OPTIONS, STAGE_KIND, stageIndexOf } from './common';
import { hasInlineResult } from './StageResult';

/** Role 是否已到达员工问卷发送（及之后）：此前参与人仍停在 pending，不算「等待人工」 */
const staffSendReached = runStage => {
  const sendIndex = ROLE_STAGE_FILTER_OPTIONS.indexOf('staff_send');
  const stageIndex = ROLE_STAGE_FILTER_OPTIONS.indexOf(runStage);
  return sendIndex >= 0 && stageIndex >= sendIndex;
};

/** 阶段分组：单阶段直接成行，多阶段折叠成组；done 是终点，不单独成行 */
export const STAGE_GROUPS = {
  role: [
    { stages: ['draft'] },
    { key: 'manager', stages: ['manager_questionnaire', 'manager_confirm', 'manager_publish', 'manager_send', 'manager_answers'] },
    { stages: ['revise'] },
    { key: 'staff', stages: ['staff_questionnaire', 'staff_confirm', 'staff_publish', 'staff_send'] },
    { stages: ['await_persons'] },
    { key: 'reports', stages: ['recall', 'skills', 'forecast', 'person_reports', 'role_report'] },
    { stages: ['role_apply'] }
  ],
  person: [
    { key: 'answers', stages: ['pending', 'answers'] },
    { stages: ['assess'] },
    { key: 'supplement', stages: ['reassess', 'reassess_confirm', 'reassess_publish', 'reassess_send', 'reassess_answers'] },
    { stages: ['assess_update'] },
    { stages: ['claims'] }
  ]
};

/** 已越过但没有当前数据的阶段视为被跳过；pending 只是等待发送，本身不产生数据 */
const NO_DATA_STAGES = ['pending'];

const formatTime = value => (value ? dayjs(value).format('MM-DD HH:mm') : '');

/**
 * 计算一条流程（岗位或某参与人）每个阶段的状态与操作。
 * primary：当前需要人处理的操作（确认、发送、录入答卷、重试等）；secondary：查看数据、预览、退回等辅助操作。
 */
export const buildStageRows = ({ t, scope, stages, currentStage, person, run, rows, invites = [], canTrigger, actions }) => {
  const currentIndex = stageIndexOf(stages, currentStage);
  const personId = person ? String(person.id) : null;
  const titleSuffix = person ? ` · ${person.name}` : '';
  const rowsOf = stage => rows.filter(item => item.stage === stage.key && (stage.fanOut || (item.personId ? String(item.personId) : null) === personId));

  return stages
    .map((stage, index) => ({ stage, index }))
    .filter(({ stage }) => stage.mode !== 'end')
    .map(({ stage, index }) => {
      // 参与人 pending 且 Role 未到员工发送：第一步停在「获取员工问卷」，勿跳到「待发送问卷 / 等待人工」
      const waitingStaffQuestionnaire = scope === 'person' && currentStage === 'pending' && stage.key === 'pending' && !staffSendReached(run?.stage);
      const label = waitingStaffQuestionnaire ? t('stage.getStaffQuestionnaire') : t(`stage.${stage.key}`);
      const kind = STAGE_KIND[stage.key];
      const all = rowsOf(stage);
      const current = all.filter(item => item.isCurrent);
      const failedRows = current.filter(item => item.status === 'failed');
      const runningRow = current.find(item => item.status === 'running');
      const position = index < currentIndex ? 'done' : index === currentIndex ? 'current' : 'todo';
      const isCurrent = position === 'current';
      const latest = [...current].sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))[0];
      const manualSkip = current.some(item => item.skipped === true);
      const skipped = (position === 'done' && !current.length && !NO_DATA_STAGES.includes(stage.key)) || manualSkip;

      let state = 'todo';
      let status = { type: 'default', text: t('stateTodo') };
      if (failedRows.length) {
        state = 'failed';
        status = { type: 'error', text: t('status.failed') };
      } else if (runningRow) {
        state = 'running';
        const minutes = Math.max(0, dayjs().diff(dayjs(runningRow.createdAt), 'minute'));
        status = { type: 'processing', text: minutes ? t('stateRunningFor', { minutes }) : t('status.running') };
      } else if (skipped) {
        state = 'skipped';
        status = { type: 'default', text: t('stateSkipped') };
      } else if (position === 'done') {
        state = 'done';
        status = { type: 'success', text: t('stateDone') };
      } else if (isCurrent) {
        state = 'current';
        if (waitingStaffQuestionnaire) {
          status = { type: 'processing', text: t('stateWaitingStaffQuestionnaire') };
        } else {
          status = stage.mode === 'manual' || stage.mode === 'wait' ? { type: 'warning', text: t('stateWaitingManual') } : { type: 'processing', text: t('stateCurrent') };
        }
      }

      const primary = [];
      const secondary = [];
      if (isCurrent && stage.action === 'confirm') {
        primary.push({ children: t('confirmQuestionnaire'), onClick: () => actions.confirm({ kind, personId }) });
        if (stage.key === 'reassess_confirm') {
          primary.push({ children: t('skipToAssessUpdate'), onClick: () => actions.skipReassessConfirm({ personId }) });
        }
      }
      if (isCurrent && stage.action === 'send') {
        primary.push({ children: t('goSend'), onClick: () => actions.openSend(kind) });
      }
      if (isCurrent && stage.action === 'answers') {
        if (current.some(item => item.status === 'succeeded')) {
          primary.push({ children: t('confirmNextStage'), onClick: () => actions.advanceAnswers({ kind, personId }) });
        }
        primary.push({ children: t('fetchResult'), onClick: actions.fetchResult });
        primary.push({ children: t('enterAnswers'), onClick: () => actions.openAnswers({ kind, personId }) });
      }
      if (isCurrent && stage.action === 'trigger') {
        primary.push({ children: t('triggerReport'), disabled: !canTrigger, onClick: actions.trigger });
        if (run.hasStaffQuestionnaire) {
          primary.push({ children: t('sendStaff'), onClick: () => actions.openSend('staff') });
        }
      }
      failedRows.forEach(item => {
        primary.push({ children: t('retry'), onClick: () => actions.retry({ scope: stage.fanOut ? 'role' : scope, personId: stage.fanOut ? item.personId : personId, stage: stage.key }) });
      });
      if (all.length) {
        secondary.push({ children: t('viewData'), onClick: () => actions.openData(`${label}${titleSuffix}`, all) });
      }
      if (stage.action === 'send' && index <= currentIndex && !skipped) {
        secondary.push({ children: t('previewProject'), onClick: () => actions.openPreview({ kind, personId, title: `${label}${titleSuffix}` }) });
      }
      if (index <= currentIndex && stage.mode !== 'wait' && !stage.fanOut && (!skipped || manualSkip)) {
        secondary.push({
          children: t('rollbackHere'),
          danger: true,
          onClick: () => actions.rollback({ scope, personId, stage: stage.key, confirmText: t(scope === 'role' && index <= stageIndexOf(stages, 'staff_send') ? 'rollbackRoleConfirm' : 'rollbackConfirm') })
        });
      }

      // 已取消（含 draft 423）：去掉确认/发送/重试/退回等操作；有阶段数据时仍保留「查看数据」
      if (run?.status === 'canceled') {
        primary.length = 0;
        const keep = secondary.filter(item => item.children === t('viewData'));
        secondary.length = 0;
        secondary.push(...keep);
      }

      const facts = [];
      const succeeded = current.filter(item => item.status === 'succeeded').sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))[0];
      Object.entries(succeeded?.summary || {}).forEach(([key, value]) => facts.push(t(`summary.${key}`, { count: value, name: value })));
      if (stage.fanOut && current.length) {
        facts.push(t('summary.fanOut', { done: current.filter(item => item.status === 'succeeded').length, total: current.length }));
      }
      if (isCurrent && stage.action === 'answers') {
        const targets = invites.filter(item => item.isCurrent && item.kind === kind && (kind === 'manager' || String(item.personId) === personId));
        if (targets.length) {
          facts.push(t('summary.inviteProgress', { answered: targets.filter(item => item.status === 'answered').length, total: targets.length }));
        }
      }
      if (state === 'done' && stage.mode === 'auto' && succeeded) {
        const seconds = dayjs(succeeded.updatedAt).diff(dayjs(succeeded.createdAt), 'second');
        if (seconds > 0) {
          facts.push(seconds < 60 ? t('summary.durationSeconds', { seconds }) : t('summary.durationMinutes', { minutes: Math.floor(seconds / 60), seconds: seconds % 60 }));
        }
      }
      if (current[0]?.version > 1 && !stage.fanOut) {
        facts.push(t('summary.version', { version: current[0].version }));
      }

      const version = stage.fanOut ? (current.length ? `${current.filter(item => item.status === 'succeeded').length}/${current.length}` : '') : current[0]?.version ? `v${current[0].version}` : '';
      return {
        key: stage.key,
        label,
        // 等待 Role 生成员工问卷时不算参与人侧人工待办；分组进度改挂本步骤额外信息，不单独出组标题
        waitingStaffQuestionnaire,
        manual: waitingStaffQuestionnaire ? false : stage.mode === 'manual' || stage.mode === 'wait',
        state,
        status,
        error: formatStageError(failedRows[0]?.error),
        time: state === 'todo' || state === 'skipped' ? '' : formatTime(latest?.updatedAt),
        version,
        facts,
        result: succeeded && !stage.fanOut && state !== 'skipped' && hasInlineResult(stage.key) ? { id: String(succeeded.id) } : null,
        primary,
        secondary
      };
    });
};

/** 组状态：失败 > 执行中 > 当前待办 > 全部跳过 > 全部完成 > 未开始 */
const groupStatus = (t, children) => {
  const pick = state => children.find(item => item.state === state);
  const active = pick('failed') || pick('running') || pick('current');
  if (active) {
    return { state: active.state, status: active.status };
  }
  if (children.every(item => item.state === 'skipped')) {
    return { state: 'skipped', status: { type: 'default', text: t('stateSkipped') } };
  }
  if (children.every(item => item.state === 'done' || item.state === 'skipped')) {
    return { state: 'done', status: { type: 'success', text: t('stateDone') } };
  }
  return { state: 'todo', status: { type: 'default', text: t('stateTodo') } };
};

/**
 * 阶段行 → 里程碑（流程概览的每一步）：多阶段的组合并成一步，单阶段直接成一步。
 * activeKey：需要关注的里程碑（失败 > 执行中 > 当前待办），流程结束时为最后一步。
 */
export const buildMilestones = ({ t, scope, stageRows }) => {
  const byKey = new Map(stageRows.map(item => [item.key, item]));
  const milestones = STAGE_GROUPS[scope]
    .map(group => {
      const stages = group.stages.map(key => byKey.get(key)).filter(Boolean);
      if (!stages.length) {
        return null;
      }
      const single = !group.key || stages.length === 1;
      const { state, status } = single ? stages[0] : groupStatus(t, stages);
      const finished = stages.filter(item => item.state === 'done' || item.state === 'skipped').length;
      return { key: single ? stages[0].key : `group:${group.key}`, label: single ? stages[0].label : t(`group.${group.key}`), state, status, progress: single ? '' : `${finished}/${stages.length}`, finished, total: stages.length, stages };
    })
    .filter(Boolean);
  const pick = state => milestones.find(item => item.state === state);
  const active = pick('failed') || pick('running') || pick('current') || [...milestones].reverse().find(item => item.state === 'done') || milestones[0];
  return { milestones, activeKey: active?.key };
};

/** 整体进度：已完成或已跳过的阶段占比 */
export const progressOf = stageRows => (stageRows.length ? Math.round((stageRows.filter(item => item.state === 'done' || item.state === 'skipped').length / stageRows.length) * 100) : 0);

/**
 * 上游错误常见形如「Readiness 返回 HTTP 422：{"detail":[{"msg":...,"loc":[...]}]}」，
 * 抽出 detail 里的 msg 与字段路径，便于直接阅读；解析不了就原样返回。
 */
export const formatStageError = error => {
  const text = error ? String(error) : '';
  const at = text.indexOf('{');
  if (at < 0) {
    return text;
  }
  try {
    const body = JSON.parse(text.slice(at));
    const messages = Array.isArray(body.detail)
      ? body.detail.map(item => `${item.msg || ''}${Array.isArray(item.loc) ? `（${item.loc.filter(part => part !== 'body').join('.')}）` : ''}`)
      : [body.message || body.msg || body.detail].filter(Boolean).map(String);
    const prefix = text.slice(0, at).replace(/[:：\s]+$/, '');
    return messages.length ? `${prefix ? `${prefix}：` : ''}${messages.join('；')}` : text;
  } catch (e) {
    return text;
  }
};
