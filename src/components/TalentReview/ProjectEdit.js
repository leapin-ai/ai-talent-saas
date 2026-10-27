import { useParams } from 'react-router-dom';
import { Spin } from 'antd';
import { createWithRemoteLoader } from '@kne/remote-loader';
import Fetch from '@kne/react-fetch';
import ProjectCreate from './ProjectCreate';

const ProjectEdit = createWithRemoteLoader({
  modules: ['components-core:Global@usePreset']
})(({ remoteModules, ...props }) => {
  const [usePreset] = remoteModules;
  const { apis } = usePreset();
  const { id } = useParams();
  return <Fetch {...apis.talentSaas.tenant.talentReview.projectDetail} params={{ id }} loading={<Spin style={{ display: 'block', padding: 80 }} />} render={({ data }) => <ProjectCreate {...props} project={data} />} />;
});

export default ProjectEdit;
