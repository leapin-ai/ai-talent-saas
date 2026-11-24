import { Button, Empty, Spin, Tabs } from 'antd';
import { EditOutlined } from '@ant-design/icons';
import { createWithRemoteLoader } from '@kne/remote-loader';
import withLocale from '../withLocale';
import { useIntl } from '@kne/react-intl';
import { useFetch } from '@kne/react-fetch';
import { useLocation, useMatch, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Page } from '@kne/system-layout';
import { TENANT_ADMIN_PERMISSIONS } from '@components/TenantAdmin/constants';
import ReportGuideLink from '../../../commons/ReportGuideLink';
import AnalyzeTalent from './AnalyzeTalent';
import RoleInsights from './RoleInsights';
import PositionInfoPanel from './PositionInfoPanel';
import style from './style.module.scss';

const DETAIL_TAB_KEYS = ['insights', 'analyze', 'role'];
const DEFAULT_DETAIL_TAB = 'insights';

/** splat 布局下 useParams().id 偶发丢失时，用完整 pathname 再解析一次 */
const resolvePositionId = ({ paramId, pathname, baseUrl = '' }) => {
  if (paramId) {
    return String(paramId);
  }
  const prefix = `${String(baseUrl).replace(/\/$/, '')}/position/`;
  const path = String(pathname || '');
  const fromPrefix = path.startsWith(prefix) ? path.slice(prefix.length).split('/')[0] : '';
  const segments = path.split('/').filter(Boolean);
  const positionIndex = segments.lastIndexOf('position');
  const candidate = fromPrefix || (positionIndex >= 0 ? segments[positionIndex + 1] : '');
  if (!candidate || candidate === 'create') {
    return undefined;
  }
  return candidate;
};

const Detail = createWithRemoteLoader({
  modules: ['components-core:Permissions@usePermissionsPass']
})(
  withLocale(({ remoteModules, baseUrl = '', apis, children }) => {
    const [usePermissionsPass] = remoteModules;
    const { formatMessage } = useIntl();
    const navigate = useNavigate();
    const { pathname } = useLocation();
    const [searchParams, setSearchParams] = useSearchParams();
    const canEdit = usePermissionsPass({ request: TENANT_ADMIN_PERMISSIONS.positionManagement });
    const { id: paramId } = useParams();
    const detailMatch = useMatch({ path: `${String(baseUrl).replace(/\/$/, '')}/position/:id`, end: true });
    const id = resolvePositionId({ paramId: paramId || detailMatch?.params?.id, pathname, baseUrl });
    const tabFromUrl = searchParams.get('tab');
    const activeTab = DETAIL_TAB_KEYS.includes(tabFromUrl) ? tabFromUrl : DEFAULT_DETAIL_TAB;
    const pageTitleFallback = formatMessage({ id: 'position.bizName' });

    const onTabChange = key => {
      setSearchParams(
        prev => {
          const next = new URLSearchParams(prev);
          if (DETAIL_TAB_KEYS.includes(key) && key !== DEFAULT_DETAIL_TAB) {
            next.set('tab', key);
          } else {
            next.delete('tab');
          }
          return next;
        },
        { replace: true }
      );
    };

    const renderShell = ({ title = pageTitleFallback, extra = null, noPadding = false, content }) => {
      if (typeof children === 'function') {
        return children({ title, extra, noPadding, children: content });
      }
      return (
        <Page title={title} extra={extra} noPadding={noPadding}>
          {noPadding ? ({ className, render }) => render({ className, children: content }) : content}
        </Page>
      );
    };

    const statusContent = content => <div className={style['detail-status']}>{content}</div>;
    const { data, error } = useFetch({
      ...apis.detail,
      params: { id },
      cache: false,
      auto: Boolean(id)
    });

    if (!id) {
      return renderShell({
        content: statusContent(<Empty description={formatMessage({ id: 'position.detailMissing' })} />)
      });
    }

    if (error) {
      return renderShell({
        content: statusContent(<Empty description={formatMessage({ id: 'position.detailLoadError' })} />)
      });
    }

    if (!data) {
      return renderShell({
        content: statusContent(<Spin />)
      });
    }

    const editExtra = canEdit ? (
      <Button type="link" className={style['edit-btn']} icon={<EditOutlined />} onClick={() => navigate(`${baseUrl}/position/${data.id}/edit`)}>
        {formatMessage({ id: 'action.edit' })}
      </Button>
    ) : null;

    const content = (
      <Tabs
        activeKey={activeTab}
        onChange={onTabChange}
        tabBarExtraContent={activeTab === 'insights' ? <ReportGuideLink type="position" /> : null}
        items={[
          {
            key: 'insights',
            label: formatMessage({ id: 'position.tabRoleInsights' }),
            children: <RoleInsights apis={apis} position={data} />
          },
          {
            key: 'analyze',
            label: formatMessage({ id: 'position.tabAnalyzeTalent' }),
            children: <AnalyzeTalent baseUrl={baseUrl} positionId={data.id} employeeListApi={apis.employeeList} />
          },
          {
            key: 'role',
            label: formatMessage({ id: 'position.tabRoleDetails' }),
            children: <PositionInfoPanel data={data} extra={editExtra} />
          }
        ]}
      />
    );

    const pageTitle = (
      <span className={style['title-with-badge']}>
        <span className={style['title-text']}>{data.name}</span>
        <span className={style.badge}>{formatMessage({ id: 'position.futureRoleBadge' })}</span>
      </span>
    );

    return renderShell({
      title: pageTitle,
      content
    });
  })
);

export default Detail;
