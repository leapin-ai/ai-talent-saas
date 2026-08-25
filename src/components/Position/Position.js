import { createWithRemoteLoader } from '@kne/remote-loader';
import { useIntl } from '@kne/react-intl';
import { Modal, message } from 'antd';
import withLocale from './withLocale';
import getColumns from './getColumns';
import BaseFormInner, { createPaySalary } from './PositionForm';

const mapFilterValue = (value, getFilterValue) => ({
  filter: getFilterValue(value)
});

const Position = createWithRemoteLoader({
  modules: ['components-admin:BizUnit', 'components-core:Global@usePreset']
})(
  withLocale(({ remoteModules, apis, onDetail, ...props }) => {
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
      const actions = [];
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

    return (
      <BizUnit
        {...props}
        isNext
        apis={apis}
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
          formSize: 'default',
          keywordFilterLabel: formatMessage({ id: 'position.keywordFilterLabel' }),
          mapFilterValue,
          formProps: {
            rules: { PAY_SALARY: createPaySalary(formatMessage) }
          },
          saveData: (data, { fetchOptions }) => {
            const org = fetchOptions?.data?.orgEnums?.find(item => item.value === data.tenantOrgId);
            return Object.assign({}, data, {
              tenantOrgId: org ? { name: org.description, id: org.value } : data.tenantOrgId
            });
          }
        }}
      />
    );
  })
);

export default Position;
