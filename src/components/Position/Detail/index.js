import { useState } from 'react';
import { App, Button, Empty, Flex, Spin, Tabs, Typography } from 'antd';
import { EditOutlined } from '@ant-design/icons';
import { createWithRemoteLoader } from '@kne/remote-loader';
import withLocale from '../withLocale';
import { useIntl } from '@kne/react-intl';
import { useFetch } from '@kne/react-fetch';
import { useLocation, useMatch, useNavigate, useParams } from 'react-router-dom';
import { Page } from '@kne/system-layout';
import { TENANT_ADMIN_PERMISSIONS } from '@components/TenantAdmin/constants';
import SkillList from './SkillList';
import SkillOverview from './SkillList/SkillOverview';
import AnalyzeTalent from './AnalyzeTalent';
import AiAnalysis from './AiAnalysis';
import style from './style.module.scss';

const isAnalysisCardStatus = status => status === 'generating' || status === 'locked';

const text = value => {
  if (value == null || value === '') {
    return '-';
  }
  return String(value);
};

const MetaGrid = ({ items }) => (
  <div className={style['meta-grid']}>
    {items.map(item => (
      <div key={item.label} className={style['meta-item']}>
        <div className={style['meta-label']}>{item.label}</div>
        <div className={style['meta-value']}>{item.value}</div>
      </div>
    ))}
  </div>
);

const DetailPanel = ({ title, extra, children, className }) => (
  <section className={className ? `${style.panel} ${className}` : style.panel}>
    {title || extra ? (
      <div className={style['panel-header']}>
        {title ? <h2 className={style['panel-title']}>{title}</h2> : null}
        {extra}
      </div>
    ) : null}
    <div className={style['panel-body']}>{children}</div>
  </section>
);

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

/** 岗位描述/要求：表单为纯文本；历史数据可能含 HTML */
const RichContent = ({ html }) => {
  const content = html == null || html === '' ? '' : String(html);
  if (!content) {
    return '-';
  }
  return <div className={style['rich-html']} dangerouslySetInnerHTML={{ __html: content }} />;
};

