import { useState } from 'react';
import { App, Button, Flex, Tabs, Typography } from 'antd';
import { EditOutlined } from '@ant-design/icons';
import { createWithRemoteLoader } from '@kne/remote-loader';
import withLocale from '../withLocale';
import { useIntl } from '@kne/react-intl';
import Fetch from '@kne/react-fetch';
import { useNavigate, useParams } from 'react-router-dom';
import dayjs from 'dayjs';
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

const formatDateTime = value => {
  if (!value) {
    return '-';
  }
  const parsed = dayjs(value);
  return parsed.isValid() ? parsed.format('YYYY-MM-DD HH:mm') : '-';
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

const Detail = createWithRemoteLoader({
  modules: ['components-core:InfoPage', 'components-core:Layout@Page', 'components-core:Layout@PageHeader', 'components-thirdparty:CKEditor.Content', 'components-core:Global@usePreset', 'components-core:Permissions@usePermissionsPass']
})(
  withLocale(({ remoteModules, baseUrl = '', apis, children }) => {
    const [InfoPage, Page, PageHeader, EditorContent, usePreset, usePermissionsPass] = remoteModules;
    const { ajax } = usePreset();
    const { formatMessage } = useIntl();
    const { message } = App.useApp();
    const navigate = useNavigate();
    const canStartAnalysis = usePermissionsPass({ request: TENANT_ADMIN_PERMISSIONS.positionAnalysis });
    const canEdit = usePermissionsPass({ request: TENANT_ADMIN_PERMISSIONS.positionEdit });
    const { id } = useParams();
    const [activeTab, setActiveTab] = useState('role');
    const [starting, setStarting] = useState(false);

    const enumLabel = (prefix, value) => {
      if (!value) {
        return '-';
      }
      return formatMessage({ id: `${prefix}.${value}`, defaultMessage: String(value) });
    };

    return (
      <Fetch
        {...Object.assign({}, apis.detail, {
          params: { id }
        })}
        render={({ data, reload }) => {
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
            <InfoPage className={style['position-info']}>
              <InfoPage.Part bordered title={formatMessage({ id: 'position.positionInfo' })} extra={editExtra}>
                <div className={style.sections}>
                  <section className={style.section}>
                    <h3 className={style['section-title']}>{formatMessage({ id: 'position.basicInfo' })}</h3>
                    <MetaGrid
                      items={[
                        { label: formatMessage({ id: 'position.name' }), value: text(data.name) },
                        { label: formatMessage({ id: 'position.department' }), value: text(department) },
                        { label: formatMessage({ id: 'position.status' }), value: enumLabel('positionStatus', data.status) },
                        { label: formatMessage({ id: 'position.language' }), value: enumLabel('language', data.language) },
                        { label: formatMessage({ id: 'position.publishAt' }), value: formatDateTime(data.publishAt) },
                        { label: formatMessage({ id: 'position.createdAt' }), value: formatDateTime(data.createdAt) },
                        { label: formatMessage({ id: 'position.updatedAt' }), value: formatDateTime(data.updatedAt) }
                      ]}
                    />
                  </section>
                  <section className={style.section}>
                    <h3 className={style['section-title']}>{formatMessage({ id: 'position.workContent' })}</h3>
                    <div className={style['rich-content']}>
                      <EditorContent>{data.description}</EditorContent>
                    </div>
                  </section>
                  <section className={style.section}>
                    <h3 className={style['section-title']}>{formatMessage({ id: 'position.workRequirement' })}</h3>
                    <div className={style['rich-content']}>
                      <EditorContent>{data.requirement}</EditorContent>
                    </div>
                  </section>
                  <section className={style.section}>
                    <h3 className={style['section-title']}>{formatMessage({ id: 'position.futureBusinessGoal' })}</h3>
                    <Typography.Paragraph className={style['plain-text']}>{text(data.developmentGoal)}</Typography.Paragraph>
                  </section>
                </div>
              </InfoPage.Part>
            </InfoPage>
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
                      <InfoPage>
                        <InfoPage.Part bordered title={formatMessage({ id: 'position.skillListTitle' })}>
                          <SkillList positionId={data.id} skill={data.skill} apis={apis} reload={reload} />
                        </InfoPage.Part>
                      </InfoPage>
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

          const title = data.name;

          if (typeof children === 'function') {
            return children({
              title,
              extra,
              noPadding: showAnalysisCard,
              children: content
            });
          }
          return (
            <Page headerFixed={false} header={<PageHeader title={title} extra={extra} />} noPadding={showAnalysisCard}>
              {showAnalysisCard ? ({ className, render }) => render({ className, children: content }) : content}
            </Page>
          );
        }}
      />
    );
  })
);

export default Detail;
