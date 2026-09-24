import { useCallback, useMemo, useState } from 'react';
import { createWithRemoteLoader } from '@kne/remote-loader';
import { useIntl } from '@kne/react-intl';
import { Modal, message } from 'antd';
import withLocale from './withLocale';
import getColumns from './getColumns';
import BaseFormInner from './PositionForm';
import InsightBanner from './InsightBanner';
import WorkforceKpi from './WorkforceKpi';
import { createPositionListCardsRender } from './PositionListCards';
import InviteAssessment from './Detail/AnalyzeTalent/InviteAssessment';
import { TENANT_ADMIN_PERMISSIONS } from '@components/TenantAdmin/constants';
import useTablePaginationSearchParams from '../../commons/useTablePaginationSearchParams';

const mapFilterValue = (value, getFilterValue) => ({
  filter: getFilterValue(value)
});

const Position = createWithRemoteLoader({
  modules: ['components-admin:BizUnit', 'components-core:Global@usePreset', 'components-core:Filter', 'components-core:Permissions@usePermissionsPass']
})(
  withLocale(({ remoteModules, apis, baseUrl = '', onDetail, onCreate, onEdit, withInsightBanner, children, ...props }) => {
    const [BizUnit, usePreset, Filter, usePermissionsPass] = remoteModules;
    const { SuperSelectFilterItem } = Filter.fields;
    const { formatMessage } = useIntl();
    const paginationSearchParams = useTablePaginationSearchParams();
    const { ajax } = usePreset();
    const [filterValue, setFilterValue] = useState([]);
    const [listKey, setListKey] = useState(0);
    const canCreate = usePermissionsPass({ request: TENANT_ADMIN_PERMISSIONS.positionCreate });
    const canEdit = usePermissionsPass({ request: TENANT_ADMIN_PERMISSIONS.positionEdit });
    const canPublish = usePermissionsPass({ request: TENANT_ADMIN_PERMISSIONS.positionPublish });
    const canRemove = usePermissionsPass({ request: TENANT_ADMIN_PERMISSIONS.positionRemove });
    const canInvite = usePermissionsPass({ request: TENANT_ADMIN_PERMISSIONS.positionInvite });

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
      // 邀请评估员工 / 经理共用 positionInvite，可同时控制
      if (canInvite) {
        actions.push({
          ...actionProps,
          data,
          onSuccess,
          baseUrl,
          inviteType: 'employee',
          buttonComponent: InviteAssessment,
          children: formatMessage({ id: 'position.talentInviteEmployeesAction' })
        });
        actions.push({
          ...actionProps,
          data,
          onSuccess,
          baseUrl,
          inviteType: 'manager',
          buttonComponent: InviteAssessment,
          children: formatMessage({ id: 'position.talentInviteManagersAction' })
        });
      }
      // 删除必须在操作列最后
      if (canRemove) {
        actions.push({ name: 'remove' });
      }
      return actions;
    };

    const applyHighChangeFilter = useCallback(() => {
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
    const workforceKpi = withInsightBanner ? <WorkforceKpi apis={apis} /> : null;

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
            dataFormat: data => {
              const orgEnums = Array.isArray(data?.orgEnums) ? data.orgEnums : [];
              const pageData = Array.isArray(data?.pageData) ? data.pageData : [];
              return {
                list: pageData.map(item => {
                  const org = orgEnums.find(target => String(target.value) === String(item.tenantOrgId));
                  return Object.assign({}, item, {
                    departmentName: org?.description || '-'
                  });
                }),
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
        {typeof children === 'function' ? renderProps => children({ ...renderProps, insightBanner, workforceKpi, listKey }) : children}
      </BizUnit>
    );
  })
);

export default Position;
