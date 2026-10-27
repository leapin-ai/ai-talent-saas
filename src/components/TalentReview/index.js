import AppChildrenRouter from '@kne/app-children-router';
import { createWithRemoteLoader } from '@kne/remote-loader';
import { Navigate } from 'react-router-dom';
import withLocale from './withLocale';

const TalentReview = createWithRemoteLoader({
  modules: ['components-core:Permissions']
})(
  withLocale(({ remoteModules, baseUrl, permissions }) => {
    const [Permissions] = remoteModules;
    const guard = (request, element) => (
      <Permissions request={request} type="error">
        {element}
      </Permissions>
    );
    return (
      <AppChildrenRouter
        baseUrl={baseUrl}
        list={[
          { index: true, element: <Navigate to={`${baseUrl}/projects`} replace /> },
          { path: 'projects', title: 'Projects', elementProps: { baseUrl, permissions, guard: element => guard(permissions.talentReview, element) }, loader: () => import('./ProjectList') },
          { path: 'projects/create', title: 'Projects/Create', elementProps: { baseUrl, permissions, guard: element => guard(permissions.talentReviewCreate, element) }, loader: () => import('./ProjectCreate') },
          { path: 'projects/:id', title: 'Projects/Detail', elementProps: { baseUrl, permissions, guard: element => guard(permissions.talentReview, element) }, loader: () => import('./ProjectDetail') },
          { path: 'projects/:id/edit', title: 'Projects/Edit', elementProps: { baseUrl, permissions, guard: element => guard(permissions.talentReviewCreate, element) }, loader: () => import('./ProjectEdit') },
          { path: 'projects/:id/invite', title: 'Projects/Invite', elementProps: { baseUrl, permissions, guard: element => guard(permissions.talentReviewInvite, element) }, loader: () => import('./Invitation') },
          { path: 'projects/:id/report', title: 'Projects/Report', elementProps: { baseUrl, permissions, guard: element => guard(permissions.talentReview, element) }, loader: () => import('./Report') },
          { path: 'participants/report/:id', title: 'Participants/Report', elementProps: { baseUrl, permissions, guard: element => guard(permissions.talentReview, element) }, loader: () => import('./PersonalReport') },
          { path: 'participants', title: 'Participants', elementProps: { baseUrl, permissions, guard: element => guard(permissions.talentReview, element) }, loader: () => import('./Participants') },
          { path: 'models', title: 'Models', elementProps: { baseUrl, permissions, guard: element => guard(permissions.talentReview, element) }, loader: () => import('./Models') },
          { path: 'models/:id', title: 'Models/Detail', elementProps: { baseUrl, permissions, guard: element => guard(permissions.talentReview, element) }, loader: () => import('./ModelDetail') }
        ]}
      />
    );
  })
);

export default TalentReview;
