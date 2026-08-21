import AppChildrenRouter from '@kne/app-children-router';
import { Page } from '@kne/system-layout';
import style from './style.module.scss';

const TenantHiring = ({ baseUrl }) => {
  return (
    <AppChildrenRouter
      list={[
        {
          index: true,
          title: 'Hiring',
          element: <Page>xxx</Page>
        }
      ]}
    />
  );
};

export default TenantHiring;
