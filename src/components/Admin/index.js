import AppChildrenRouter from '@kne/app-children-router';
import { createWithRemoteLoader } from '@kne/remote-loader';

const Admin = createWithRemoteLoader({
  modules: ['components-core:Global@usePreset']
})(({ remoteModules, baseUrl, ...props }) => {
  const [usePreset] = remoteModules;
  const { apis } = usePreset();
  return (
    <AppChildrenRouter
      {...props}
      baseUrl={baseUrl}
      list={
        [
          /*{
          path: 'path',
          title: '模块名',
          loader: () => import('@components/组件名'),
          elementProps: {
            //组件参数
          }
        }*/
        ]
      }
    />
  );
});

export default Admin;
