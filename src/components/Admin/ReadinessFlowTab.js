import { useEffect, useState } from 'react';
import { Drawer } from 'antd';
import ReadinessFlows from '@components/TenantAdmin/ReadinessFlow/ReadinessFlows';
import ReadinessFlowDetail from '@components/TenantAdmin/ReadinessFlow/ReadinessFlowDetail';

/**
 * 平台 Admin → 租户管理 → 某租户 → 「就绪度流程」tab（与「就绪纠错反馈」并列）。
 * 列表与详情复用租户端组件，接口走 tenantAdmin.readiness 并带上当前租户 id。
 * 详情用抽屉打开，关闭即回列表（不再单独放「返回列表」按钮）。
 */
const ReadinessFlowTab = ({ tenant }) => {
  const tenantId = tenant?.id;
  const [runId, setRunId] = useState(null);

  // 切换租户时关掉详情，避免把上一个租户的流程 id 带过来
  useEffect(() => {
    setRunId(null);
  }, [tenantId]);

  if (!tenantId) {
    return null;
  }

  return (
    <>
      <ReadinessFlows key={tenantId} adminTenantId={tenantId} onOpenDetail={setRunId} />
      <Drawer open={!!runId} onClose={() => setRunId(null)} width="min(1100px, 96vw)" destroyOnClose styles={{ body: { padding: 0, background: 'var(--ant-color-bg-layout)' } }}>
        {runId ? <ReadinessFlowDetail key={`${tenantId}-${runId}`} adminTenantId={tenantId} runId={runId} /> : null}
      </Drawer>
    </>
  );
};

export default ReadinessFlowTab;
