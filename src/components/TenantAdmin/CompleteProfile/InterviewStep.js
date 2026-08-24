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
})(({ remoteModules, profilePayload, onInterviewComplete }) => {
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

  profilePayloadRef.current = profilePayload;
  onInterviewCompleteRef.current = onInterviewComplete;

  const finishDirectly = useCallback(() => {
    choiceResolvedRef.current = true;
    bootOnceRef.current = true;
    onInterviewCompleteRef.current && onInterviewCompleteRef.current({ stage: 'interview', status: 'complete', directFinish: true });
  }, []);

  const openInterviewRoom = useCallback(
    data => {
      if (data?.status === 'generating') {
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

  const loadEnsureInvite = useCallback(
    async (options = {}) => {
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

  // 只 boot 一次，避免 deps 变化导致死循环
  useEffect(() => {
    if (bootOnceRef.current || choiceResolvedRef.current) {
      return undefined;
    }
    bootOnceRef.current = true;

    let cancelled = false;
    (async () => {
      setPhase('loading');
      setError('');
      setInvite(null);
      setPreviousInterview(null);
      try {
        const payload = profilePayloadRef.current;
        if (payload) {
          const { data: saveRes } = await ajax(
            Object.assign({}, apis.talentSaas.tenant.assessment.saveProfile, {
              data: { profileData: payload }
            })
          );
          if (saveRes.code !== 0) {
            throw new Error(saveRes.msg || formatMessage({ id: 'tenantAdmin.completeInterviewSaveFailed' }));
          }
        }

        const { data: detailRes } = await ajax(Object.assign({}, apis.talentSaas.tenant.assessment.detail));
        if (detailRes.code !== 0) {
          throw new Error(detailRes.msg || formatMessage({ id: 'tenantAdmin.completeInterviewInviteFailed' }));
        }
        const detail = detailRes.data;
        if (cancelled || choiceResolvedRef.current) {
          return;
        }

        if (detail?.previousInterview) {
          setPreviousInterview(detail.previousInterview);
          setPhase('choice');
          return;
        }

        await loadEnsureInvite();
      } catch (e) {
        if (!cancelled && !choiceResolvedRef.current) {
          bootOnceRef.current = false;
          setError(e.message || formatMessage({ id: 'tenantAdmin.completeInterviewInviteFailed' }));
          setPhase('error');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- boot once on mount
  }, []);

  const handleInterviewSessionComplete = useCallback(async () => {
    setPhase('loading');
    setError('');
    try {
      const { data: detailRes } = await ajax(Object.assign({}, apis.talentSaas.tenant.assessment.detail));
      if (detailRes.code !== 0) {
        throw new Error(detailRes.msg || formatMessage({ id: 'tenantAdmin.completeInterviewInviteFailed' }));
      }
      const detail = detailRes.data;
      if (detail?.previousInterview) {
        choiceResolvedRef.current = false;
        setInvite(null);
        setPreviousInterview(detail.previousInterview);
        setPhase('choice');
        return;
      }
      finishDirectly();
    } catch (e) {
      setError(e.message || formatMessage({ id: 'tenantAdmin.completeInterviewInviteFailed' }));
      setPhase('error');
    }
  }, [ajax, apis, finishDirectly, formatMessage]);

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

  if (phase === 'error') {
    return <Alert type="error" showIcon message={error} />;
  }

  if (phase === 'choice') {
    return <InterviewHistoryChoice previousInterview={previousInterview} loading={actionLoading} onUsePrevious={handleUsePrevious} onRetakeInterview={handleRetakeInterview} />;
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
            if (event?.stage === 'interview' && event?.status === 'complete') {
              handleInterviewSessionComplete();
            }
          }}
        />
      </div>
    </div>
  );
});

export default InterviewStep;
