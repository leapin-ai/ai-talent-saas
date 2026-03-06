import AppChildrenRouter from '@kne/app-children-router';
import { createWithRemoteLoader } from '@kne/remote-loader';

const Admin = createWithRemoteLoader({
  modules: []
})(({ baseUrl, ...props }) => {
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
