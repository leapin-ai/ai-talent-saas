import { useEffect, useState } from 'react';
import { Card, Col, Row, Statistic } from 'antd';
import { createWithRemoteLoader } from '@kne/remote-loader';
import { useIntl } from '@kne/react-intl';
import withLocale from './withLocale';
import style from './workforceKpi.module.scss';

const WorkforceKpi = createWithRemoteLoader({
  modules: ['components-core:Global@usePreset']
})(
  withLocale(({ remoteModules, apis }) => {
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
      ['rolesInScope', 'position.kpi.rolesInScope'],
      ['rolesRequiringChange', 'position.kpi.rolesRequiringChange'],
      ['highChangeRoles', 'position.kpi.highChangeRoles'],
      ['assessmentsRemaining', 'position.kpi.assessmentsRemaining']
    ];

    return (
      <Row gutter={12} className={style.row} align="stretch">
        {items.map(([key, labelId]) => (
          <Col span={6} key={key} className={style.col}>
            <Card size="small" className={style.card}>
              <Statistic title={formatMessage({ id: labelId })} value={Number(summary[key]) || 0} />
            </Card>
          </Col>
        ))}
      </Row>
    );
  })
);

export default WorkforceKpi;
