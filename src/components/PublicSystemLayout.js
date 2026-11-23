import { useEffect, useMemo, useState } from 'react';
import { ConfigProvider, Flex, Spin } from 'antd';
import enUS from 'antd/locale/en_US';
import zhCN from 'antd/locale/zh_CN';
import { createWithRemoteLoader } from '@kne/remote-loader';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useIntl } from '@kne/react-intl';
import SystemLayout from '@kne/system-layout';
import '@kne/system-layout/dist/index.css';
import { ResultCard } from '@kne/react-box';
import '@kne/react-box/dist/index.css';
import withLocale from '../withLocale';
import TenantThemeProvider from '../commons/TenantThemeProvider';
import { resolveTenantThemeColor } from '../commons/themeColor';

const BACKGROUND = 'linear-gradient(180deg, #E8DCDF, #E1D1E3, #DED7EF, #D5E0F1)';

const normalizeLocale = language => (language === 'en-US' ? 'en-US' : 'zh-CN');

/** 锁定语言后的壳层：文案走 SetGlobal 的 locale，不提供语言切换 */
const CollectShell = withLocale(({ invite, children, background, SetGlobal }) => {
  const { formatMessage } = useIntl();
  const navigate = useNavigate();
  const code = invite?.code || '';
  const assessmentPath = useMemo(() => {
    if (!code) {
      return '/collect-profile';
    }
    return `/collect-profile?code=${encodeURIComponent(code)}`;
  }, [code]);

  const tenant = invite?.tenant || {};
  const logoId = tenant.logo || null;
  const themeColor = resolveTenantThemeColor({ tenant });

  return (
    <TenantThemeProvider themeColor={themeColor} SetGlobal={SetGlobal}>
      <SystemLayout
        background={background}
        logo={logoId ? { id: logoId } : undefined}
        userInfo={{
          name: invite?.name || '',
          email: invite?.email || '',
          phone: invite?.phone || '',
          description: [tenant.companyName || tenant.name, invite?.position?.name].filter(Boolean).join(' · ')
        }}
        menu={{
          base: '',
          // path 带 query 时无法按 pathname 匹配，固定选中 Assessment
          activeKey: 'assessment',
          items: [
            {
              key: 'assessment',
              path: '/collect-profile',
              label: formatMessage({ id: 'app.collectAssessment' }),
              toolbar: true,
              icon: 'icon-assignment',
              onClick: () => {
                navigate(assessmentPath);
              }
            }
          ]
        }}
      >
        {children}
      </SystemLayout>
    </TenantThemeProvider>
  );
});

/**
 * 免登录采集壳：SystemLayout + 租户 logo/主题色 + 被邀请人信息。
 * 页面语言取自邀请记录，锁定后不提供切换。
 */
const PublicSystemLayout = createWithRemoteLoader({
  modules: ['components-core:Global@usePreset', 'components-core:Global@SetGlobal']
})(
  withLocale(({ remoteModules, children, background = BACKGROUND }) => {
    const [usePreset, SetGlobal] = remoteModules;
    const { apis, ajax } = usePreset();
    const { formatMessage } = useIntl();
    const [searchParams] = useSearchParams();
    const code = searchParams.get('code') || '';
    const [invite, setInvite] = useState(null);
    const [loading, setLoading] = useState(!!code);
    const [error, setError] = useState('');

    useEffect(() => {
      let cancelled = false;
      if (!code) {
        setLoading(false);
        setError(formatMessage({ id: 'app.collectInviteInvalidDesc' }));
        return undefined;
      }
      setLoading(true);
      setError('');
      (async () => {
        try {
          const { data } = await ajax(
            Object.assign({}, apis.talentSaas.public.talentCollectInvite.detail, {
              params: { code }
            })
          );
          if (cancelled) {
            return;
          }
          if (data.code !== 0) {
            throw new Error(data.msg || formatMessage({ id: 'app.collectInviteInvalidDesc' }));
          }
          setInvite(data.data || null);
        } catch (e) {
          if (!cancelled) {
            setError(e.message || formatMessage({ id: 'app.collectInviteInvalidDesc' }));
            setInvite(null);
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
    }, [ajax, apis, code, formatMessage]);

    if (loading) {
      return (
        <Flex align="center" justify="center" style={{ minHeight: '100vh', background }}>
          <Spin size="large" />
        </Flex>
      );
    }

    if (error) {
      return (
        <Flex align="center" justify="center" style={{ minHeight: '100vh', padding: '48px 24px', background }}>
          <ResultCard.Error width={560} title={formatMessage({ id: 'app.collectInviteInvalidTitle' })} description={error} />
        </Flex>
      );
    }

    const locale = normalizeLocale(invite?.language);

    return (
      <SetGlobal globalKey="locale" value={locale}>
        <ConfigProvider locale={locale === 'en-US' ? enUS : zhCN}>
          <CollectShell invite={invite} background={background} SetGlobal={SetGlobal}>
            {children}
          </CollectShell>
        </ConfigProvider>
      </SetGlobal>
    );
  })
);

export default PublicSystemLayout;
