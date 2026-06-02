import { createWithRemoteLoader } from '@kne/remote-loader';

const UnlinkUserAction = createWithRemoteLoader({
  modules: ['components-core:Global@usePreset', 'components-core:ConfirmButton']
})(({ remoteModules, data, apis, onSuccess, ...props }) => {
  const [usePreset, ConfirmButton] = remoteModules;
  const { ajax } = usePreset();

  return (
    <ConfirmButton
      {...props}
      message="确认取消关联用户？"
      isDelete={false}
      onClick={async () => {
        const { data: resData } = await ajax(
          Object.assign({}, apis.unlinkTenantUser, {
            data: { id: data.id }
          })
        );
        if (resData.code !== 0) {
          throw new Error(resData.msg || '取消关联失败');
        }
        onSuccess && onSuccess();
      }}
    >
      取消关联用户
    </ConfirmButton>
  );
});

export default UnlinkUserAction;
