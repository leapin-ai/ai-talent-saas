import { useParams } from 'react-router-dom';
import { Button, Empty, Flex, Spin, Tooltip } from 'antd';
import { createWithRemoteLoader } from '@kne/remote-loader';
import { useIntl } from '@kne/react-intl';
import { useFetch } from '@kne/react-fetch';
import { Page } from '@kne/system-layout';
import get from 'lodash/get';
import withLocale from './withLocale';
import GridBoard from './GridBoard';
import { getDimensionList, resolveCell } from './constants';
import style from './style.module.scss';

const BAND_COLORS = { high: '#7fc97f', medium: '#4f6fd6', mid: '#4f6fd6', moderate: '#4f6fd6', low: '#e5615f' };
const BAND_LABEL = { high: 'bandHigh', medium: 'bandMedium', mid: 'bandMedium', moderate: 'bandMedium', low: 'bandLow' };

const Section = ({ title, desc, extra, children }) => (
  <div className={style['report-section']}>
    <Flex justify="space-between" align="flex-start" style={{ marginBottom: 16 }}>
      <div>
        <div className={style['section-title']} style={{ fontSize: 16 }}>
          {title}
        </div>
        {desc ? (
          <div className={style['muted']} style={{ fontSize: 12, marginTop: 4 }}>
            {desc}
          </div>
        ) : null}
      </div>
      {extra}
    </Flex>
    {children}
  </div>
);

const ReportView = ({ project, report }) => {
  const { formatMessage, locale } = useIntl();
  const projectId = String(project.id);
  const view = (report.projects || []).find(item => item.projectId === projectId) || {};
  const detail = get(report, 'projectScores.detail');
  const scoreDetail = detail && detail.projectId === projectId ? detail : null;
  const gridType = String(view.gridType || get(project, 'setting.nineSquareGrid.type') || 9);
  const snapshot = (get(report, `gridTimeline.${gridType}`) || []).find(item => item.projectId === projectId);
  const dimensionKey = getDimensionList(project)[0]?.type || 'potential';
  const counts = (snapshot?.cells || []).reduce((result, cell) => Object.assign(result, { [cell.index]: cell }), {});
  const topCell = (snapshot?.cells || []).reduce((top, cell) => (!top || cell.count > top.count ? cell : top), null);
  const is2D = ['9', '4'].includes(gridType) && !!project.setting?.enablePerformance;

  return (
    <Flex vertical gap={12}>
      <Section title={formatMessage({ id: 'overview' })}>
        <div className={style['overview-cards']}>
          <div className={style['overview-card']}>
            <div className={style['overview-value']} style={{ fontSize: 18 }}>
              {project.name}
            </div>
            <div className={style['muted']}>{formatMessage({ id: 'reviewProjectName' })}</div>
          </div>
          <div className={style['overview-card']}>
            <div className={style['overview-value']}>{view.memberCount ?? 0}</div>
            <div className={style['muted']}>{formatMessage({ id: 'participantsCount' })}</div>
          </div>
          <div className={style['overview-card']}>
            <div className={style['overview-value']}>{view.reportCount ?? 0}</div>
            <div className={style['muted']}>{formatMessage({ id: 'completedCount' })}</div>
          </div>
        </div>
      </Section>

      <Section title={formatMessage({ id: 'talentGrid' })} desc={formatMessage({ id: 'talentGridDesc' })}>
        {snapshot?.placedCount ? (
          <>
            <GridBoard gridType={gridType} dimension={dimensionKey} dimensionLabel={formatMessage({ id: dimensionKey })} nineSquareGrid={project.setting?.nineSquareGrid} locale={locale} counts={counts} show2D={is2D} show1D={!is2D} />
            {topCell ? (
              <div className={style['summary-box']} style={{ marginTop: 16 }}>
                <strong>{formatMessage({ id: 'summary' })}：</strong>
                {formatMessage(
                  { id: 'summaryText' },
                  {
                    placed: snapshot.placedCount,
                    topTitle: resolveCell(project.setting?.nineSquareGrid, String(gridType === '4' || gridType === '2' ? 4 : 9), dimensionKey, topCell.index, locale).title || topCell.title,
                    topCount: topCell.count,
                    topRate: `${topCell.rate}%`
                  }
                )}
              </div>
            ) : null}
          </>
        ) : (
          <Empty description={formatMessage({ id: 'noReportData' })} />
        )}
      </Section>

      <Section title={formatMessage({ id: 'dimensionAnalysis' })} desc={formatMessage({ id: 'dimensionAnalysisDesc' })}>
        {scoreDetail?.dimensionBands?.some(item => item.bands?.length) ? (
          scoreDetail.dimensionBands.map(dim => (
            <div key={dim.dimensionType} className={style['band-row']}>
              <span>{dim.label}</span>
              <div className={style['band-bar']}>
                {dim.bands.map(band => (
                  <Tooltip key={band.code} title={`${formatMessage({ id: BAND_LABEL[band.code] || 'bandMedium' })}: ${band.count} (${band.rate}%)`}>
                    <span style={{ width: `${band.rate}%`, background: BAND_COLORS[band.code] || '#9ca3af' }}>{band.rate >= 8 ? band.count : ''}</span>
                  </Tooltip>
                ))}
              </div>
            </div>
          ))
        ) : (
          <Empty description={formatMessage({ id: 'noReportData' })} />
        )}
      </Section>

      <Section title={formatMessage({ id: 'orgMatrix' })}>
        {scoreDetail?.orgScores?.length ? (
          <div className={style['org-matrix']}>
            {scoreDetail.orgScores.map(org => (
              <div key={org.organizationId} className={style['org-node']}>
                <div style={{ fontWeight: 500 }}>{org.name}</div>
                <div className={style['muted']} style={{ fontSize: 12 }}>
                  {formatMessage({ id: 'orgAvgScore' }, { score: org.avgScore ?? '-' })} · {formatMessage({ id: 'orgScored' }, { count: org.scoredCount })}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <Empty description={formatMessage({ id: 'noReportData' })} />
        )}
      </Section>

      <Section title={formatMessage({ id: 'portrait' })}>
        <Empty description={formatMessage({ id: 'portraitNotSupported' })} />
      </Section>
    </Flex>
  );
};

const Report = createWithRemoteLoader({
  modules: ['components-core:Global@usePreset']
})(
  withLocale(({ remoteModules, guard }) => {
    const [usePreset] = remoteModules;
    const { apis } = usePreset();
    const { formatMessage, locale } = useIntl();
    const { id } = useParams();
    const api = apis.talentSaas.tenant.talentReview;
    const { data: project } = useFetch(Object.assign({}, api.projectDetail, { params: { id } }));
    const { data: report } = useFetch(Object.assign({}, api.projectReport, { params: { id, locale } }));
    return guard(
      <Page
        title={formatMessage({ id: 'reportTitle' })}
        back
        extra={
          <Tooltip title={formatMessage({ id: 'notSupported' })}>
            <Button disabled>{formatMessage({ id: 'export' })}</Button>
          </Tooltip>
        }
      >
        {project && report ? <ReportView project={project} report={report} /> : <Spin style={{ display: 'block', padding: 80 }} />}
      </Page>
    );
  })
);

export default Report;
