import { createWithRemoteLoader } from '@kne/remote-loader';
import AppChildrenRouter from '@kne/app-children-router';
import Layout from './Layout';

const TenantPortal = createWithRemoteLoader({
  modules: []
})(({ baseUrl }) => {
  return (
    <AppChildrenRouter
      errorPage
      notFoundPage
      baseUrl={baseUrl}
      element={<Layout baseUrl={baseUrl} />}
      list={
        [
          /*{
          index: true,
          loader: () => import('./Home')
        }*/
        ]
      }
    />
  );
});

export default TenantPortal;
