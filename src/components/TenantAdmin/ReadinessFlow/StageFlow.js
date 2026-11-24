import { useEffect, useRef, useState } from 'react';
import { Progress, Tag, Tooltip } from 'antd';
import { CheckOutlined, CloseOutlined, LoadingOutlined, MinusOutlined } from '@ant-design/icons';
import classnames from 'classnames';
import dayjs from 'dayjs';
import { createWithRemoteLoader } from '@kne/remote-loader';
import { STATUS_COLOR } from './common';
import { StageResultPanel } from './StageResult';
import style from './style.module.scss';

/** 与 style 中 $layout-header-height 一致，滚动定位时避开顶栏 */
const LAYOUT_HEADER_OFFSET = 48;

/** 把右侧标题滚到滚动容器顶部（避开顶栏）；仅用户点选时调用 */
const scrollTitleToTop = el => {
  if (!el) {
    return;
  }
  const scroll = el.closest('.kne-responsive-scroll') || el.closest('.simplebar-content-wrapper');
  if (scroll) {
    const top = el.getBoundingClientRect().top - scroll.getBoundingClientRect().top + scroll.scrollTop - LAYOUT_HEADER_OFFSET;
    scroll.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
    return;
  }
  el.scrollIntoView({ behavior: 'smooth', block: 'start' });
};

/** 需要关注的状态：只对这些状态写出状态文字 */
const NOTICE_STATES = ['failed', 'running', 'current'];

/** 状态节点：里程碑、阶段、参与人共用同一套图形 */
const StepNode = ({ state, index }) => (
  <span className={classnames(style.node, style[`node-${state}`])}>
    {state === 'done' ? <CheckOutlined /> : state === 'failed' ? <CloseOutlined /> : state === 'running' ? <LoadingOutlined /> : state === 'skipped' ? <MinusOutlined /> : state === 'current' ? <span className={style.nodeDot} /> : index + 1}
  </span>
);

/**
 * 阶段操作：有待办时最多露出两个待办（第一个为主按钮），其余进「更多」；没有待办时露出「查看数据」。
 */
export const StageActions = createWithRemoteLoader({
  modules: ['components-core:ButtonGroup']
})(({ remoteModules, primary = [], secondary = [] }) => {
  const [ButtonGroup] = remoteModules;
  if (!primary.length && !secondary.length) {
    return null;
  }
  const list = [...primary.map((item, index) => ({ ...item, size: 'small', type: index === 0 ? 'primary' : 'link' })), ...secondary.map(item => ({ ...item, size: 'small', type: 'link' }))];
  return <ButtonGroup moreType="link" showLength={primary.length ? Math.min(primary.length, 2) : 1} list={list} />;
});

/**
 * 纵向时间线：名称与时间在左、操作在右；已结束的阶段悬停才露出操作。
 * stages 中 isGroup 的项渲染为组标题，连线从旁边穿过，整条时间线不断开。
 */
export const StageTimeline = ({ t, stages }) => (
  <ol className={style.timeline}>
    {stages.map((item, index) => {
      if (item.isGroup) {
        return (
          <li key={item.key} className={style.timelineGroup}>
            <span className={style.groupTitle}>{item.label}</span>
            <span className={style.detailMeta}>{item.progress}</span>
          </li>
        );
      }
      const settled = item.state === 'done' || item.state === 'skipped';
      return (
        <li key={item.key} className={classnames(style.stage, style[`stage-${item.state}`])}>
          <StepNode state={item.state} index={stages.slice(0, index).filter(stage => !stage.isGroup).length} />
          <div className={style.stageBody}>
            <div className={style.stageRow}>
              <div className={style.stageHeading}>
                <span className={style.stageLabel}>{item.label}</span>
                {item.manual ? (
                  <Tag bordered={false} className={style.stageTag}>
                    {t('manual')}
                  </Tag>
                ) : null}
                {item.time ? <span className={style.stageTime}>{item.time}</span> : null}
                {NOTICE_STATES.includes(item.state) || item.state === 'skipped' ? <span className={style.stageStatus}>{item.status.text}</span> : null}
              </div>
              <div className={settled ? style.actionsOnHover : undefined}>
                <StageActions primary={item.primary} secondary={item.secondary} />
              </div>
            </div>
            {item.facts?.length ? <div className={style.stageFacts}>{item.facts.join(' · ')}</div> : null}
            {item.error ? <div className={style.stageError}>{item.error}</div> : null}
          </div>
        </li>
      );
    })}
  </ol>
);

