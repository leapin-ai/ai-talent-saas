import { useEffect, useMemo, useState } from 'react';
import { Flex, Spin } from 'antd';
import { createWithRemoteLoader } from '@kne/remote-loader';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useIntl } from '@kne/react-intl';
import SystemLayout, { Page } from '@kne/system-layout';
import '@kne/system-layout/dist/index.css';
import { ResultCard } from '@kne/react-box';
import '@kne/react-box/dist/index.css';
import RoleInsights from '@components/Position/Detail/RoleInsights';
import ProfileReadiness from '@components/TalentProfile/ProfileReadiness';
import TenantThemeProvider from '../../commons/TenantThemeProvider';
import { resolveTenantThemeColor } from '../../commons/themeColor';
import withLocale from './withLocale';

const BACKGROUND = 'linear-gradient(180deg, #E8DCDF, #E1D1E3, #DED7EF, #D5E0F1)';

const withCode = (api, code) => Object.assign({}, api, { url: `${api.url}?code=${encodeURIComponent(code)}` });

/** 免登录分享报告：岗位只读展示岗位洞察，人才只读展示就绪度 */
const ShareReport = createWithRemoteLoader({
  modules: ['components-core:Global@usePreset', 'components-admin:Account@Language', 'components-core:Global@SetGlobal']
})(
  withLocale(({ remoteModules }) => {
    const [usePreset, Language, SetGlobal] = remoteModules;
    const { apis, ajax } = usePreset();
    const { formatMessage } = useIntl();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const code = searchParams.get('code') || '';
    const [detail, setDetail] = useState(null);
    const [loading, setLoading] = useState(!!code);
    const [error, setError] = useState('');
    const publicApis = apis.talentSaas.public.shareReport;

    useEffect(() => {
      let cancelled = false;
      if (!code) {
        setLoading(false);
        setError(formatMessage({ id: 'shareReport.invalidDesc' }));
        return undefined;
      }
      setLoading(true);
      setError('');
      (async () => {
        try {
          const { data } = await ajax(Object.assign({}, publicApis.detail, { params: { code } }));
          if (cancelled) {
            return;
          }
          if (data.code !== 0) {
            throw new Error(data.msg || formatMessage({ id: 'shareReport.invalidDesc' }));
          }
          setDetail(data.data || null);
        } catch (e) {
          if (!cancelled) {
            setError(e.message || formatMessage({ id: 'shareReport.invalidDesc' }));
            setDetail(null);
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
    }, [ajax, publicApis, code, formatMessage]);

    // ProfileReadiness / RoleInsights 的 effect 依赖 apis 引用，必须稳定
    const roleApis = useMemo(
      () => ({
        tasks: withCode(publicApis.tasks, code),
        employeeList: withCode(publicApis.talentMetrics, code)
      }),
      [publicApis, code]
    );
    const readinessApis = useMemo(
      () => ({
        talentSaas: {
          tenant: {
            position: {
              tasks: withCode(publicApis.tasks, code),
              taskReadiness: withCode(publicApis.taskReadiness, code),
              skillAnalysisDetail: withCode(publicApis.skillAnalysisDetail, code)
            },
            employee: {
              evidence: withCode(publicApis.evidence, code)
            }
          }
        }
      }),
      [publicApis, code]
    );

    if (loading) {
      return (
        <Flex align="center" justify="center" style={{ minHeight: '100vh', background: BACKGROUND }}>
          <Spin size="large" />
        </Flex>
      );
    }

    if (error || !detail) {
      return (
        <Flex align="center" justify="center" style={{ minHeight: '100vh', padding: '48px 24px', background: BACKGROUND }}>
          <ResultCard.Error width={560} title={formatMessage({ id: 'shareReport.invalidTitle' })} description={error || formatMessage({ id: 'shareReport.invalidDesc' })} />
        </Flex>
      );
    }

    const tenant = detail.tenant || {};
    const companyName = tenant.companyName || tenant.name || '';
    const isPosition = detail.kind === 'position';
    const position = detail.position || {};
    const employee = detail.employee || {};
    const department = isPosition ? (position.orgEnums || []).find(item => String(item.value) === String(position.tenantOrgId))?.description || '' : '';
    const title = isPosition ? position.name : [employee.name, employee.positionName].filter(Boolean).join(' · ');

    return (
      <TenantThemeProvider themeColor={resolveTenantThemeColor({ tenant })} SetGlobal={SetGlobal}>
        <SystemLayout
          background={BACKGROUND}
          logo={tenant.logo ? { id: tenant.logo } : undefined}
          userInfo={{
            name: companyName,
            description: isPosition ? [position.name, department].filter(Boolean).join(' · ') : title,
            extra: (
              <div style={{ paddingTop: 8 }}>
                <Language colorful={false} />
              </div>
            )
          }}
          menu={{
            base: '',
            activeKey: 'report',
            items: [
              {
                key: 'report',
                path: '/share-report',
                label: formatMessage({ id: isPosition ? 'shareReport.menuPosition' : 'shareReport.menuEmployee' }),
                toolbar: true,
                icon: 'icon-assignment',
                onClick: () => navigate(`/share-report?code=${encodeURIComponent(code)}`)
              }
            ]
          }}
        >
          <Page title={title}>
            {isPosition ? (
              <RoleInsights apis={roleApis} position={position} />
            ) : (
              <ProfileReadiness apis={readinessApis} employeeId={employee.id} positionId={employee.positionId} displayName={employee.name} readOnly showLooksWrong={false} />
            )}
          </Page>
        </SystemLayout>
      </TenantThemeProvider>
    );
  })
);

export default ShareReport;
