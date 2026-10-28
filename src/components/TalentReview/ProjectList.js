import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import classnames from 'classnames';
import { createWithRemoteLoader } from '@kne/remote-loader';
import { useIntl } from '@kne/react-intl';
import { Page } from '@kne/system-layout';
import Fetch from '@kne/react-fetch';
import dayjs from 'dayjs';
import withLocale from './withLocale';
import { StatCard, StatIcons, StatusTag } from './common';
import { BIZ_UNIT_FILTER, filterValueOf, formatDate, getDimensionList, getProjectStatus, localPage } from './constants';
import style from './style.module.scss';

const STATUS_OPTIONS = ['draft', 'notStarted', 'inProgress', 'completed'];
const STATUS_LABEL = { draft: 'statusDraft', notStarted: 'statusNotStarted', inProgress: 'statusInProgress', completed: 'statusCompleted' };

const Progress = ({ progress = {} }) => {
  const { formatMessage } = useIntl();
  return (
    <div className={style['progress']}>
      {[
        ['invited', progress.invited],
        ['submitted', progress.submitted],
        ['evaluated', progress.evaluated]
      ].map(([key, value]) => (
        <div key={key} className={style['progress-item']}>
          <span className={classnames(style['progress-value'], { [style['is-zero']]: !value })}>{value || 0}</span>
          <span className={style['progress-label']}>{formatMessage({ id: key })}</span>
        </div>
      ))}
    </div>
  );
};