/** 选中项跟随流程推进：推荐项变化时切过去，否则保留用户的选择 */
const useFollowSelection = recommendedKey => {
  const [selectedKey, setSelectedKey] = useState(recommendedKey);
  useEffect(() => {
    setSelectedKey(recommendedKey);
  }, [recommendedKey]);
  return [selectedKey, setSelectedKey];
};

/** 用户点选左侧导航后，滚动到右侧标题顶部；程序自动跟选不滚动 */
const useSelectAndScrollToTitle = recommendedKey => {
  const [selectedKey, setSelectedKey] = useFollowSelection(recommendedKey);
  const titleRef = useRef(null);
  const shouldScrollRef = useRef(false);

  const select = key => {
    shouldScrollRef.current = true;
    setSelectedKey(key);
  };

  useEffect(() => {
    if (!shouldScrollRef.current) {
      return;
    }
    shouldScrollRef.current = false;
    const frame = requestAnimationFrame(() => scrollTitleToTop(titleRef.current));
    return () => cancelAnimationFrame(frame);
  }, [selectedKey]);

  return [selectedKey, select, titleRef];
};

/** 左侧导航：分区标题 + 列表一起 sticky 吸顶 */
const NavList = ({ title, extra, items, selectedKey, onSelect, linked }) => (
  <aside className={style.navSticky}>
    {title || extra ? (
      <div className={style.navStickyHead}>
        {title ? <span className={style.navStickyTitle}>{title}</span> : null}
        {extra ? <div className={style.navStickyExtra}>{extra}</div> : null}
      </div>
    ) : null}
    <ul className={classnames(style.nav, { [style.navLinked]: linked })} role="tablist">
      {items.map((item, index) => (
        <li key={item.key} className={classnames(style.navItem, style[`nav-${item.state}`])}>
          <button type="button" role="tab" aria-selected={item.key === selectedKey} className={classnames(style.navButton, { [style.navSelected]: item.key === selectedKey })} onClick={() => onSelect(item.key)}>
            <StepNode state={item.state} index={index} />
            <span className={style.navText}>
              <span className={style.navTitle}>{item.title}</span>
              {item.note ? <span className={style.navNote}>{item.note}</span> : null}
            </span>
          </button>
        </li>
      ))}
    </ul>
  </aside>
);

/** Role 流程：左侧里程碑，右侧选中里程碑的阶段；renderBeforeResult 在阶段结果上方，renderExtra 在下方 */
export const MilestoneFlow = ({ t, title, milestones, activeKey, renderBeforeResult, renderExtra }) => {
  const [selectedKey, select, titleRef] = useSelectAndScrollToTitle(activeKey);
  const selected = milestones.find(item => item.key === selectedKey) || milestones[0];
  const items = milestones.map(item => ({
    key: item.key,
    state: item.state,
    title: item.label,
    note: [item.progress, NOTICE_STATES.includes(item.state) || item.state === 'done' ? item.status.text : ''].filter(Boolean).join(' · ')
  }));
  return (
    <div className={style.split}>
      <NavList title={title} linked items={items} selectedKey={selected?.key} onSelect={select} />
      {selected ? (
        <div className={style.detail}>
          <div ref={titleRef} className={style.detailHeading}>
            <span className={style.detailTitle}>{selected.label}</span>
            {selected.progress ? <span className={style.detailMeta}>{t('milestoneProgress', { progress: selected.progress })}</span> : null}
          </div>
          <StageTimeline t={t} stages={selected.stages} />
          {renderBeforeResult?.(selected)}
          <StageResultPanel key={selected.key} t={t} stages={selected.stages} />
          {renderExtra?.(selected)}
        </div>
      ) : null}
    </div>
  );
};

