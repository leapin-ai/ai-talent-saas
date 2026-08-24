import { Alert, Spin } from 'antd';
import { createWithRemoteLoader } from '@kne/remote-loader';
import { useIntl } from '@kne/react-intl';

/**
 * 依赖 preset 已 applyAiInterviewRemote；ComponentPreset 按 apiHost 合并宿主 preset 并注入本包 apis/ajax
 */
const AIInterviewRoom = createWithRemoteLoader({
  modules: ['ai-interview-flowup:ComponentPreset', 'ai-interview-flowup:InterviewSession']
})(({ remoteModules, ajaxBaseUrl, apiUrl, shorten, style, onStageChange }) => {
  const [ComponentPreset, InterviewSession] = remoteModules;
  const { formatMessage } = useIntl();
  const apiHost = apiUrl || ajaxBaseUrl;

  if (!ComponentPreset || !InterviewSession) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 48, ...style }}>
        <Spin />
      </div>
    );
  }

  if (!apiHost || !shorten) {
    return <Alert type="warning" showIcon message={formatMessage({ id: 'tenantAdmin.completeInterviewNotReady' })} />;
  }

  return (
    <div style={{ width: '100%', height: '100%', minHeight: '70vh', ...style }}>
      <ComponentPreset apiHost={apiHost}>
        <InterviewSession
          key={shorten}
          shorten={shorten}
          height="100%"
          onStageChange={event => {
            onStageChange && onStageChange(event);
          }}
        />
      </ComponentPreset>
    </div>
  );
});

export default AIInterviewRoom;
