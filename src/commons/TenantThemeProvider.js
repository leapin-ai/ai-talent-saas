import { useLayoutEffect, useMemo, useRef } from 'react';
import { ConfigProvider } from 'antd';
import { useGlobalValue } from '@kne/global-context';
import { applyThemeColorToContainer, getThemeContainer, injectTenantThemeStylesheet, observeTenantThemeOverride } from './themeColor';

const TenantThemeProvider = ({ themeColor, SetGlobal, children }) => {
  const globalThemeToken = useGlobalValue('themeToken');
  // 下面派生出的 token 会被 SetGlobal 写回同一个 globalKey，若把读到的全局值放进 useMemo
  // 依赖，就构成读-派生-写回的自反馈环：每轮渲染都产出新引用，写回后又触发重渲染。
  // 基准 token 由 App 根部一次性注入（见 App.js 的 <Global themeToken>），生命周期内不变，
  // 故只在首次渲染捕获，之后不再参与依赖，themeToken 的引用只随 themeColor 变化。
  const baseThemeTokenRef = useRef(null);
  if (baseThemeTokenRef.current === null) {
    baseThemeTokenRef.current = globalThemeToken || {};
  }
  const themeToken = useMemo(() => {
    const baseThemeToken = baseThemeTokenRef.current;
    if (!themeColor) {
      return baseThemeToken;
    }
    return { ...baseThemeToken, colorPrimary: themeColor, colorLink: themeColor };
  }, [themeColor]);

  useLayoutEffect(() => {
    if (!themeColor) {
      return undefined;
    }

    const applyTheme = () => {
      injectTenantThemeStylesheet(themeColor);
      applyThemeColorToContainer(themeColor);
    };

    applyTheme();

    let frameId = 0;
    let attempts = 0;
    const retryUntilApplied = () => {
      applyTheme();
      attempts += 1;
      if (!getThemeContainer() && attempts < 60) {
        frameId = window.requestAnimationFrame(retryUntilApplied);
      }
    };

    if (!getThemeContainer()) {
      frameId = window.requestAnimationFrame(retryUntilApplied);
    }

    const disconnectObserver = observeTenantThemeOverride(themeColor, () => {
      applyThemeColorToContainer(themeColor);
    });

    return () => {
      window.cancelAnimationFrame(frameId);
      disconnectObserver();
    };
  }, [themeColor]);

  let content = children;
  if (themeColor) {
    content = <ConfigProvider theme={{ token: themeToken }}>{content}</ConfigProvider>;
  }
  if (themeColor && SetGlobal) {
    content = (
      <SetGlobal globalKey="themeToken" value={themeToken}>
        {content}
      </SetGlobal>
    );
  }
  return content;
};

export default TenantThemeProvider;
