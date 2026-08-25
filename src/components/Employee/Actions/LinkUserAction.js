import { createWithRemoteLoader } from '@kne/remote-loader';
import { Button, Modal, message } from 'antd';
import { useState } from 'react';
import withLocale from '../withLocale';
import { useIntl } from '@kne/react-intl';

const LinkUserAction = createWithRemoteLoader({
  modules: ['components-admin:Tenant@TenantUserSelect', 'components-core:Global@usePreset']
})(
  withLocale(({ remoteModules, data, apis, onSuccess, ...props }) => {
    const { formatMessage } = useIntl();
    const [TenantUserSelect, usePreset] = remoteModules;
    const { ajax } = usePreset();
    const [open, setOpen] = useState(false);
    const [value, setValue] = useState(null);
    const [confirmLoading, setConfirmLoading] = useState(false);

    const close = () => {
      setOpen(false);
      setValue(null);
    };

    const handleOk = async () => {
      const tenantUserId = value && (value.id ?? value);
      if (!tenantUserId) {
        message.warning(formatMessage({ id: 'employee.selectUser' }));
        return;
      }
      setConfirmLoading(true);
      try {
        const { data: resData } = await ajax(
          Object.assign({}, apis.linkTenantUser, {
            data: {
              id: data.id,
              tenantUserId
            }
          })
        );
        if (resData.code !== 0) {
          throw new Error(resData.msg || formatMessage({ id: 'employee.linkFailed' }));
        }
        close();
        onSuccess && onSuccess();
      } catch (e) {
        message.error(e.message || formatMessage({ id: 'employee.linkFailed' }));
      } finally {
        setConfirmLoading(false);
      }
    };

    return (
      <>
        <Button
          {...props}
          onClick={() => {
            setValue(null);
            setOpen(true);
          }}
        >
          {formatMessage({ id: 'employee.linkUser' })}
        </Button>
        <Modal title={formatMessage({ id: 'employee.linkUser' })} open={open} onCancel={close} onOk={handleOk} confirmLoading={confirmLoading} width={880} destroyOnHidden>
          <TenantUserSelect.Field single value={value} onChange={setValue} userStatus="open" orgApi={apis.orgList} userApi={apis.userList} height={480} showSelectedFooter />
        </Modal>
      </>
    );
  })
);

export default LinkUserAction;
