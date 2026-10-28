import { useEffect, useState } from 'react';
import { Card, Col, Row, Statistic, Tooltip } from 'antd';
import classnames from 'classnames';
import { createWithRemoteLoader } from '@kne/remote-loader';
import { useIntl } from '@kne/react-intl';
import withLocale from './withLocale';
import style from './workforceKpi.module.scss';

const KpiTitle = ({ label, hint }) => (
  <Tooltip placement="bottom" title={hint}>
    <span className={style.titleTip}>{label}</span>
  </Tooltip>
);

const WorkforceKpi = createWithRemoteLoader({
  modules: ['components-core:Global@usePreset']
})(
  withLocale(({ remoteModules, apis, activeKey, onSelect }) => {
    const [usePreset] = remoteModules;
    const { ajax } = usePreset();
    const { formatMessage } = useIntl();
    const [summary, setSummary] = useState(null);

    useEffect(() => {
      let cancelled = false;
      const load = async () => {
        if (!apis?.workforceSummary) {
          return;
        }
        try {
          const { data: resData } = await ajax(Object.assign({}, apis.workforceSummary));
          if (!cancelled && resData?.code === 0) {
            setSummary(resData.data || {});
          }
        } catch (e) {
          // keep empty
        }
      };
      load();
      return () => {
        cancelled = true;
      };
    }, [ajax, apis?.workforceSummary]);

    if (!summary) {
      return null;
    }

    const items = [
      { key: 'rolesInScope', labelId: 'position.kpi.rolesInScope', hintId: 'position.kpi.rolesInScopeHint' },
      { key: 'rolesRequiringChange', labelId: 'position.kpi.rolesRequiringChange', hintId: 'position.kpi.rolesRequiringChangeHint', valueClass: style.valueChange },
      { key: 'highChangeRoles', labelId: 'position.kpi.highChangeRoles', hintId: 'position.kpi.highChangeRolesHint', valueClass: style.valueHigh },
      { key: 'assessmentsRemaining', labelId: 'position.kpi.assessmentsRemaining', hintId: 'position.kpi.assessmentsRemainingHint', valueClass: style.valueRemaining }
    ];

    return (
      <Row gutter={[12, 12]} className={style.row} align="stretch">
        {items.map(({ key, labelId, hintId, valueClass }) => (
          <Col span={6} key={key} className={style.col}>
            <Card
              size="small"
              hoverable
              role="button"
              tabIndex={0}
              aria-pressed={activeKey === key}
              className={classnames(style.card, activeKey === key && style.active)}
              onClick={() => onSelect && onSelect(key)}
              onKeyDown={e => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onSelect && onSelect(key);
                }
              }}
            >
              <Statistic className={valueClass} title={<KpiTitle label={formatMessage({ id: labelId })} hint={formatMessage({ id: hintId })} />} value={Number(summary[key]) || 0} />
            </Card>
          </Col>
        ))}
      </Row>
    );
  })
);

export default WorkforceKpi;
