import { useCallback, useState } from 'react';
import { createWithRemoteLoader } from '@kne/remote-loader';
import { useIntl } from '@kne/react-intl';
import { Modal, message } from 'antd';
import withLocale from './withLocale';
import getColumns from './getColumns';
import BaseFormInner from './PositionForm';
import InsightBanner from './InsightBanner';

const mapFilterValue = (value, getFilterValue) => ({
  filter: getFilterValue(value)
});

const Position = createWithRemoteLoader({
  modules: ['components-admin:BizUnit', 'components-core:Global@usePreset', 'components-core:Filter']
})(
  withLocale(({ remoteModules, apis, onDetail, onCreate, onEdit, withInsightBanner, children, ...props }) => {
    const [BizUnit, usePreset, Filter] = remoteModules;
    const { SuperSelectFilterItem } = Filter.fields;
    const { formatMessage } = useIntl();
    const { ajax } = usePreset();
    const [filterValue, setFilterValue] = useState([]);

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
      const actions = [
        {
          ...actionProps,
          data,
          onSuccess,
          index: 0,
          children: formatMessage({ id: 'action.edit' }),
          onClick: () => {
            if (typeof onEdit === 'function') {
              onEdit({ data });
            }
          }
        }
      ];
      if (data.status === 'published') {
        actions.push({
          ...actionProps,
          data,
          onSuccess,
          index: 1,
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
    }, [formatMessage]);

    // 列表侧禁用弹框创建/编辑；表单走独立页面
    const listApis = Object.assign({}, apis, {
      create: null,
      save: null
    });

    const insightBanner = withInsightBanner ? <InsightBanner apis={apis} onReview={applyHighChangeFilter} /> : null;

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
            buttonGroup: {
              list: [
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
        {typeof children === 'function' ? renderProps => children({ ...renderProps, insightBanner }) : children}
      </BizUnit>
    );
  })
);

export default Position;
