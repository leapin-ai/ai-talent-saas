import { createWithRemoteLoader } from '@kne/remote-loader';
import { useIntl } from '@kne/react-intl';
import { useState } from 'react';
import { Modal, message } from 'antd';
import withLocale from './withLocale';
import getColumns from './getColumns';
import BaseFormInner, { createPaySalary } from './PositionForm';

const Position = createWithRemoteLoader({
  modules: ['components-admin:BizUnit', 'components-admin:Editor', 'components-core:Global@usePreset']
})(
  withLocale(({ remoteModules, baseUrl, apis, onDetail, ...props }) => {
    const [BizUnit, , usePreset] = remoteModules;
    const { formatMessage } = useIntl();
    const { ajax } = usePreset();
    const [refreshKey, setRefreshKey] = useState(0);

    const handleSetStatus = (id, status) => {
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
              setRefreshKey(prev => prev + 1);
            }
          });
        }
      });
    };

    const getActionList = ({ data, ...actionProps }) => {
      const actions = [];
      if (data.status === 'published') {
        actions.push({
          ...actionProps,
          data,
          index: 1,
          children: formatMessage({ id: 'action.unpublish' }),
          onClick: () => handleSetStatus(data.id, 'draft')
        });
      } else {
        actions.push({
          ...actionProps,
          data,
          children: formatMessage({ id: 'action.publish' }),
          onClick: () => handleSetStatus(data.id, 'published')
        });
      }
      return actions;
    };

    return (
      <BizUnit
        key={refreshKey}
        {...props}
        apis={apis}
        getColumns={() =>
          getColumns({
            onDetail: colItem => onDetail(colItem),
            formatMessage
          })
        }
        getFormInner={() => <BaseFormInner />}
        getActionList={getActionList}
        name="position"
        options={{
          bizName: formatMessage({ id: 'position.bizName' }),
          formSize: 'default',
          keywordFilterLabel: formatMessage({ id: 'position.keywordFilterLabel' }),
          formProps: {
            rules: { PAY_SALARY: createPaySalary(formatMessage) }
          }
        }}
      />
    );
  })
);

export default Position;
