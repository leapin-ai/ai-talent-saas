import { Alert, Spin } from 'antd';
import { createWithRemoteLoader } from '@kne/remote-loader';
import { useIntl } from '@kne/react-intl';

/**
 * 依赖 preset 已 applyAiInterviewRemote；ComponentPreset 按 apiHost 合并宿主 preset 并注入本包 apis/ajax。
 * themeToken 取自宿主 Global，使嵌入面试间与当前系统主题色一致。
 */
const AIInterviewRoom = createWithRemoteLoader({
  modules: ['ai-interview-flowup:ComponentPreset', 'ai-interview-flowup:InterviewSession', 'components-core:Global@useGlobalValue']
})(({ remoteModules, ajaxBaseUrl, apiUrl, shorten, style, onStageChange }) => {
  const [ComponentPreset, InterviewSession, useGlobalValue] = remoteModules;
  const { formatMessage } = useIntl();
  const hostThemeToken = useGlobalValue('themeToken');
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
      <ComponentPreset apiHost={apiHost} themeToken={hostThemeToken}>
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
