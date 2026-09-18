import { Alert, Spin } from 'antd';
import { createWithRemoteLoader } from '@kne/remote-loader';
import { useIntl } from '@kne/react-intl';

/**
 * 依赖 preset 已 applyAiInterviewRemote；ComponentPreset 按 apiHost 合并宿主 preset 并注入本包 apis/ajax。
 * themeToken 取自宿主 Global，使嵌入面试间与当前系统主题色一致。
 *
 * height：宿主测得的容器最大高度（number=px，或 css 长度字符串）。原样传给 InterviewSession。
 * 不要写死 height="100%"：父级 height:auto 时百分比会塌成 0。
 */
const AIInterviewRoom = createWithRemoteLoader({
  modules: ['ai-interview-flowup:ComponentPreset', 'ai-interview-flowup:InterviewSession', 'components-core:Global@useGlobalValue']
})(({ remoteModules, ajaxBaseUrl, apiUrl, shorten, style, height, onStageChange }) => {
  const [ComponentPreset, InterviewSession, useGlobalValue] = remoteModules;
  const { formatMessage } = useIntl();
  const hostThemeToken = useGlobalValue('themeToken');
  const apiHost = apiUrl || ajaxBaseUrl;
  const hasHeight = height != null && height !== '' && height !== 'auto';
  const heightStr = hasHeight ? (typeof height === 'number' ? `${height}px` : String(height).trim()) : null;
  // 明确 px/长度时按约 16:9 限宽居中；未测到高度前先全宽占位
  const maxWidth = heightStr && !/%$/.test(heightStr) ? `min(100%, calc((${heightStr}) * 16 / 9))` : '100%';
  const roomStyle = {
    width: '100%',
    height: heightStr || 'auto',
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
          {...(hasHeight ? { height: typeof height === 'number' ? height : heightStr } : {})}
          onStageChange={event => {
            onStageChange && onStageChange(event);
          }}
        />
      </ComponentPreset>
    </div>
  );
});

export default AIInterviewRoom;