/** 参与人在列表里的状态节点：失败 > 完成 > 当前阶段的状态 */
const personState = (person, active) => (person.status === 'failed' ? 'failed' : person.stage === 'done' ? 'done' : active?.state || 'todo');

/** 参与人当前有效邀请：补充问卷阶段优先 reassess，否则 staff */
const personCurrentInvite = (person, invites) => {
  const list = (invites || []).filter(item => item.isCurrent !== false && String(item.personId) === String(person.id) && ['staff', 'reassess'].includes(item.kind));
  if (!list.length) {
    return null;
  }
  if (String(person.stage || '').startsWith('reassess')) {
    return list.find(item => item.kind === 'reassess') || list[0];
  }
  return list.find(item => item.kind === 'staff') || list[0];
};

/** 当前邀请的复制链接 / 重发（不含阶段主操作，避免与标题栏「获取结果」等挤出「更多」） */
const personInviteActions = (t, person, invites, inviteActions) => {
  const primary = [];
  const invite = personCurrentInvite(person, invites);
  if (invite?.url && inviteActions?.copyLink) {
    primary.push({ children: t('copyLink'), onClick: () => inviteActions.copyLink(invite) });
  }
  if (invite && ['sent', 'failed'].includes(invite.status) && inviteActions?.resend) {
    primary.push({ children: t('resend'), onClick: () => inviteActions.resend(invite) });
  }
  return primary;
};

/**
 * 参与人：左侧参与人列表，右侧选中参与人的完整流程（按里程碑分组列出全部阶段）。
 * 默认选中第一个有待办的参与人。
 */
export const PersonFlowPanel = ({ t, title, extra, persons, personFlows, invites = [], inviteActions }) => {
  const recommended = persons.find(person => personFlows.get(String(person.id))?.active?.primary.length) || persons[0];
  const [selectedKey, select, titleRef] = useSelectAndScrollToTitle(recommended ? String(recommended.id) : null);
  const person = persons.find(item => String(item.id) === selectedKey) || persons[0];
  if (!person) {
    return null;
  }
  const current = personFlows.get(String(person.id));
  const headerPrimary = current.active?.primary || [];
  const invitePrimary = personInviteActions(t, person, invites, inviteActions);
  const items = persons.map(item => {
    const { active } = personFlows.get(String(item.id));
    const state = personState(item, active);
    // 优先用阶段行算好的文案（pending 在员工发送前会显示「获取员工问卷」）
    const stageNote = active?.key === item.stage && active?.label ? active.label : t(`stage.${item.stage}`);
    return {
      key: String(item.id),
      state,
      title: item.name,
      note: [stageNote, item.profileCompletionPct == null ? null : `${t('completion')} ${item.profileCompletionPct}%`].filter(Boolean).join(' · ')
    };
  });
  return (
    <div className={style.split}>
      <NavList title={title} extra={extra} items={items} selectedKey={String(person.id)} onSelect={select} />
      <div className={style.detail}>
        <div ref={titleRef} className={style.detailHeader}>
          <div className={style.detailHeadline}>
            <div className={style.detailHeading}>
              <span className={style.detailTitle}>{person.name}</span>
              <Tag bordered={false} color={STATUS_COLOR[person.status]}>
                {t(`status.${person.status}`)}
              </Tag>
            </div>
            <div className={style.detailMeta}>{[person.email, person.profileCompletionPct == null ? null : `${t('completion')} ${person.profileCompletionPct}%`].filter(Boolean).join(' · ')}</div>
          </div>
          {headerPrimary.length ? <StageActions primary={headerPrimary} /> : null}
        </div>
        <StageTimeline
          t={t}
          stages={current.milestones
            .flatMap(milestone => {
              if (milestone.stages.length <= 1) {
                return milestone.stages;
              }
              // 「获取员工问卷」时：不渲染组标题，把「员工问卷 0/2」挂到该步骤额外信息
              const waiting = milestone.stages.find(stage => stage.waitingStaffQuestionnaire);
              if (waiting) {
                const groupExtra = [milestone.label, milestone.progress].filter(Boolean).join(' ');
                return milestone.stages.map(stage => (stage.waitingStaffQuestionnaire && groupExtra ? { ...stage, facts: [groupExtra, ...(stage.facts || [])] } : stage));
              }
              return [{ key: `group:${milestone.key}`, isGroup: true, label: milestone.label, progress: milestone.progress }, ...milestone.stages];
            })
            // 标题栏保留「获取结果 / 录入答卷」；时间线当前行改挂复制链接 / 重发，并保留退回等 secondary
            .map(stage => (stage.key === current.active?.key ? { ...stage, primary: invitePrimary } : stage))}
        />
        <StageResultPanel key={person.id} t={t} stages={current.milestones.flatMap(milestone => milestone.stages)} />
      </div>
    </div>
  );
};

