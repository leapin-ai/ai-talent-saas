import { createWithRemoteLoader } from '@kne/remote-loader';
import { useIntl } from '@kne/react-intl';
import { Modal, message } from 'antd';
import withLocale from './withLocale';
import getColumns from './getColumns';
import BaseFormInner from './PositionForm';

const mapFilterValue = (value, getFilterValue) => ({
  filter: getFilterValue(value)
});

const Position = createWithRemoteLoader({
  modules: ['components-admin:BizUnit', 'components-core:Global@usePreset']
})(
  withLocale(({ remoteModules, apis, onDetail, onCreate, onEdit, ...props }) => {
    const [BizUnit, usePreset] = remoteModules;
    const { formatMessage } = useIntl();
    const { ajax } = usePreset();

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

    // 列表侧禁用弹框创建/编辑；表单走独立页面
    const listApis = Object.assign({}, apis, {
      create: null,
      save: null
    });

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
          }
        }}
      />
    );
  })
);

export default Position;
