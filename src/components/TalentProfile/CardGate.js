import { createWithRemoteLoader } from '@kne/remote-loader';

/** request 未传则直接展示（默认全开）；传入系统权限后无权限则不渲染 */
const CardGate = createWithRemoteLoader({
  modules: ['components-core:Permissions@usePermissionsPass']
})(({ remoteModules, request, children }) => {
  const [usePermissionsPass] = remoteModules;
  const isPass = usePermissionsPass({ request: request || [] });
  if (!request) {
    return children;
  }
  return isPass ? children : null;
});

export default CardGate;
