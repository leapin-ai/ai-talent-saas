import { Alert, Spin } from 'antd';
import { createWithRemoteLoader } from '@kne/remote-loader';
import { useIntl } from '@kne/react-intl';

/**
 * 依赖 preset 已 applyAiInterviewRemote；ComponentPreset 按 apiHost 合并宿主 preset 并注入本包 apis/ajax。
 * themeToken 取自宿主 Global，使嵌入面试间与当前系统主题色一致。
 */
const AIInterviewRoom = createWithRemoteLoader({
  modules: ['ai-interview-flowup:ComponentPreset', 'ai-interview-flowup:InterviewSession', 'components-core:Global@useGlobalValue']
})(({ remoteModules, ajaxBaseUrl, apiUrl, shorten, style, height = '100%', onStageChange }) => {
  const [ComponentPreset, InterviewSession, useGlobalValue] = remoteModules;
  const { formatMessage } = useIntl();
  const hostThemeToken = useGlobalValue('themeToken');
  const apiHost = apiUrl || ajaxBaseUrl;
  // 最大宽度按传入高度约 16:9 并居中；百分比高度由外层容器约束（% 在 max-width 中按宽度解析）
  const heightStr = String(height).trim();
  const maxWidth = /%$/.test(heightStr) ? '100%' : `min(100%, calc((${heightStr}) * 16 / 9))`;
  const roomStyle = {
    width: '100%',
    height: heightStr,
    maxWidth,
    marginLeft: 'auto',
    marginRight: 'auto',
    boxSizing: 'border-box',
    ...style
  };

  if (!ComponentPreset || !InterviewSession) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 48, ...roomStyle }}>
        <Spin />
      </div>
    );
  }

  if (!apiHost || !shorten) {
    return <Alert type="warning" showIcon message={formatMessage({ id: 'tenantAdmin.completeInterviewNotReady' })} />;
  }

  return (
    <div style={roomStyle}>
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
