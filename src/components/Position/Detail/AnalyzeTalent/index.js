import React, { useMemo, useRef, useState } from 'react';
import { createWithRemoteLoader } from '@kne/remote-loader';
import { useIntl } from '@kne/react-intl';
import { useNavigate } from 'react-router-dom';
import { registerTablePageMessages } from '@root/locale/registerRemoteMessages';
import withLocale from '../../withLocale';
import AssessmentTag from './AssessmentTag';
import ReadinessBar from './ReadinessBar';
import InviteAssessment from './InviteAssessment';
import style from './style.module.scss';

const EMPTY_METRICS = { total: 0, assessed: 0, outdated: 0, never: 0, inProgress: 0 };

const initialsOf = item => {
  const name = String(item?.name || item?.nameEn || '').trim();
  if (!name) {
    return '—';
  }
  const parts = name.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
};

const CompletionRing = ({ value }) => {
  const pct = value == null || value === '' ? null : Math.max(0, Math.min(100, Math.round(Number(value))));
  if (pct == null || Number.isNaN(pct)) {
    return <span className={style['readiness-empty']}>—</span>;
  }
  const radius = 14;
  const circ = 2 * Math.PI * radius;
  const dash = (pct / 100) * circ;
  return (
    <span className={style.completion}>
      <svg width="36" height="36" viewBox="0 0 36 36" aria-hidden="true">
        <circle cx="18" cy="18" r={radius} fill="none" stroke="#e2e8f0" strokeWidth="4" />
        <circle cx="18" cy="18" r={radius} fill="none" stroke="var(--primary-color, #4183f0)" strokeWidth="4" strokeDasharray={`${dash} ${circ - dash}`} strokeLinecap="round" transform="rotate(-90 18 18)" />
      </svg>
      <span>{pct}%</span>
    </span>
  );
};

const AnalyzeTalent = createWithRemoteLoader({
  modules: ['components-core:Table@TablePage', 'components-core:Table', 'components-core:Filter']
})(
  withLocale(({ remoteModules, baseUrl = '', positionId, employeeListApi }) => {
    const [TablePage, Table, Filter] = remoteModules;
    // 此处远程模块已加载完成，覆盖才不会被 table-page 自带语言包盖掉
    registerTablePageMessages();
    const { formatMessage } = useIntl();
    const navigate = useNavigate();
    const tableRef = useRef(null);
    const [pageList, setPageList] = useState([]);
    const [metrics, setMetrics] = useState(EMPTY_METRICS);
    const { selectedRows, getRowSelection } = Table.useSelectedRow({ rowKey: 'id' });

    const goEmployeeProfile = item => {
      if (!item?.id) {
        return;
      }
      navigate(`${baseUrl}/profile/${item.id}`);
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
            <span className={style.initials}>{initialsOf(item)}</span>
            <div className={style['person-text']}>
              <button type="button" className={style['person-name-link']} onClick={() => goEmployeeProfile(item)}>
                {item.name || item.nameEn || '—'}
              </button>
              {item.managerName ? <div className={style['person-manager']}>{formatMessage({ id: 'position.talentManager' }, { name: item.managerName })}</div> : null}
            </div>
          </div>
        )
      },
      {
        name: 'readiness',
        title: formatMessage({ id: 'position.talentReadiness' }),
        type: 'other',
        valueOf: item => <ReadinessBar value={item.readiness} />
      },
      {
        name: 'completion',
        title: formatMessage({ id: 'position.profileCompletion' }),
        type: 'other',
        valueOf: item => <CompletionRing value={item.profileCompletionPercent} />
      },
      {
        name: 'lastAssessment',
        title: formatMessage({ id: 'position.talentLastAssessment' }),
        type: 'other',
        valueOf: item => <AssessmentTag status={item.lastAssessment} />
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
            <div className={`${style['metric-value']} ${style['metric-value-never']}`}>{metrics.never + (metrics.inProgress || 0)}</div>
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
          buttonGroup={{
            list: [
              {
                buttonComponent: InviteAssessment,
                positionId,
                baseUrl
              }
            ]
          }}
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
