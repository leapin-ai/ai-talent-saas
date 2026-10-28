import { useEffect, useMemo, useState } from 'react';
import { Card, Col, Empty, Flex, Row, Spin, Tooltip } from 'antd';
import { createWithRemoteLoader } from '@kne/remote-loader';
import { useIntl } from '@kne/react-intl';
import withLocale from './withLocale';
import style from './workforceAiMix.module.scss';

// 未评估只计数，不参与占比
const ASSESSED_KEYS = ['automated', 'augmented', 'humanLed'];
const sumAssessed = mix => ASSESSED_KEYS.reduce((sum, key) => sum + (mix?.[key] || 0), 0);
// @kne/react-box 标准色板：主色 #4F46E5、辅色 #22d3ee、warning #f59e0b
const MIX_COLORS = {
  automated: '#4F46E5',
  augmented: '#22d3ee',
  humanLed: '#f59e0b',
  unassessed: 'rgba(79, 70, 229, 0.1)'
};
const MIX_TEXT_COLORS = {
  automated: '#ffffff',
  augmented: '#161431',
  humanLed: '#ffffff',
  unassessed: '#67658C'
};
const STATUS_LIST = ['published', 'draft', 'closed'];
const DEFAULT_STATUS = ['published'];

const toPercent = (count, total) => (total ? Math.round((count / total) * 1000) / 10 : 0);

const MixLegend = ({ formatMessage }) => (
  <Flex wrap gap={12} className={style.legend}>
    {ASSESSED_KEYS.map(key => (
      <span key={key} className={style['legend-item']}>
        <i style={{ background: MIX_COLORS[key] }} />
        {formatMessage({ id: `position.aiMix.${key}` })}
      </span>
    ))}
  </Flex>
);

// 段太窄放不下百分比文字时不显示
const DONUT_LABEL_MIN_PERCENT = 5;
// 标签落在环宽中线：外径 84px、环宽 28px
const DONUT_LABEL_RADIUS = 70;

const Donut = ({ mix, total, formatMessage }) => {
  const assessed = sumAssessed(mix);
  let start = 0;
  const segments = ASSESSED_KEYS.map(key => {
    const percent = assessed ? (mix[key] / assessed) * 100 : 0;
    const segment = { key, start, end: start + percent, percent };
    start += percent;
    return segment;
  });
  const stops = segments.map(({ key, start, end }) => `${MIX_COLORS[key]} ${start}% ${end}%`);
  return (
    <div className={style.donut} style={{ background: assessed ? `conic-gradient(${stops.join(', ')})` : MIX_COLORS.unassessed }}>
      {segments
        .filter(({ percent }) => percent >= DONUT_LABEL_MIN_PERCENT)
        .map(({ key, start, end, percent }) => {
          const angle = (((start + end) / 2) * 3.6 * Math.PI) / 180;
          return (
            <span
              key={key}
              className={style['donut-percent']}
              style={{
                left: `calc(50% + ${Math.sin(angle) * DONUT_LABEL_RADIUS}px)`,
                top: `calc(50% - ${Math.cos(angle) * DONUT_LABEL_RADIUS}px)`,
                color: MIX_TEXT_COLORS[key]
              }}
            >
              {toPercent(mix[key], assessed)}%
            </span>
          );
        })}
      <div className={style['donut-hole']}>
        <span className={style['donut-value']}>{total}</span>
        <span className={style['donut-label']}>{formatMessage({ id: 'position.aiMix.tasksUnit' })}</span>
      </div>
    </div>
  );
};

const StackedBar = ({ role, formatMessage }) => (
  <div className={style['stack-bar']}>
    {ASSESSED_KEYS.map(key => {
      const percent = toPercent(role[key], sumAssessed(role));
      if (!percent) {
        return null;
      }
      return (
        <Tooltip key={key} title={`${formatMessage({ id: `position.aiMix.${key}` })} ${role[key]}（${percent}%）`}>
          <span className={style['stack-seg']} style={{ width: `${percent}%`, background: MIX_COLORS[key], color: MIX_TEXT_COLORS[key] }}>
            {percent >= 12 ? role[key] : ''}
          </span>
        </Tooltip>
      );
    })}
  </div>
);