const Detail = createWithRemoteLoader({
  modules: ['components-core:Global@usePreset', 'components-core:Permissions@usePermissionsPass']
})(
  withLocale(({ remoteModules, baseUrl = '', apis, children }) => {
    const [usePreset, usePermissionsPass] = remoteModules;
    const { ajax } = usePreset();
    const { formatMessage } = useIntl();
    const { message } = App.useApp();
    const navigate = useNavigate();
    const { pathname } = useLocation();
    const canStartAnalysis = usePermissionsPass({ request: TENANT_ADMIN_PERMISSIONS.positionAnalysis });
    const canEdit = usePermissionsPass({ request: TENANT_ADMIN_PERMISSIONS.positionManagement });
    const { id: paramId } = useParams();
    const detailMatch = useMatch({ path: `${String(baseUrl).replace(/\/$/, '')}/position/:id`, end: true });
    const id = resolvePositionId({ paramId: paramId || detailMatch?.params?.id, pathname, baseUrl });
    const [activeTab, setActiveTab] = useState('role');
    const [starting, setStarting] = useState(false);
    const pageTitleFallback = formatMessage({ id: 'position.bizName' });

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
    const { data, error, reload } = useFetch({
      ...apis.detail,
      params: { id },
      cache: false,
      auto: Boolean(id)
    });

    const enumLabel = (prefix, value) => {
      if (!value) {
        return '-';
      }
      return formatMessage({ id: `${prefix}.${value}`, defaultMessage: String(value) });
    };

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

    const department = (data.orgEnums || []).find(target => target.value === data.tenantOrgId)?.description || '-';
    const showAnalysisCard = isAnalysisCardStatus(data.analysisStatus);
    const isLocked = data.analysisStatus === 'locked';
    const lockAnalysis = async () => {
      if (!apis.lockAnalysis) {
        return;
      }
      const { data: resData } = await ajax({
        url: apis.lockAnalysis.url,
        method: apis.lockAnalysis.method,
        data: { id: data.id }
      });
      if (resData.code === 0) {
        reload();
      }
    };

    const startAnalysis = async () => {
      if (!apis?.startAnalysis || starting) {
        return;
      }
      setStarting(true);
      try {
        const { data: resData } = await ajax(
          Object.assign({}, apis.startAnalysis, {
            data: { id: data.id }
          })
        );
        if (resData.code !== 0) {
          throw new Error(resData.msg || formatMessage({ id: 'position.aiAnalysisStartFail' }));
        }
        message.success(formatMessage({ id: 'position.aiAnalysisStartSuccess' }));
        reload();
      } catch (e) {
        message.error(e.message || formatMessage({ id: 'position.aiAnalysisStartFail' }));
      } finally {
        setStarting(false);
      }
    };

    const extra =
      !showAnalysisCard && canStartAnalysis ? (
        <Button type="primary" loading={starting} onClick={startAnalysis}>
          {formatMessage({ id: 'position.aiAnalysisAction' })}
        </Button>
      ) : null;

    const editExtra = canEdit ? (
      <Button type="link" className={style['edit-btn']} icon={<EditOutlined />} onClick={() => navigate(`${baseUrl}/position/${data.id}/edit`)}>
        {formatMessage({ id: 'action.edit' })}
      </Button>
    ) : null;

    const positionInfoCard = (
      <DetailPanel className={style['position-info']} title={formatMessage({ id: 'position.positionInfo' })} extra={editExtra}>
        <div className={style.sections}>
          <section className={style.section}>
            <h3 className={style['section-title']}>{formatMessage({ id: 'position.basicInfo' })}</h3>
            <MetaGrid
              items={[
                { label: formatMessage({ id: 'position.name' }), value: text(data.name) },
                { label: formatMessage({ id: 'position.department' }), value: text(department) },
                { label: formatMessage({ id: 'position.status' }), value: enumLabel('positionStatus', data.status) },
                { label: formatMessage({ id: 'position.language' }), value: enumLabel('language', data.language) }
              ]}
            />
          </section>
          <section className={style.section}>
            <h3 className={style['section-title']}>{formatMessage({ id: 'position.workContent' })}</h3>
            <div className={style['rich-content']}>
              <RichContent html={data.description} />
            </div>
          </section>
          <section className={style.section}>
            <h3 className={style['section-title']}>{formatMessage({ id: 'position.workRequirement' })}</h3>
            <div className={style['rich-content']}>
              <RichContent html={data.requirement} />
            </div>
          </section>
          <section className={style.section}>
            <h3 className={style['section-title']}>{formatMessage({ id: 'position.futureBusinessGoal' })}</h3>
            <Typography.Paragraph className={style['plain-text']}>{text(data.developmentGoal)}</Typography.Paragraph>
          </section>
        </div>
      </DetailPanel>
    );

    const content = showAnalysisCard ? (
      <AiAnalysis positionName={data.name} progress={data.analysisProgress} locked={isLocked} animate={!isLocked} onAnimationComplete={lockAnalysis} />
    ) : (
      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={[
          {
            key: 'role',
            label: formatMessage({ id: 'position.tabRoleDetails' }),
            children: (
              <Flex vertical gap={24}>
                <SkillOverview skill={data.skill} verdict={data.verdict} />
                <DetailPanel title={formatMessage({ id: 'position.skillListTitle' })}>
                  <SkillList positionId={data.id} skill={data.skill} apis={apis} reload={reload} />
                </DetailPanel>
                {positionInfoCard}
              </Flex>
            )
          },
          {
            key: 'analyze',
            label: formatMessage({ id: 'position.tabAnalyzeTalent' }),
            children: <AnalyzeTalent baseUrl={baseUrl} positionId={data.id} employeeListApi={apis.employeeList} />
          }
        ]}
      />
    );

    return renderShell({
      title: data.name,
      extra,
      noPadding: showAnalysisCard,
      content
    });
  })
);

export default Detail;