/** 邀请状态 → 节点图形；邮件发送失败只是投递未成功，可重发，不算阶段失败 */
const inviteNodeState = status => (status === 'answered' ? 'done' : status === 'sent' || status === 'failed' ? 'current' : 'todo');

/**
 * 经理邀请总览：已发送经理问卷后，在阶段结果上方展示收件人与作答进度（样式对齐 PersonOverview）。
 * invites：当前有效的 manager 邀请列表。
 */
export const ManagerInviteOverview = ({ t, invites, inviteActions }) => {
  const rows = invites.map(invite => {
    // 邮件失败归入进行中（可重发），勿进 failed 桶以免被当成阶段失败
    const group = invite.status === 'answered' ? 'done' : invite.status === 'sent' || invite.status === 'failed' ? 'active' : 'todo';
    return { invite, group, state: inviteNodeState(invite.status) };
  });
  const counts = ['done', 'active', 'todo'].map(key => ({ key, count: rows.filter(item => item.group === key).length }));
  return (
    <div className={style.overview}>
      <div className={style.overviewHead}>
        <span className={style.groupTitle}>{t('managerOverview.title')}</span>
        <div className={style.overviewCounts}>
          {counts.map(item => (
            <span key={item.key} className={classnames(style.overviewCount, style[`overview-${item.key}`])}>
              <span className={style.overviewDot} />
              {t(`managerOverview.${item.key}`)}
              <b>{item.count}</b>
            </span>
          ))}
        </div>
      </div>
      {rows.length ? (
        <div className={style.overviewTable}>
          <div className={classnames(style.overviewRow, style.overviewHeader, style.overviewInviteRow)}>
            <span>{t('managerOverview.manager')}</span>
            <span>{t('statusLabel')}</span>
            <span>{t('expiresAt')}</span>
            <span />
          </div>
          {rows.map(({ invite, state }) => {
            const primary = [];
            if (invite.url && inviteActions?.copyLink) {
              primary.push({ children: t('copyLink'), onClick: () => inviteActions.copyLink(invite) });
            }
            if (['sent', 'failed'].includes(invite.status) && inviteActions?.resend) {
              primary.push({ children: t('resend'), onClick: () => inviteActions.resend(invite) });
            }
            return (
              <div key={invite.id} className={classnames(style.overviewRow, style.overviewInviteRow)}>
                <span className={style.overviewPerson}>
                  <StepNode state={state} index={0} />
                  <span className={style.navText}>
                    <span className={style.navTitle}>{invite.name || invite.email}</span>
                    {invite.name && invite.email && invite.name !== invite.email ? <span className={style.navNote}>{invite.email}</span> : null}
                  </span>
                </span>
                <span className={style.overviewStage}>
                  {invite.status === 'failed' && invite.error ? (
                    <Tooltip title={invite.error}>
                      <span>{t(`inviteStatus.${invite.status}`)}</span>
                    </Tooltip>
                  ) : (
                    t(`inviteStatus.${invite.status}`)
                  )}
                </span>
                <span className={style.detailMeta}>{invite.expiresAt ? dayjs(invite.expiresAt).format('YYYY-MM-DD HH:mm') : '-'}</span>
                <span className={style.overviewActions}>{primary.length ? <StageActions primary={primary} /> : null}</span>
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
};

/** 参与人总览：分类计数 + 每人的当前阶段、流程进度、档案完成度；操作仅复制链接 / 重发（获取结果等在下方参与人详情） */
export const PersonOverview = ({ t, persons, personFlows, invites = [], inviteActions }) => {
  const rows = persons.map(person => {
    const flow = personFlows.get(String(person.id));
    const finished = flow.milestones.filter(item => item.state === 'done' || item.state === 'skipped').length;
    const state = personState(person, flow.active);
    const group = state === 'failed' ? 'failed' : state === 'done' ? 'done' : flow.active?.primary.length ? 'todo' : 'active';
    const primary = personInviteActions(t, person, invites, inviteActions);
    return { person, flow, state, group, percent: flow.milestones.length ? Math.round((finished / flow.milestones.length) * 100) : 0, primary };
  });
  const counts = ['done', 'todo', 'active', 'failed'].map(key => ({ key, count: rows.filter(item => item.group === key).length }));
  return (
    <div className={style.overview}>
      <div className={style.overviewHead}>
        <span className={style.groupTitle}>{t('overview.title')}</span>
        <div className={style.overviewCounts}>
          {counts.map(item => (
            <span key={item.key} className={classnames(style.overviewCount, style[`overview-${item.key}`])}>
              <span className={style.overviewDot} />
              {t(`overview.${item.key}`)}
              <b>{item.count}</b>
            </span>
          ))}
        </div>
      </div>
      {rows.length ? (
        <div className={style.overviewTable}>
          <div className={classnames(style.overviewRow, style.overviewHeader)}>
            <span className={style.overviewPerson}>
              <span className={style.nodeSpacer} aria-hidden />
              <span>{t('overview.person')}</span>
            </span>
            <span className={style.overviewStage}>{t('overview.stage')}</span>
            <span className={style.overviewProgress}>{t('overview.progress')}</span>
            <span>{t('completion')}</span>
            <span className={style.overviewActions} />
          </div>
          {rows.map(({ person, flow, state, percent, primary }) => (
            <div key={person.id} className={style.overviewRow}>
              <span className={style.overviewPerson}>
                <StepNode state={state} index={0} />
                <span className={style.navText}>
                  <span className={style.navTitle}>{person.name}</span>
                  {person.email ? <span className={style.navNote}>{person.email}</span> : null}
                </span>
              </span>
              <span className={style.overviewStage}>
                {flow.active?.key === person.stage && flow.active?.label ? flow.active.label : t(`stage.${person.stage}`)}
                {flow.active && NOTICE_STATES.includes(flow.active.state) ? <span className={style.stageStatus}>{flow.active.status.text}</span> : null}
              </span>
              <span className={style.overviewProgress}>
                <Progress percent={percent} size="small" showInfo={false} status={state === 'failed' ? 'exception' : undefined} />
                <span className={style.detailMeta}>{percent}%</span>
              </span>
              <span>{person.profileCompletionPct == null ? '-' : `${person.profileCompletionPct}%`}</span>
              <span className={style.overviewActions}>{primary.length ? <StageActions primary={primary} /> : null}</span>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
};
