import { useCallback, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import ReadinessFlows from '@components/TenantAdmin/ReadinessFlow/ReadinessFlows';
import ReadinessFlowDetail from '@components/TenantAdmin/ReadinessFlow/ReadinessFlowDetail';

const RUN_ID_QUERY = 'runId';

/**
 * 平台 Admin → 租户管理 → 某租户 → 「就绪度流程」tab（与「就绪纠错反馈」并列）。
 * 列表与详情复用租户端组件，接口走 tenantAdmin.readiness 并带上当前租户 id。
 * 详情 runId 写入 URL query，刷新后仍打开同一条详情；「返回列表」清掉 query。
 */
const ReadinessFlowTab = ({ tenant }) => {
  const tenantId = tenant?.id;
  const [searchParams, setSearchParams] = useSearchParams();
  const runId = searchParams.get(RUN_ID_QUERY) || null;
  const prevTenantIdRef = useRef(tenantId);

  const setRunId = useCallback(
    nextId => {
      setSearchParams(
        prev => {
          const next = new URLSearchParams(prev);
          const value = nextId != null && nextId !== '' ? String(nextId) : '';
          if (value) {
            next.set(RUN_ID_QUERY, value);
          } else {
            next.delete(RUN_ID_QUERY);
          }
          return next;
        },
        { replace: !nextId }
      );
    },
    [setSearchParams]
  );

  // 仅在租户真正切换时清掉详情 query；首次挂载 / 刷新保留 ?runId=
  useEffect(() => {
    const prev = prevTenantIdRef.current;
    prevTenantIdRef.current = tenantId;
    if (!prev || prev === tenantId) {
      return;
    }
    setSearchParams(
      prevParams => {
        if (!prevParams.get(RUN_ID_QUERY)) {
          return prevParams;
        }
        const next = new URLSearchParams(prevParams);
        next.delete(RUN_ID_QUERY);
        return next;
      },
      { replace: true }
    );
  }, [tenantId, setSearchParams]);

  if (!tenantId) {
    return null;
  }

  if (runId) {
    return <ReadinessFlowDetail key={`${tenantId}-${runId}`} adminTenantId={tenantId} runId={runId} onBack={() => setRunId(null)} />;
  }

  return <ReadinessFlows key={tenantId} adminTenantId={tenantId} onOpenDetail={setRunId} />;
};

export default ReadinessFlowTab;
