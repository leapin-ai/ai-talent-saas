import { createWithRemoteLoader } from '@kne/remote-loader';
import withLocale from '../withLocale';
import { useIntl } from '@kne/react-intl';

const UnlinkUserAction = createWithRemoteLoader({
  modules: ['components-core:Global@usePreset', 'components-core:ConfirmButton']
})(
  withLocale(({ remoteModules, data, apis, onSuccess, ...props }) => {
    const { formatMessage } = useIntl();
    const [usePreset, ConfirmButton] = remoteModules;
    const { ajax } = usePreset();

    return (
      <ConfirmButton
        {...props}
        message={formatMessage({ id: 'employee.confirmUnlinkUser' })}
        isDelete={false}
        onClick={async () => {
          const { data: resData } = await ajax(
            Object.assign({}, apis.unlinkTenantUser, {
              data: { id: data.id }
            })
          );
          if (resData.code !== 0) {
            throw new Error(resData.msg || formatMessage({ id: 'employee.unlinkFailed' }));
          }
          onSuccess && onSuccess();
        }}
      >
        {formatMessage({ id: 'employee.unlinkUser' })}
      </ConfirmButton>
    );
  })
);

export default UnlinkUserAction;
