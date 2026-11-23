import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Flex, Spin } from 'antd';
import { useIntl } from '@kne/react-intl';
import { applyAiInterviewRemote } from '../../../preset';
import AIInterviewRoom from './AIInterviewRoom';
import style from './style.module.scss';

/** 与 style.complete-profile-interview / footer-spacer 保持一致 */
const LAYOUT_CHROME_PX = 114;
const STEPPER_CHROME_PX = 45;
/** 与 .footer-spacer 同高（12*2 + 按钮约 32 ≈ 56） */
const HOST_FOOTER_CHROME_PX = 56;
const sessionHeightOf = ({ withStepper = false, withHostFooter = false } = {}) => `calc(100dvh - ${LAYOUT_CHROME_PX + (withStepper ? STEPPER_CHROME_PX : 0) + (withHostFooter ? HOST_FOOTER_CHROME_PX : 0)}px)`;

const setupRemote = data => {
  if (!data?.cdnUrl || !data?.version) {
    return false;
  }
  return applyAiInterviewRemote({ cdnUrl: data.cdnUrl, version: data.version });
};

const InterviewStep = ({ profilePayload, onInterviewComplete, onPhaseChange, onInterviewLockChange, apisAdapter, withStepper = false, withHostFooter = false }) => {
  const sessionHeight = sessionHeightOf({ withStepper, withHostFooter });
  const { formatMessage } = useIntl();
  const [phase, setPhase] = useState('loading');
  const [error, setError] = useState('');
  const [invite, setInvite] = useState(null);
  const choiceResolvedRef = useRef(false);
  const bootOnceRef = useRef(false);
  const profilePayloadRef = useRef(profilePayload);
  const onInterviewCompleteRef = useRef(onInterviewComplete);
  const onPhaseChangeRef = useRef(onPhaseChange);
  const onInterviewLockChangeRef = useRef(onInterviewLockChange);
  const apisAdapterRef = useRef(apisAdapter);

  profilePayloadRef.current = profilePayload;
  onInterviewCompleteRef.current = onInterviewComplete;
  onPhaseChangeRef.current = onPhaseChange;
  onInterviewLockChangeRef.current = onInterviewLockChange;
  apisAdapterRef.current = apisAdapter;

  useEffect(() => {
    onPhaseChangeRef.current?.(phase);
  }, [phase]);

  useEffect(() => {
    if (phase !== 'room') {
      onInterviewLockChangeRef.current?.(false);
    }
  }, [phase]);

  const finishDirectly = useCallback((extra = {}) => {
    choiceResolvedRef.current = true;
    bootOnceRef.current = true;
    onInterviewCompleteRef.current && onInterviewCompleteRef.current({ stage: 'interview', status: 'complete', directFinish: true, ...extra });
  }, []);

  const openInterviewRoom = useCallback(
    data => {
      if (data?.status === 'generating') {
        // 已在生成报告：结束本步，勿停留在 loading
        setPhase('done');
        finishDirectly();
        return;
      }
      if (!setupRemote(data)) {
        throw new Error(formatMessage({ id: 'tenantAdmin.completeInterviewNotReady' }));
      }
      if (!data?.shorten) {
        throw new Error(formatMessage({ id: 'tenantAdmin.completeInterviewNotReady' }));
      }
      setInvite(data);
      setPhase('room');
      choiceResolvedRef.current = true;
      bootOnceRef.current = true;
    },
    [formatMessage, finishDirectly]
  );

  const saveProfile = useCallback(payload => apisAdapterRef.current.saveProfile(payload), []);

  const loadDetail = useCallback(() => apisAdapterRef.current.detail(), []);

  const loadEnsureInvite = useCallback(
    async (options = {}) => {
      const data = await apisAdapterRef.current.ensureInvite(options);
      openInterviewRoom(data);
      return data;
    },
    [openInterviewRoom]
  );

  // 只 boot 一次；卸载时若未进入 room/choice/done，重置以便 StrictMode / 返回重进可再 boot
  useEffect(() => {
    if (bootOnceRef.current || choiceResolvedRef.current) {
      return undefined;
    }
    bootOnceRef.current = true;

    let cancelled = false;
    let settled = false;
    (async () => {
      setPhase('loading');
      setError('');
      setInvite(null);
      try {
        const payload = profilePayloadRef.current;
        if (payload) {
          await saveProfile(payload);
        }
        if (cancelled) {
          return;
        }

        await loadDetail();
        if (cancelled) {
          return;
        }
        if (choiceResolvedRef.current) {
          return;
        }

        await loadEnsureInvite();
        settled = true;
      } catch (e) {
        if (!cancelled && !choiceResolvedRef.current) {
          bootOnceRef.current = false;
          setError(e.message || formatMessage({ id: 'tenantAdmin.completeInterviewInviteFailed' }));
          setPhase('error');
          settled = true;
        }
      }
    })();
    return () => {
      cancelled = true;
      if (!settled && !choiceResolvedRef.current) {
        bootOnceRef.current = false;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- boot once on mount
  }, []);

  // 面试作答完成：只同步后端，勿卸房间——InterviewSession 会先 emit interview/complete 再切到 feedback
  const syncInterviewComplete = useCallback(async () => {
    try {
      await apisAdapterRef.current.markDone({ interviewId: invite?.interviewId || invite?.clientUserId });
    } catch (e) {
      // ignore sync error
    }
  }, [invite]);

  // 评价提交完成：通知宿主，但保持 room，让 InterviewSession 渲染内置 Completed 完成页
  const handleFeedbackComplete = useCallback(() => {
    choiceResolvedRef.current = true;
    bootOnceRef.current = true;
    onInterviewCompleteRef.current?.({
      stage: 'feedback',
      status: 'complete',
      interviewId: invite?.interviewId || invite?.clientUserId
    });
  }, [invite]);

  if (phase === 'loading') {
    return (
      <Flex justify="center" align="center" className={style['generating-panel']}>
        <Spin size="large" />
      </Flex>
    );
  }

  if (phase === 'done') {
    return null;
  }

  if (phase === 'error') {
    return <Alert type="error" showIcon message={error} />;
  }

  if (!invite?.shorten) {
    return <Alert type="warning" showIcon message={formatMessage({ id: 'tenantAdmin.completeInterviewNotReady' })} />;
  }

  return (
    <div className={style['interview-panel']}>
      <div className={style['interview-room']}>
        <AIInterviewRoom
          key={`${invite.cdnUrl}|${invite.version}|${invite.shorten}`}
          apiUrl={invite.apiUrl}
          ajaxBaseUrl={invite.ajaxBaseUrl || invite.apiUrl}
          shorten={invite.shorten}
          height={sessionHeight}
          onStageChange={event => {
            const { stage, status } = event || {};
            // 问卷 / 设备检测完成 / 作答结束 / 评价：隐藏宿主「上一步」，避免与会话内提交条重叠
            if (stage === 'questionnaire') {
              onInterviewLockChangeRef.current?.(true);
            }
            if (stage === 'deviceTesting' && status === 'complete') {
              onInterviewLockChangeRef.current?.(true);
            }
            if (stage === 'interview' && status === 'complete') {
              onInterviewLockChangeRef.current?.(true);
              // 保持 room，让 Session 继续渲染 Feedback；后台 markDone 即可
              syncInterviewComplete();
              // 作答完成即结束本步，完成后不再显示「上一步」
              onInterviewCompleteRef.current?.({
                stage: 'interview',
                status: 'complete'
              });
            }
            if (stage === 'feedback') {
              onInterviewLockChangeRef.current?.(true);
              if (status === 'complete') {
                handleFeedbackComplete();
              }
            }
          }}
        />
      </div>
    </div>
  );
};

export default InterviewStep;
