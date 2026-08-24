import { useLayoutEffect, useMemo } from 'react';
import { ConfigProvider } from 'antd';
import { useGlobalValue } from '@kne/global-context';
import { applyThemeColorToContainer, getThemeContainer, injectTenantThemeStylesheet, observeTenantThemeOverride } from './themeColor';

const TenantThemeProvider = ({ themeColor, SetGlobal, children }) => {
  const existingThemeToken = useGlobalValue('themeToken') || {};
  const themeToken = useMemo(() => {
    if (!themeColor) {
      return existingThemeToken;
    }
    if (existingThemeToken.colorPrimary === themeColor && existingThemeToken.colorLink === themeColor) {
      return existingThemeToken;
    }
    return { ...existingThemeToken, colorPrimary: themeColor, colorLink: themeColor };
  }, [existingThemeToken, themeColor]);

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