const WorkforceAiMix = createWithRemoteLoader({
  modules: ['components-core:Global@usePreset', 'components-core:Common@SuperSelectField', 'components-core:Common@SuperSelectTreeField']
})(
  withLocale(({ remoteModules, apis }) => {
    const [usePreset, SuperSelectField, SuperSelectTreeField] = remoteModules;
    const { ajax } = usePreset();
    const { formatMessage } = useIntl();
    const [orgValue, setOrgValue] = useState([]);
    const [status, setStatus] = useState(DEFAULT_STATUS);
    const isDefaultStatus = status.length === 1 && status[0] === DEFAULT_STATUS[0];
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(false);
    const orgIds = useMemo(() => orgValue.map(item => item.id), [orgValue]);
    const statusOptions = useMemo(() => STATUS_LIST.map(value => ({ value, label: formatMessage({ id: `positionStatus.${value}` }) })), [formatMessage]);

    useEffect(() => {
      if (!apis?.workforceAiMix) {
        return;
      }
      let cancelled = false;
      setLoading(true);
      ajax(
        Object.assign({}, apis.workforceAiMix, {
          params: {
            tenantOrgIds: orgIds.join(','),
            status: status.join(',')
          }
        })
      )
        .then(({ data: resData }) => {
          if (!cancelled && resData?.code === 0) {
            setData(resData.data || null);
          }
        })
        .catch(() => {})
        .finally(() => {
          if (!cancelled) {
            setLoading(false);
          }
        });
      return () => {
        cancelled = true;
      };
    }, [ajax, apis?.workforceAiMix, orgIds, status]);

    const roles = useMemo(() => (data?.roles || []).filter(item => item.total > 0).sort((a, b) => b.total - a.total), [data]);
    const capacityRoles = useMemo(() => (data?.roles || []).filter(item => item.aiEfficiencyGain != null).sort((a, b) => b.aiEfficiencyGain - a.aiEfficiencyGain), [data]);
    const maxGain = capacityRoles[0]?.aiEfficiencyGain || 0;

    if (!apis?.workforceAiMix) {
      return null;
    }

    const mix = data?.mix || { automated: 0, augmented: 0, humanLed: 0, unassessed: 0 };
    const taskCount = data?.taskCount || 0;
    const capacityPercent = data?.capacity?.percent;
    const empty = <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={formatMessage({ id: 'position.aiMix.empty' })} />;

    return (
      <Card className={style.root}>
        <Flex justify="space-between" align="center" wrap gap={12} className={style.header}>
          <div>
            <div className={style.title}>{formatMessage({ id: 'position.aiMix.title' })}</div>
            <div className={style.subtitle}>{formatMessage({ id: 'position.aiMix.subtitle' }, { count: data?.positionCount || 0 })}</div>
          </div>
          <Flex gap={8} wrap className={style.filters}>
            <SuperSelectTreeField
              className={style['filter-org']}
              api={apis.orgList}
              valueKey="id"
              labelKey="name"
              value={orgValue}
              onChange={next => setOrgValue(next || [])}
              allowClear
              placeholder={formatMessage({ id: 'position.aiMix.orgPlaceholder' })}
            />
            <SuperSelectField
              className={`${style['filter-status']}${isDefaultStatus ? ` ${style['filter-status-default']}` : ''}`}
              options={statusOptions}
              value={statusOptions.filter(item => status.includes(item.value))}
              onChange={next => setStatus(next?.length ? next.map(item => item.value) : DEFAULT_STATUS)}
              placeholder={formatMessage({ id: 'position.aiMix.statusPlaceholder' })}
            />
          </Flex>
        </Flex>
        <Spin spinning={loading}>
          <Row gutter={[12, 12]} align="stretch">
            <Col xs={24} lg={16} className={style['panel-col']}>
              <div className={style.stats}>
                <div className={style.stat}>
                  <div className={style['stat-value']}>{taskCount}</div>
                  <div className={style['stat-label']}>
                    {formatMessage({ id: 'position.aiMix.tasks' })}
                    {mix.unassessed > 0 && <span className={style['stat-hint']}>{formatMessage({ id: 'position.aiMix.unassessedHint' }, { count: mix.unassessed })}</span>}
                  </div>
                </div>
                {['automated', 'augmented', 'humanLed'].map(key => (
                  <div className={style.stat} key={key}>
                    <div className={style['stat-value']}>{toPercent(mix[key], sumAssessed(mix))}%</div>
                    <div className={style['stat-label']}>
                      <i className={style['stat-dot']} style={{ background: MIX_COLORS[key] }} />
                      {formatMessage({ id: `position.aiMix.${key}` })}
                    </div>
                  </div>
                ))}
              </div>
            </Col>
            <Col xs={24} lg={8} className={style['panel-col']}>
              <div className={style.capacity}>
                <div className={style['capacity-label']}>{formatMessage({ id: 'position.aiMix.capacity' })}</div>
                <div className={style['capacity-value']}>{capacityPercent == null ? '-' : formatMessage({ id: 'position.aiMix.capacityValue' }, { percent: capacityPercent })}</div>
                <div className={style['capacity-hint']}>{formatMessage({ id: 'position.aiMix.capacityHint' }, { count: data?.capacity?.roleCount || 0 })}</div>
              </div>
            </Col>
            <Col xs={24} lg={7} className={style['panel-col']}>
              <div className={style.panel}>
                <div className={style['panel-title']}>{formatMessage({ id: 'position.aiMix.overall' })}</div>
                {taskCount ? (
                  <Flex vertical align="center" gap={16} className={style['donut-wrap']}>
                    <Donut mix={mix} total={taskCount} formatMessage={formatMessage} />
                    <MixLegend formatMessage={formatMessage} />
                  </Flex>
                ) : (
                  empty
                )}
              </div>
            </Col>
            <Col xs={24} lg={10} className={style['panel-col']}>
              <div className={style.panel}>
                <div className={style['panel-title']}>{formatMessage({ id: 'position.aiMix.byRole' })}</div>
                {roles.length ? (
                  <>
                    <MixLegend formatMessage={formatMessage} />
                    <div className={style['role-list']}>
                      {roles.map(role => (
                        <div className={style['role-row']} key={role.id}>
                          <span className={style['role-name']} title={role.name}>
                            {role.name}
                          </span>
                          <StackedBar role={role} formatMessage={formatMessage} />
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  empty
                )}
              </div>
            </Col>
            <Col xs={24} lg={7} className={style['panel-col']}>
              <div className={style.panel}>
                <div className={style['panel-title']}>{formatMessage({ id: 'position.aiMix.capacityByRole' })}</div>
                {capacityRoles.length ? (
                  <div className={style['role-list']}>
                    {capacityRoles.map(role => (
                      <div className={style['capacity-row']} key={role.id}>
                        <span className={style['role-name']} title={role.name}>
                          {role.name}
                        </span>
                        <span className={style['capacity-track']}>
                          <span className={style['capacity-bar']} style={{ width: `${maxGain ? (role.aiEfficiencyGain / maxGain) * 100 : 0}%` }} />
                        </span>
                        <span className={style['role-total']}>{role.aiEfficiencyGain}%</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  empty
                )}
              </div>
            </Col>
          </Row>
        </Spin>
      </Card>
    );
  })
);

export default WorkforceAiMix;
