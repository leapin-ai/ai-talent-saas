import { useMemo } from 'react';
import { Alert, App, Spin } from 'antd';
import { createWithRemoteLoader } from '@kne/remote-loader';
import createAjax from '@kne/axios-fetch';
import { getToken } from '@kne/token-storage';
import { useIntl } from '@kne/react-intl';

/** 与 ai-interview-flowup Apis.getApis().interview 对齐；每条带上 interviewAjax，避免 Fetch 回落到宿主 ajax */
const buildInterviewApis = (prefix, ajax) => ({
  code: { url: `${prefix}/interview/code`, method: 'GET', ajax },
  resolveNoLogin: { url: `${prefix}/interview/resolve-no-login`, method: 'GET', ajax },
  login: { url: `${prefix}/interview/login`, method: 'POST', ajax },
  getUserInfo: { url: `${prefix}/interview/userInfo`, method: 'GET', ajax },
  start: { url: `${prefix}/interview/start`, method: 'POST', ajax },
  stop: { url: `${prefix}/interview/stop`, method: 'POST', ajax },
  getToken: { url: `${prefix}/interview/token`, method: 'GET', ajax },
  result: { url: `${prefix}/interview/result`, method: 'GET', ajax },
  complete: { url: `${prefix}/interview/complete`, method: 'POST', ajax },
  checkRecordTask: { url: `${prefix}/interview/checkRecordTask`, method: 'GET', ajax },
  createUserEvent: { url: `${prefix}/interview/user-event`, method: 'POST', ajax },
  enterRoom: { url: `${prefix}/interview/enter-room`, method: 'POST', ajax },
  feedback: { url: `${prefix}/interview/feedback`, method: 'POST', ajax }
});

const normalizeInterviewApiPrefix = apiUrl => {
  const base = String(apiUrl || '')
    .trim()
    .replace(/\/+$/, '');
  if (!base) {
    return '';
  }
  if (/\/api\/v\d+$/i.test(base)) {
    return base;
  }
  return `${base}/api/v1`;
};

/**
 * 依赖 preset 已 applyAiInterviewRemote；用标准 token 加载 InterviewSession
 */
const AIInterviewRoom = createWithRemoteLoader({
  modules: ['components-core:Global@PureGlobal', 'ai-interview-flowup:InterviewSession']
})(({ remoteModules, ajaxBaseUrl, apiUrl, shorten, style, onStageChange }) => {
  const [PureGlobal, InterviewSession] = remoteModules;
  const { formatMessage } = useIntl();
  const { message } = App.useApp();

  const interviewApiPrefix = useMemo(() => normalizeInterviewApiPrefix(apiUrl || ajaxBaseUrl), [apiUrl, ajaxBaseUrl]);

  const interviewPreset = useMemo(() => {
    if (!interviewApiPrefix) {
      return null;
    }
    const interviewAjax = createAjax({
      baseURL: '',
      errorHandler: error => message.error(error),
      getDefaultHeaders: () => ({
        'X-Candidate-Token': getToken('X-Candidate-Token')
      })
    });
    return {
      ajax: interviewAjax,
      apis: {
        interview: buildInterviewApis(interviewApiPrefix, interviewAjax),
        file: {
          getUrl: {
            url: `${interviewApiPrefix}/static/file-url/{id}`,
            paramsType: 'urlParams',
            ignoreSuccessState: true,
            ajax: interviewAjax
          },
          upload: ({ file, path }) =>
            interviewAjax.postForm({
              url: `${interviewApiPrefix}/static/upload`,
              params: path ? { path } : undefined,
              data: { file }
            })
        }
      }
    };
  }, [interviewApiPrefix, message]);

  if (!InterviewSession || !PureGlobal) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 48, ...style }}>
        <Spin />
      </div>
    );
  }

  if (!interviewPreset || !shorten) {
    return <Alert type="warning" showIcon message={formatMessage({ id: 'tenantAdmin.completeInterviewNotReady' })} />;
  }

  return (
    <div style={{ width: '100%', height: '100%', minHeight: '70vh', ...style }}>
      <PureGlobal preset={interviewPreset}>
        <InterviewSession
          key={shorten}
          shorten={shorten}
          height="100%"
          onStageChange={event => {
            console.log('[InterviewSession onStageChange]', event);
            onStageChange && onStageChange(event);
          }}
        />
      </PureGlobal>
    </div>
  );
});

export default AIInterviewRoom;
