import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { App, Button, Flex, Spin, Tabs, Tooltip } from 'antd';
import { EditOutlined, MailOutlined, StopOutlined } from '@ant-design/icons';
import { createWithRemoteLoader } from '@kne/remote-loader';
import { useIntl } from '@kne/react-intl';
import Fetch from '@kne/react-fetch';
import { Page } from '@kne/system-layout';
import dayjs from 'dayjs';
import get from 'lodash/get';
import withLocale from './withLocale';
import { SectionCard, StatusTag } from './common';
import InfoFields from './InfoFields';
import StepAssessment from './ProjectCreate/StepAssessment';
import { getDimensionList, getProjectStatus } from './constants';
import { DimensionInfo, ObjectInfo } from './ProjectReadonly';
import { useApiAction } from './useApiAction';
import style from './style.module.scss';

const toPercent = value => Math.round(Number(value || 0) * 100);

const InfoReadonly = createWithRemoteLoader({
  modules: ['components-core:FormInfo@Form']
})(({ remoteModules, project }) => {
  const [Form] = remoteModules;
  const setting = project.setting || {};
  return (
    <Form
      data={{
        name: project.name,
        period: project.startTime && project.endTime ? [dayjs(project.startTime), dayjs(project.endTime)] : undefined,
        language: project.language,
        owner: setting.owner ? { value: setting.owner.id, label: setting.owner.name } : undefined,
        description: project.description
      }}
    >
      <InfoFields disabled ownerOptions={setting.owner ? [{ value: setting.owner.id, label: setting.owner.name }] : []} />
    </Form>
  );
});

const Detail = ({ project, baseUrl, reload, usePreset, canInvite, canEdit }) => {
  const { formatMessage, locale } = useIntl();
  const navigate = useNavigate();
  const { modal } = App.useApp();
  const [run, loading] = useApiAction(usePreset);
  const { apis } = usePreset();
  const [tab, setTab] = useState('info');
  const setting = project.setting || {};
  const status = getProjectStatus(project);
  const nineSquareGrid = setting.nineSquareGrid || {};

  const endReview = () =>
    modal.confirm({
      title: formatMessage({ id: 'endReviewConfirm' }),
      onOk: async () => {
        const result = await run(apis.talentSaas.tenant.talentReview.projectStatus, { id: project.id, status: 'closed' }, formatMessage({ id: 'endReviewSuccess' }));
        result && reload();
      }
    });

  return (
    <Page
      title={
        <Flex align="center" gap={8}>
          {project.name}
          <StatusTag status={status} />
        </Flex>
      }
      back
      extra={
        <Flex gap={8}>
          {project.status === 'open' ? (
            <Button icon={<StopOutlined />} loading={loading} onClick={endReview}>
              {formatMessage({ id: 'endReview' })}
            </Button>
          ) : null}
          {canInvite && project.status === 'open' ? (
            <Button type="primary" icon={<MailOutlined />} onClick={() => navigate(`${baseUrl}/projects/${project.id}/invite`)}>
              {formatMessage({ id: 'sendInvitation' })}
            </Button>
          ) : null}
        </Flex>
      }
    >
      <div className={style['page']}>
        <Tabs
          activeKey={tab}
          onChange={setTab}
          tabBarExtraContent={
            canEdit ? (
              <Tooltip title={formatMessage({ id: status === 'draft' ? 'editProject' : 'editOnlyDraft' })}>
                <Button type="text" icon={<EditOutlined />} disabled={status !== 'draft'} onClick={() => navigate(`${baseUrl}/projects/${project.id}/edit`)} />
              </Tooltip>
            ) : null
          }
          items={[
            { key: 'info', label: formatMessage({ id: 'stepReviewInfo' }) },
            { key: 'object', label: formatMessage({ id: 'stepObjectInfo' }) },
            { key: 'dimension', label: formatMessage({ id: 'stepReviewDimension' }) },
            { key: 'assessment', label: formatMessage({ id: 'stepAssessmentSetting' }) }
          ]}
        />
        {tab === 'info' ? (
          <div className={style['card']}>
            <InfoReadonly project={project} />
          </div>
        ) : null}
        {tab === 'object' ? (
          <SectionCard title={formatMessage({ id: 'reviewObjectInfo' })}>
            <ObjectInfo setting={setting} />
          </SectionCard>
        ) : null}
        {tab === 'dimension' ? (
          <SectionCard title={formatMessage({ id: 'addReviewDimension' })}>
            <DimensionInfo project={project} />
          </SectionCard>
        ) : null}
        {tab === 'assessment' ? (
          <StepAssessment
            readOnly
            locale={locale}
            enablePerformance={!!setting.enablePerformance}
            dimensionTypes={getDimensionList(project).map(item => item.type)}
            value={{
              enableManualScore: !!setting.enableManualScore,
              ai: toPercent(get(setting, 'scoreSourceWeight.ai', 1)),
              manual: toPercent(get(setting, 'scoreSourceWeight.manual', 0)),
              superior: toPercent(get(setting, 'manualRoleWeight.superior')),
              peer: toPercent(get(setting, 'manualRoleWeight.peer')),
              gridType: Number(nineSquareGrid.type) === 4 ? 4 : 9,
              nineSquareGrid
            }}
          />
        ) : null}
      </div>
    </Page>
  );
};

const ProjectDetail = createWithRemoteLoader({
  modules: ['components-core:Global@usePreset', 'components-core:Permissions@usePermissionsPass']
})(
  withLocale(({ remoteModules, baseUrl, permissions, guard }) => {
    const [usePreset, usePermissionsPass] = remoteModules;
    const { apis } = usePreset();
    const { id } = useParams();
    const canInvite = usePermissionsPass({ request: permissions.talentReviewInvite });
    const canEdit = usePermissionsPass({ request: permissions.talentReviewCreate });
    return guard(
      <Fetch
        {...apis.talentSaas.tenant.talentReview.projectDetail}
        params={{ id }}
        loading={<Spin style={{ display: 'block', padding: 80 }} />}
        render={({ data, refresh }) => <Detail project={data} baseUrl={baseUrl} reload={refresh} usePreset={usePreset} canInvite={canInvite} canEdit={canEdit} />}
      />
    );
  })
);

export default ProjectDetail;
