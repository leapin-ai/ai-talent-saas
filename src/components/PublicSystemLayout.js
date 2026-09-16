import { useEffect, useMemo, useState } from 'react';
import { Flex, Spin } from 'antd';
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

/**
 * 免登录采集壳：SystemLayout + 租户 logo/主题色 + 被邀请人信息 + 语言切换 + Assessment 菜单。
 */
const PublicSystemLayout = createWithRemoteLoader({
  modules: ['components-core:Global@usePreset', 'components-admin:Account@Language', 'components-core:Global@SetGlobal']
})(
  withLocale(({ remoteModules, children, background = BACKGROUND }) => {
    const [usePreset, Language, SetGlobal] = remoteModules;
    const { apis, ajax } = usePreset();
    const { formatMessage } = useIntl();
    const navigate = useNavigate();
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

    const assessmentPath = useMemo(() => {
      if (!code) {
        return '/collect-profile';
      }
      return `/collect-profile?code=${encodeURIComponent(code)}`;
    }, [code]);

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
            description: [tenant.companyName || tenant.name, invite?.position?.name].filter(Boolean).join(' · '),
            extra: (
              <div style={{ paddingTop: 8 }}>
                <Language colorful={false} />
              </div>
            )
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
  })
);

export default PublicSystemLayout;
