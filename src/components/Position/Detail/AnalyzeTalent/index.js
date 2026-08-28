import React, { useMemo, useRef, useState } from 'react';
import { message } from 'antd';
import { createWithRemoteLoader } from '@kne/remote-loader';
import { useIntl } from '@kne/react-intl';
import { useNavigate } from 'react-router-dom';
import withLocale from '../../withLocale';
import AssessmentTag from './AssessmentTag';
import ReadinessBar from './ReadinessBar';
import style from './style.module.scss';

const EMPTY_METRICS = { total: 0, assessed: 0, outdated: 0, never: 0 };

const formatInRole = (years, formatMessage) => {
  if (years == null || years === '') {
    return '—';
  }
  return formatMessage({ id: 'position.talentInRoleYears' }, { years });
};

const AnalyzeTalent = createWithRemoteLoader({
  modules: ['components-core:Table@TablePage', 'components-core:Table', 'components-core:Filter', 'components-core:Image.Avatar']
})(
  withLocale(({ remoteModules, baseUrl = '', positionId, employeeListApi }) => {
    const [TablePage, Table, Filter, Avatar] = remoteModules;
    const { formatMessage } = useIntl();
    const navigate = useNavigate();
    const tableRef = useRef(null);
    const [pageList, setPageList] = useState([]);
    const [metrics, setMetrics] = useState(EMPTY_METRICS);
    const { selectedRows, getRowSelection, clearSelectedRows } = Table.useSelectedRow({ rowKey: 'id' });

    const goTalentAnalysis = item => {
      if (!item?.id || !positionId) {
        return;
      }
      navigate(`${baseUrl}/position/${positionId}/talent/${item.id}`);
    };

    const listApi = useMemo(() => {
      if (!employeeListApi || !positionId) {
        return null;
      }
      return Object.assign({}, employeeListApi, {
        params: Object.assign({}, employeeListApi.params || {}, {
          // positionId 放顶层，避免 TablePage filter 合并时被清掉
          positionId: String(positionId),
          filter: Object.assign({}, employeeListApi.params?.filter || {}, {
            withTalentAnalysis: true
          }),
          perPage: 20
        })
      });
    }, [employeeListApi, positionId]);

    const columns = [
      {
        name: 'person',
        title: formatMessage({ id: 'position.talentPerson' }),
        type: 'other',
        valueOf: item => (
          <div className={style.person}>
            <Avatar size={32} id={item.avatar} gender={item.gender || 'M'} />
            <div className={style['person-text']}>
              <button type="button" className={style['person-name-link']} onClick={() => goTalentAnalysis(item)}>
                {item.name || item.nameEn || '—'}
              </button>
              <div className={style['person-manager']}>{formatMessage({ id: 'position.talentManager' }, { name: item.managerName || '—' })}</div>
            </div>
          </div>
        )
      },
      {
        name: 'site',
        title: formatMessage({ id: 'position.talentSite' }),
        type: 'other',
        valueOf: item => item.site || item.city || '—'
      },
      {
        name: 'inRole',
        title: formatMessage({ id: 'position.talentInRole' }),
        type: 'other',
        valueOf: item => formatInRole(item.inRoleYears, formatMessage)
      },
      {
        name: 'lastAssessment',
        title: formatMessage({ id: 'position.talentLastAssessment' }),
        type: 'other',
        valueOf: item => <AssessmentTag status={item.lastAssessment} />
      },
      {
        name: 'readiness',
        title: formatMessage({ id: 'position.talentReadiness' }),
        type: 'other',
        valueOf: item => <ReadinessBar value={item.readiness} />
      }
    ];

    if (!listApi) {
      return <div className={style.root}>{formatMessage({ id: 'position.tabAnalyzeTalentPlaceholder' })}</div>;
    }

    return (
      <div className={style.root}>
        <div className={style.metrics}>
          <div className={style.metric}>
            <div className={style['metric-value']}>{metrics.total}</div>
            <div className={style['metric-label']}>{formatMessage({ id: 'position.talentMetricPeople' })}</div>
          </div>
          <div className={style.metric}>
            <div className={`${style['metric-value']} ${style['metric-value-assessed']}`}>{metrics.assessed}</div>
            <div className={style['metric-label']}>{formatMessage({ id: 'position.talentMetricAssessed' })}</div>
          </div>
          <div className={style.metric}>
            <div className={`${style['metric-value']} ${style['metric-value-outdated']}`}>{metrics.outdated}</div>
            <div className={style['metric-label']}>{formatMessage({ id: 'position.talentMetricOutdated' })}</div>
          </div>
          <div className={style.metric}>
            <div className={`${style['metric-value']} ${style['metric-value-never']}`}>{metrics.never}</div>
            <div className={style['metric-label']}>{formatMessage({ id: 'position.talentMetricNever' })}</div>
          </div>
        </div>

        <TablePage
          {...listApi}
          key={positionId}
          ref={tableRef}
          name="position-analyze-talent"
          rowKey="id"
          sticky={false}
          columns={columns}
          pagination={{
            paramsType: 'params',
            pageSize: 20
          }}
          search={{
            name: 'keyword',
            label: formatMessage({ id: 'position.talentSearchLabel' }),
            placeholder: formatMessage({ id: 'position.talentSearchPlaceholder' })
          }}
          filter={{
            mapFilterValue: value => ({
              positionId: String(positionId),
              filter: Object.assign({}, Filter.getFilterValue(value), {
                withTalentAnalysis: true
              })
            })
          }}
          batchActions={[
            {
              key: 'invite',
              label: formatMessage({ id: 'position.talentInvite' }),
              onClick: ({ selectedRowKeys }) => {
                message.success(formatMessage({ id: 'position.talentInviteQueued' }, { count: selectedRowKeys.length }));
                clearSelectedRows();
              }
            }
          ]}
          rowSelection={getRowSelection(pageList)}
          selectedRows={selectedRows}
          dataFormat={data => {
            const list = data?.pageData || [];
            const nextMetrics = data?.talentMetrics || EMPTY_METRICS;
            queueMicrotask(() => {
              setPageList(list);
              setMetrics(nextMetrics);
            });
            return {
              list,
              total: data?.totalCount || 0
            };
          }}
        />
      </div>
    );
  })
);

export default AnalyzeTalent;
