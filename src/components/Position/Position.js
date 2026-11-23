import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createWithRemoteLoader } from '@kne/remote-loader';
import { useIntl } from '@kne/react-intl';
import { useLocation, useNavigate } from 'react-router-dom';
import { Modal, message } from 'antd';
import withLocale from './withLocale';
import getColumns from './getColumns';
import BaseFormInner from './PositionForm';
import InsightBanner from './InsightBanner';
import WorkforceKpi from './WorkforceKpi';
import WorkforceAiMix from './WorkforceAiMix';
import { createPositionListCardsRender } from './PositionListCards';
import useStartReadiness from './useStartReadiness';
import { TENANT_ADMIN_PERMISSIONS } from '@components/TenantAdmin/constants';
import useShareReport from '@components/ShareReport/useShareReport';
import { FormatMessage as ShareReportMessage } from '@components/ShareReport/withLocale';
import useTablePaginationSearchParams from '../../commons/useTablePaginationSearchParams';
import style from './style.module.scss';

const Position = createWithRemoteLoader({
  modules: ['components-admin:BizUnit', 'components-core:Global@usePreset', 'components-core:Filter', 'components-core:Permissions@usePermissionsPass', 'components-core:TablePage@Table', 'components-core:FormInfo@useFormModal']
})(
  withLocale(({ remoteModules, apis, baseUrl = '', onDetail, onCreate, onEdit, withInsightBanner, children, ...props }) => {
    const [BizUnit, usePreset, Filter, usePermissionsPass, Table, useFormModal] = remoteModules;
    const { SuperSelectFilterItem } = Filter.fields;
    const { formatMessage } = useIntl();
    const paginationSearchParams = useTablePaginationSearchParams();
    const { ajax, apis: presetApis } = usePreset();
    const formModal = useFormModal();
    const location = useLocation();
    const navigate = useNavigate();
    const [filterValue, setFilterValue] = useState([]);
    const [activeKpi, setActiveKpi] = useState(null);
    const [listKey, setListKey] = useState(0);
    const autoStartHandled = useRef(false);

    const mapFilterValue = useCallback(
      (value, getFilterValue) => ({
        filter: Object.assign({}, getFilterValue(value), activeKpi ? { kpi: activeKpi } : {})
      }),
      [activeKpi]
    );

    const selectKpi = useCallback(key => {
      setActiveKpi(prev => (prev === key ? null : key));
      setFilterValue([]);
      setListKey(value => value + 1);
    }, []);
    const canCreate = usePermissionsPass({ request: TENANT_ADMIN_PERMISSIONS.positionCreate });
    const canEdit = usePermissionsPass({ request: TENANT_ADMIN_PERMISSIONS.positionEdit });
    const canPublish = usePermissionsPass({ request: TENANT_ADMIN_PERMISSIONS.positionPublish });
    const canRemove = usePermissionsPass({ request: TENANT_ADMIN_PERMISSIONS.positionRemove });
    const canInvite = usePermissionsPass({ request: TENANT_ADMIN_PERMISSIONS.positionInvite });
    const canShare = usePermissionsPass({ request: TENANT_ADMIN_PERMISSIONS.positionShare });
    const [pageList, setPageList] = useState([]);
    const { selectedRows, getRowSelection } = Table.useSelectedRow({ rowKey: 'id' });
    const openShareReport = useShareReport({ kind: 'position', useFormModal, usePreset, getName: item => item.name || '' });
    const openStartReadiness = useStartReadiness({
      formModal,
      ajax,
      apis,
      orgListApi: apis.orgList || presetApis?.tenant?.orgList,
      userListApi: apis.userList || presetApis?.talentSaas?.tenant?.userList
    });

    // 添加岗位成功后带 state 回列表，自动打开启动表单
    useEffect(() => {
      const startId = location.state?.startReadinessId;
      if (!startId || autoStartHandled.current || !canInvite) {
        return;
      }
      const fromState = location.state?.startReadinessPosition;
      const fromList = pageList.find(item => String(item.id) === String(startId));
      const position = fromState?.id ? fromState : fromList;
      if (!position) {
        return;
      }
      autoStartHandled.current = true;
      openStartReadiness({
        position,
        mode: 'start',
        onSuccess: () => setListKey(key => key + 1)
      });
      navigate(`${location.pathname}${location.search}`, { replace: true, state: {} });
    }, [canInvite, location.pathname, location.search, location.state, navigate, openStartReadiness, pageList]);

    const handleSetStatus = (id, status, onSuccess) => {
      const isPublish = status === 'published';
      Modal.confirm({
        title: isPublish ? formatMessage({ id: 'position.publishConfirm' }) : formatMessage({ id: 'position.unpublishConfirm' }),
        onOk: () => {
          return ajax({
            url: apis.setStatus.url,
            method: apis.setStatus.method,
            data: { id, status }
          }).then(({ data: res }) => {
            if (res.code === 0) {
              message.success(isPublish ? formatMessage({ id: 'action.publishSuccess' }) : formatMessage({ id: 'action.unpublishSuccess' }));
              onSuccess && onSuccess();
            }
          });
        }
      });
    };

    const getActionList = ({ data, onSuccess, ...actionProps }) => {
      const actions = [];
      if (canEdit) {
        actions.push({
          ...actionProps,
          data,
          onSuccess,
          children: formatMessage({ id: 'action.edit' }),
          onClick: () => {
            if (typeof onEdit === 'function') {
              onEdit({ data });
            }
          }
        });
      }
      if (canPublish) {
        if (data.status === 'published') {
          actions.push({
            ...actionProps,
            data,
            onSuccess,
            children: formatMessage({ id: 'action.unpublish' }),
            onClick: () => handleSetStatus(data.id, 'draft', onSuccess)
          });
        } else {
          actions.push({
            ...actionProps,
            data,
            onSuccess,
            children: formatMessage({ id: 'action.publish' }),
            onClick: () => handleSetStatus(data.id, 'published', onSuccess)
          });
        }
      }
      // 启动 / 岗位重建：共用 positionInvite；表单同 Admin 新建流程（锁定当前岗位）
      if (canInvite) {
        const assessmentStatus = data.assessmentStatus || 'pending';
        if (assessmentStatus === 'pending') {
          actions.push({
            ...actionProps,
            data,
            onSuccess,
            children: formatMessage({ id: 'position.readinessStart' }),
            onClick: () =>
              openStartReadiness({
                position: data,
                mode: 'start',
                onSuccess: () => {
                  onSuccess?.();
                  setListKey(key => key + 1);
                }
              })
          });
        }
        if (assessmentStatus === 'interviews_in_progress') {
          actions.push({
            ...actionProps,
            data,
            onSuccess,
            children: formatMessage({ id: 'position.readinessCancel' }),
            onClick: () => {
              Modal.confirm({
                title: formatMessage({ id: 'position.readinessCancelConfirm' }, { name: data.name || '' }),
                onOk: async () => {
                  const { data: res } = await ajax(
                    Object.assign({}, apis.cancelReadiness, {
                      data: { positionId: String(data.id) }
                    })
                  );
                  if (res.code !== 0) {
                    return Promise.reject(new Error(res.msg || 'cancel failed'));
                  }
                  message.success(formatMessage({ id: 'position.readinessCancelSuccess' }));
                  onSuccess?.();
                  setListKey(key => key + 1);
                }
              });
            }
          });
        }
        // 已完成 / 失败：岗位重建（失败流程已 canceled，可直接新建）
        if (assessmentStatus === 'completed' || assessmentStatus === 'error') {
          actions.push({
            ...actionProps,
            data,
            onSuccess,
            children: formatMessage({ id: 'position.readinessRebuild' }),
            onClick: () =>
              openStartReadiness({
                position: data,
                mode: 'rebuild',
                onSuccess: () => {
                  onSuccess?.();
                  setListKey(key => key + 1);
                }
              })
          });
        }
      }
      // 删除必须在操作列最后
      if (canRemove) {
        actions.push({ name: 'remove' });
      }
      return actions;
    };

    const applyHighChangeFilter = useCallback(() => {
      setActiveKpi(null);
      setFilterValue([
        {
          name: 'changeMagnitude',
          label: formatMessage({ id: 'position.changeMagnitude' }),
          value: {
            label: formatMessage({ id: 'position.changeMagnitude.high' }),
            value: 'high'
          }
        }
      ]);
      // TablePage 受控 filter.value 变更不会触发 reload；remount 后按首包种子重新拉列表
      setListKey(key => key + 1);
    }, [formatMessage]);

    // 列表侧禁用弹框创建/编辑；表单走独立页面。发布走自定义按钮，勿用 BizUnit 默认 open/close
    const listApis = Object.assign({}, apis, {
      create: null,
      save: null,
      setStatus: null,
      remove: canRemove ? apis.remove : null
    });

    const insightBanner = withInsightBanner ? <InsightBanner apis={apis} onReview={applyHighChangeFilter} /> : null;
    const workforceKpi = withInsightBanner ? <WorkforceKpi apis={apis} activeKey={activeKpi} onSelect={selectKpi} /> : null;
    const workforceAiMix = withInsightBanner ? <WorkforceAiMix apis={apis} /> : null;

    const renderCard = useMemo(() => createPositionListCardsRender({ onDetail, formatMessage }), [onDetail, formatMessage]);
    const renderMobile = renderCard;

    return (
      <BizUnit
        {...props}
        isNext
        apis={listApis}
        getColumns={() =>
          getColumns({
            onDetail,
            formatMessage
          })
        }
        getFormInner={({ apis: formApis }) => <BaseFormInner apis={formApis} />}
        getActionList={getActionList}
        name="position"
        filter={{
          value: filterValue,
          onChange: setFilterValue,
          list: [
            {
              type: SuperSelectFilterItem,
              props: {
                name: 'changeMagnitude',
                label: formatMessage({ id: 'position.changeMagnitude' }),
                single: true,
                options: [
                  { label: formatMessage({ id: 'position.changeMagnitude.low' }), value: 'low' },
                  { label: formatMessage({ id: 'position.changeMagnitude.medium' }), value: 'medium' },
                  { label: formatMessage({ id: 'position.changeMagnitude.high' }), value: 'high' }
                ]
              }
            }
          ]
        }}
        options={{
          bizName: formatMessage({ id: 'position.bizName' }),
          keywordFilterLabel: formatMessage({ id: 'position.keywordFilterLabel' }),
          mapFilterValue,
          tableProps: {
            renderCard,
            renderMobile,
            rowClassName: record => (record?.assessmentStatus === 'error' ? style.assessmentErrorRow : undefined),
            ...(canShare
              ? {
                  rowKey: 'id',
                  rowSelection: getRowSelection(pageList),
                  selectedRows,
                  batchActions: [
                    {
                      key: 'share-report',
                      label: <ShareReportMessage id="shareReport.action" />,
                      onClick: () => openShareReport(selectedRows)
                    }
                  ]
                }
              : {}),
            dataFormat: data => {
              const orgEnums = Array.isArray(data?.orgEnums) ? data.orgEnums : [];
              const pageData = Array.isArray(data?.pageData) ? data.pageData : [];
              const list = pageData.map(item => {
                const org = orgEnums.find(target => String(target.value) === String(item.tenantOrgId));
                return Object.assign({}, item, {
                  departmentName: org?.description || '-'
                });
              });
              queueMicrotask(() => setPageList(list));
              return {
                list,
                total: data?.totalCount ?? data?.total ?? 0,
                orgEnums
              };
            },
            pagination: {
              searchParams: paginationSearchParams.searchParams,
              setSearchParams: paginationSearchParams.setSearchParams
            },
            buttonGroup: {
              list: canCreate
                ? [
                    {
                      type: 'primary',
                      children: formatMessage({ id: 'position.create' }),
                      onClick: () => {
                        if (typeof onCreate === 'function') {
                          onCreate();
                        }
                      }
                    }
                  ]
                : []
            }
          },
          saveData: (data, { fetchOptions }) => {
            const org = fetchOptions?.data?.orgEnums?.find(item => item.value === data.tenantOrgId);
            return Object.assign({}, data, {
              // 组织已删时按未设置处理，避免带失效 id 提交报错
              tenantOrgId: org ? { name: org.description, id: org.value } : null
            });
          }
        }}
      >
        {typeof children === 'function' ? renderProps => children({ ...renderProps, insightBanner, workforceKpi, workforceAiMix, listKey }) : children}
      </BizUnit>
    );
  })
);

export default Position;
