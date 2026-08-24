import { useLayoutEffect } from 'react';
import { useGlobalValue } from '@kne/global-context';
import { applyThemeColorToContainer, getThemeContainer, injectTenantThemeStylesheet, observeTenantThemeOverride } from './themeColor';

const TenantThemeProvider = ({ themeColor, SetGlobal, children }) => {
  const existingThemeToken = useGlobalValue('themeToken') || {};

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

  if (!themeColor || !SetGlobal) {
    return children;
  }

  return (
    <SetGlobal globalKey="themeToken" value={{ ...existingThemeToken, colorPrimary: themeColor }}>
      {children}
    </SetGlobal>
  );
};

export default TenantThemeProvider;
