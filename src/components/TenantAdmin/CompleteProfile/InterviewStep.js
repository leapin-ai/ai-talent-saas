import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Flex, Spin } from 'antd';
import { createWithRemoteLoader } from '@kne/remote-loader';
import { useIntl } from '@kne/react-intl';
import { applyAiInterviewRemote } from '../../../preset';
import AIInterviewRoom from './AIInterviewRoom';
import InterviewHistoryChoice from './InterviewHistoryChoice';
import style from './style.module.scss';

const setupRemote = data => {
  if (!data?.cdnUrl || !data?.version) {
    return false;
  }
  return applyAiInterviewRemote({ cdnUrl: data.cdnUrl, version: data.version });
};

const InterviewStep = createWithRemoteLoader({
  modules: ['components-core:Global@usePreset'],
  remoteFallback: (
    <Flex justify="center" align="center" className={style['generating-panel']}>
      <Spin size="large" />
    </Flex>
  )
})(({ remoteModules, profilePayload, onInterviewComplete, onPhaseChange, onInterviewLockChange, apisAdapter }) => {
  const [usePreset] = remoteModules;
  const { apis, ajax } = usePreset();
  const { formatMessage } = useIntl();
  const [phase, setPhase] = useState('loading');
  const [error, setError] = useState('');
  const [invite, setInvite] = useState(null);
  const [previousInterview, setPreviousInterview] = useState(null);
  const [actionLoading, setActionLoading] = useState('');
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

  const saveProfile = useCallback(
    async payload => {
      if (apisAdapterRef.current?.saveProfile) {
        return apisAdapterRef.current.saveProfile(payload);
      }
      const { data: saveRes } = await ajax(
        Object.assign({}, apis.talentSaas.tenant.assessment.saveProfile, {
          data: { profileData: payload }
        })
      );
      if (saveRes.code !== 0) {
        throw new Error(saveRes.msg || formatMessage({ id: 'tenantAdmin.completeInterviewSaveFailed' }));
      }
      return saveRes.data;
    },
    [ajax, apis, formatMessage]
  );

  const loadDetail = useCallback(async () => {
    if (apisAdapterRef.current?.detail) {
      return apisAdapterRef.current.detail();
    }
    const { data: detailRes } = await ajax(Object.assign({}, apis.talentSaas.tenant.assessment.detail));
    if (detailRes.code !== 0) {
      throw new Error(detailRes.msg || formatMessage({ id: 'tenantAdmin.completeInterviewInviteFailed' }));
    }
    return detailRes.data;
  }, [ajax, apis, formatMessage]);

  const loadEnsureInvite = useCallback(
    async (options = {}) => {
      if (apisAdapterRef.current?.ensureInvite) {
        const data = await apisAdapterRef.current.ensureInvite(options);
        openInterviewRoom(data);
        return data;
      }
      const { data: inviteRes } = await ajax(
        Object.assign({}, apis.talentSaas.tenant.assessment.ensureInvite, {
          data: options
        })
      );
      if (inviteRes.code !== 0) {
        throw new Error(inviteRes.msg || formatMessage({ id: 'tenantAdmin.completeInterviewInviteFailed' }));
      }
      openInterviewRoom(inviteRes.data);
      return inviteRes.data;
    },
    [ajax, apis, formatMessage, openInterviewRoom]
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
      setPreviousInterview(null);
      try {
        const payload = profilePayloadRef.current;
        if (payload) {
          await saveProfile(payload);
        }
        if (cancelled) {
          return;
        }

        const detail = await loadDetail();
        if (cancelled) {
          return;
        }
        if (choiceResolvedRef.current) {
          return;
        }

        if (detail?.previousInterview && !apisAdapterRef.current?.skipPreviousInterview) {
          setPreviousInterview(detail.previousInterview);
          setPhase('choice');
          settled = true;
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
      if (apisAdapterRef.current?.markDone) {
        await apisAdapterRef.current.markDone({ interviewId: invite?.interviewId || invite?.clientUserId });
      } else {
        await ajax(Object.assign({}, apis.talentSaas.tenant.assessment.detail));
      }
    } catch (e) {
      // ignore sync error
    }
  }, [ajax, apis, invite]);

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

  const handleUsePrevious = async () => {
    setActionLoading('previous');
    setError('');
    try {
      const { data: resData } = await ajax(
        Object.assign({}, apis.talentSaas.tenant.assessment.acceptPrevious, {
          data: { forceCompleted: true }
        })
      );
      if (resData.code !== 0) {
        throw new Error(resData.msg || formatMessage({ id: 'tenantAdmin.assessmentAcceptPreviousFailed' }));
      }
      finishDirectly();
    } catch (e) {
      choiceResolvedRef.current = false;
      setError(e.message || formatMessage({ id: 'tenantAdmin.assessmentAcceptPreviousFailed' }));
      setPhase('error');
    } finally {
      setActionLoading('');
    }
  };

  const handleContinueInterview = async () => {
    setActionLoading('continue');
    setError('');
    try {
      choiceResolvedRef.current = true;
      bootOnceRef.current = true;
      await loadEnsureInvite();
    } catch (e) {
      choiceResolvedRef.current = false;
      setError(e.message || formatMessage({ id: 'tenantAdmin.completeInterviewInviteFailed' }));
      setPhase('error');
    } finally {
      setActionLoading('');
    }
  };

  const handleRetakeInterview = async () => {
    setActionLoading('new');
    setError('');
    try {
      choiceResolvedRef.current = true;
      bootOnceRef.current = true;
      await loadEnsureInvite({ forceNew: true });
    } catch (e) {
      choiceResolvedRef.current = false;
      setError(e.message || formatMessage({ id: 'tenantAdmin.completeInterviewInviteFailed' }));
      setPhase('error');
    } finally {
      setActionLoading('');
    }
  };

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

  if (phase === 'choice') {
    return <InterviewHistoryChoice previousInterview={previousInterview} loading={actionLoading} onUsePrevious={handleUsePrevious} onContinueInterview={handleContinueInterview} onRetakeInterview={handleRetakeInterview} />;
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
          onStageChange={event => {
            // 问卷 / 设备检测完成 / 作答结束 / 评价：隐藏宿主「上一步」，避免与会话内提交条重叠
            if (event?.stage === 'questionnaire') {
              onInterviewLockChangeRef.current?.(true);
            }
            if (event?.stage === 'deviceTesting' && event?.status === 'complete') {
              onInterviewLockChangeRef.current?.(true);
            }
            if (event?.stage === 'interview' && event?.status === 'complete') {
              onInterviewLockChangeRef.current?.(true);
              // 保持 room，让 Session 继续渲染 Feedback；后台 markDone 即可
              syncInterviewComplete();
              // 作答完成即结束本步，完成后不再显示「上一步」
              onInterviewCompleteRef.current?.({
                stage: 'interview',
                status: 'complete'
              });
            }
            if (event?.stage === 'feedback') {
              onInterviewLockChangeRef.current?.(true);
              if (event?.status === 'complete') {
                handleFeedbackComplete();
              }
            }
          }}
        />
      </div>
    </div>
  );
});

export default InterviewStep;
