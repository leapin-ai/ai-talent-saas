import { useEffect, useMemo, useState } from 'react';
import { Card, Col, Empty, Flex, Row, Select, Spin, Tooltip, TreeSelect } from 'antd';
import { createWithRemoteLoader } from '@kne/remote-loader';
import { useIntl } from '@kne/react-intl';
import withLocale from './withLocale';
import style from './workforceAiMix.module.scss';

const MIX_KEYS = ['automated', 'augmented', 'humanLed', 'unassessed'];
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

const toPercent = (count, total) => (total ? Math.round((count / total) * 1000) / 10 : 0);

const buildOrgTree = list => {
  const nodes = new Map(list.map(item => [String(item.id), { value: String(item.id), title: item.name, children: [] }]));
  const roots = [];
  list.forEach(item => {
    const node = nodes.get(String(item.id));
    const parent = item.parentId != null ? nodes.get(String(item.parentId)) : null;
    (parent ? parent.children : roots).push(node);
  });
  return roots;
};

const MixLegend = ({ mix, formatMessage }) => (
  <Flex wrap gap={12} className={style.legend}>
    {MIX_KEYS.filter(key => key !== 'unassessed' || mix.unassessed > 0).map(key => (
      <span key={key} className={style['legend-item']}>
        <i style={{ background: MIX_COLORS[key] }} />
        {formatMessage({ id: `position.aiMix.${key}` })} {mix[key]}
      </span>
    ))}
  </Flex>
);

const Donut = ({ mix, total, formatMessage }) => {
  const assessed = sumAssessed(mix);
  let start = 0;
  const stops = ASSESSED_KEYS.map(key => {
    const end = start + (assessed ? (mix[key] / assessed) * 100 : 0);
    const stop = `${MIX_COLORS[key]} ${start}% ${end}%`;
    start = end;
    return stop;
  });
  return (
    <div className={style.donut} style={{ background: assessed ? `conic-gradient(${stops.join(', ')})` : MIX_COLORS.unassessed }}>
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
  modules: ['components-core:Global@usePreset']
})(
  withLocale(({ remoteModules, apis }) => {
    const [usePreset] = remoteModules;
    const { ajax } = usePreset();
    const { formatMessage } = useIntl();
    const [orgTree, setOrgTree] = useState([]);
    const [orgIds, setOrgIds] = useState([]);
    const [status, setStatus] = useState(['published']);
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
      if (!apis?.orgList) {
        return;
      }
      let cancelled = false;
      ajax(Object.assign({}, apis.orgList))
        .then(({ data: resData }) => {
          if (cancelled || resData?.code !== 0) {
            return;
          }
          const list = Array.isArray(resData.data) ? resData.data : resData.data?.pageData || [];
          setOrgTree(buildOrgTree(list));
        })
        .catch(() => {});
      return () => {
        cancelled = true;
      };
    }, [ajax, apis?.orgList]);

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
            <TreeSelect
              className={style['filter-org']}
              variant="borderless"
              treeData={orgTree}
              value={orgIds}
              onChange={setOrgIds}
              treeCheckable
              showCheckedStrategy={TreeSelect.SHOW_PARENT}
              maxTagCount={1}
              maxTagPlaceholder={omitted => `+${omitted.length}`}
              allowClear
              treeDefaultExpandAll
              placeholder={formatMessage({ id: 'position.aiMix.orgPlaceholder' })}
            />
            <Select
              className={style['filter-status']}
              variant="borderless"
              mode="multiple"
              value={status}
              onChange={setStatus}
              maxTagCount={1}
              maxTagPlaceholder={omitted => `+${omitted.length}`}
              placeholder={formatMessage({ id: 'position.aiMix.statusPlaceholder' })}
              options={STATUS_LIST.map(value => ({ value, label: formatMessage({ id: `positionStatus.${value}` }) }))}
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
                    <MixLegend mix={mix} formatMessage={formatMessage} />
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
                    <MixLegend mix={mix} formatMessage={formatMessage} />
                    <div className={style['role-list']}>
                      {roles.map(role => (
                        <div className={style['role-row']} key={role.id}>
                          <span className={style['role-name']} title={role.name}>
                            {role.name}
                          </span>
                          <StackedBar role={role} formatMessage={formatMessage} />
                          <span className={style['role-total']}>{role.total}</span>
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