const ProjectTable = ({ remoteModules, data, baseUrl, canCreate }) => {
  const [BizUnit, TablePageRender, Filter] = remoteModules;
  const { SuperSelectFilterItem } = Filter.fields;
  const { formatMessage } = useIntl();
  const navigate = useNavigate();
  const list = useMemo(() => (data.pageData || []).map(item => Object.assign({}, item, { viewStatus: getProjectStatus(item) })), [data.pageData]);
  const ownerOptions = useMemo(() => [...new Set(list.map(item => item.setting?.owner?.name).filter(Boolean))].map(name => ({ label: name, value: name })), [list]);
  const dimensionText = item =>
    getDimensionList(item)
      .map(dim => dim.name || formatMessage({ id: dim.type }))
      .join(', ');

  const apis = useMemo(
    () => ({
      list: {
        loader: ({ params }) =>
          localPage(list, params, (item, filter, keyword) => {
            const status = filterValueOf(filter.status);
            const owner = filterValueOf(filter.owner);
            if (status && item.viewStatus !== status) return false;
            if (owner && item.setting?.owner?.name !== owner) return false;
            return !keyword || [item.name, item.setting?.owner?.name, dimensionText(item)].filter(Boolean).some(value => String(value).toLowerCase().includes(keyword));
          })
      }
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [list]
  );

  const quarterStart = dayjs().startOf('quarter');
  const counts = {
    total: list.length,
    inProgress: list.filter(item => item.viewStatus === 'inProgress').length,
    completed: list.filter(item => item.viewStatus === 'completed').length,
    completedQuarter: list.filter(item => item.viewStatus === 'completed' && dayjs(item.endTime || item.updatedAt).isAfter(quarterStart)).length,
    participants: data.memberTotal ?? list.reduce((sum, item) => sum + (item.progress?.members || 0), 0)
  };

  const getColumns = () => [
    {
      name: 'name',
      title: formatMessage({ id: 'project' }),
      type: 'other',
      width: 280,
      getValueOf: item => (
        <div>
          <div className={classnames(style['cell-title'], style['cell-title-link'])} onClick={() => navigate(`${baseUrl}/projects/${item.id}`)}>
            {item.name}
          </div>
          <div className={style['cell-sub']}>{item.startTime ? formatMessage({ id: 'startDate' }, { date: formatDate(item.startTime) }) : formatMessage({ id: 'createdAt' }, { date: formatDate(item.createdAt) })}</div>
        </div>
      )
    },
    { name: 'status', title: formatMessage({ id: 'status' }), type: 'other', width: 140, getValueOf: item => <StatusTag status={item.viewStatus} /> },
    { name: 'owner', title: formatMessage({ id: 'owner' }), width: 160, getValueOf: item => item.setting?.owner?.name || '-' },
    { name: 'dimensions', title: formatMessage({ id: 'dimensions' }), width: 220, getValueOf: item => dimensionText(item) || '-' },
    {
      name: 'progress',
      title: formatMessage({ id: 'progress' }),
      type: 'other',
      width: 260,
      getValueOf: item => (item.viewStatus === 'draft' ? <span className={style['muted']}>-</span> : <Progress progress={item.progress} />)
    }
  ];

  const go = (item, path) => () => navigate(`${baseUrl}/projects/${item.id}${path}`);
  const getActionList = ({ data: item, ...actionProps }) =>
    item.viewStatus === 'completed'
      ? [{ ...actionProps, data: item, type: 'primary', children: formatMessage({ id: 'viewReport' }), onClick: go(item, '/report') }]
      : [
          { ...actionProps, data: item, children: formatMessage({ id: 'viewDetail' }), onClick: go(item, '') },
          { ...actionProps, data: item, children: formatMessage({ id: 'sendInvitation' }), disabled: item.status !== 'open', onClick: go(item, '/invite') },
          { ...actionProps, data: item, children: formatMessage({ id: 'viewReport' }), onClick: go(item, '/report') }
        ];

  return (
    <BizUnit
      isNext
      name="talent-review-project"
      apis={apis}
      getColumns={getColumns}
      getActionList={getActionList}
      filter={{
        list: [
          {
            type: SuperSelectFilterItem,
            props: { name: 'status', label: formatMessage({ id: 'status' }), single: true, options: STATUS_OPTIONS.map(value => ({ value, label: formatMessage({ id: STATUS_LABEL[value] }) })) }
          },
          { type: SuperSelectFilterItem, props: { name: 'owner', label: formatMessage({ id: 'owner' }), single: true, options: ownerOptions } }
        ]
      }}
      options={{
        bizName: formatMessage({ id: 'project' }),
        keywordFilterLabel: formatMessage({ id: 'searchProject' }),
        mapFilterValue: BIZ_UNIT_FILTER,
        tableProps: {
          rowKey: 'id',
          className: style['table-row-lg'],
          buttonGroup: {
            list: canCreate ? [{ type: 'primary', children: formatMessage({ id: 'newProject' }), onClick: () => navigate(`${baseUrl}/projects/create`) }] : []
          }
        }
      }}
    >
      {renderProps => (
        <Page title={formatMessage({ id: 'projects' })}>
          <div className={style['page']}>
            <div className={style['stat-cards']}>
              <StatCard label={formatMessage({ id: 'totalProjects' })} value={counts.total} icon={StatIcons.total} iconBg="#eff6ff" />
              <StatCard label={formatMessage({ id: 'inProgress' })} value={counts.inProgress} desc={formatMessage({ id: 'activeProjects' })} icon={StatIcons.inProgress} iconBg="#fff7ed" />
              <StatCard label={formatMessage({ id: 'completed' })} value={counts.completed} desc={`${formatMessage({ id: 'thisQuarter' })} ${counts.completedQuarter}`} icon={StatIcons.completed} iconBg="#f0fdf4" />
              <StatCard label={formatMessage({ id: 'participants' })} value={counts.participants} desc={formatMessage({ id: 'total' })} icon={StatIcons.participants} iconBg="#faf5ff" />
            </div>
            <TablePageRender {...renderProps} withPage={false} />
          </div>
        </Page>
      )}
    </BizUnit>
  );
};

const ProjectList = createWithRemoteLoader({
  modules: ['components-core:Global@usePreset', 'components-core:Permissions@usePermissionsPass', 'components-admin:BizUnit', 'components-admin:BizUnit@TablePageRender', 'components-core:Filter']
})(
  withLocale(({ remoteModules, baseUrl, permissions, guard }) => {
    const [usePreset, usePermissionsPass, ...tableModules] = remoteModules;
    const { apis } = usePreset();
    const canCreate = usePermissionsPass({ request: permissions.talentReviewCreate });
    return guard(<Fetch {...apis.talentSaas.tenant.talentReview.projectList} render={({ data }) => <ProjectTable remoteModules={tableModules} data={data || {}} baseUrl={baseUrl} canCreate={canCreate} />} />);
  })
);

export default ProjectList;
