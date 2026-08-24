import { useEffect, useState } from 'react';
import { Alert, Empty, Flex, Spin } from 'antd';
import { createWithRemoteLoader } from '@kne/remote-loader';
import { useIntl } from '@kne/react-intl';
import { applyAiInterviewRemote } from '../../../preset';
import AIInterviewRoom from './AIInterviewRoom';
import style from './style.module.scss';

const InterviewStep = createWithRemoteLoader({
  modules: ['components-core:Global@usePreset']
})(({ remoteModules, profilePayload, onInterviewComplete }) => {
  const [usePreset] = remoteModules;
  const { apis, ajax } = usePreset();
  const { formatMessage } = useIntl();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [invite, setInvite] = useState(null);
  const [remoteReady, setRemoteReady] = useState(false);

  useEffect(() => {
    if (invite?.status === 'generating') {
      onInterviewComplete && onInterviewComplete({ stage: 'interview', status: 'complete' });
    }
  }, [invite?.status, onInterviewComplete]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError('');
      setRemoteReady(false);
      try {
        if (profilePayload) {
          const { data: saveRes } = await ajax(
            Object.assign({}, apis.talentSaas.tenant.assessment.saveProfile, {
              data: { profileData: profilePayload }
            })
          );
          if (saveRes.code !== 0) {
            throw new Error(saveRes.msg || formatMessage({ id: 'tenantAdmin.completeInterviewSaveFailed' }));
          }
        }
        const { data: inviteRes } = await ajax(Object.assign({}, apis.talentSaas.tenant.assessment.ensureInvite, { data: {} }));
        if (inviteRes.code !== 0) {
          throw new Error(inviteRes.msg || formatMessage({ id: 'tenantAdmin.completeInterviewInviteFailed' }));
        }
        const data = inviteRes.data;
        if (!cancelled) {
          setInvite(data);
        }
        if (data?.status !== 'generating') {
          if (!data?.cdnUrl || !data?.version) {
            throw new Error(formatMessage({ id: 'tenantAdmin.completeInterviewNotReady' }));
          }
          const ok = applyAiInterviewRemote({ cdnUrl: data.cdnUrl, version: data.version });
          if (!ok) {
            throw new Error(formatMessage({ id: 'tenantAdmin.completeInterviewNotReady' }));
          }
          if (!cancelled) {
            setRemoteReady(true);
          }
        }
      } catch (e) {
        if (!cancelled) {
          setError(e.message || formatMessage({ id: 'tenantAdmin.completeInterviewInviteFailed' }));
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [ajax, apis, profilePayload, formatMessage]);

  if (loading) {
    return (
      <Flex justify="center" style={{ padding: 48 }}>
        <Spin />
      </Flex>
    );
  }

  if (error) {
    return <Alert type="error" showIcon message={error} />;
  }

  if (invite?.status === 'generating') {
    return <Empty description={formatMessage({ id: 'tenantAdmin.assessmentGenerating' })} />;
  }

  if (!invite?.shorten || !invite?.cdnUrl || !invite?.version || !remoteReady) {
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
              onInterviewComplete && onInterviewComplete(event);
            }
          }}
        />
      </div>
    </div>
  );
});

export default InterviewStep;
