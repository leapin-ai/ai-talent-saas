import { useState, useCallback } from 'react';
import { Page } from '@kne/system-layout';
import { Button, Empty } from 'antd';
import { useNavigate } from 'react-router-dom';
import { createWithRemoteLoader } from '@kne/remote-loader';
import TalentProfile from '@components/TalentProfile';
import withLocale from './withLocale';
import { useIntl } from '@kne/react-intl';

const Home = createWithRemoteLoader({
  modules: ['components-core:Global@usePreset']
})(
  withLocale(({ remoteModules, baseUrl }) => {
    const { formatMessage } = useIntl();
    const [usePreset] = remoteModules;
    const { apis } = usePreset();
    const navigate = useNavigate();
    const [hasProfile, setHasProfile] = useState(false);
    const onData = useCallback(data => setHasProfile(!!data), []);
    const employeeApis = Object.assign({}, apis.talentSaas.tenant.employee, {
      positionList: apis.talentSaas.tenant.position.list,
      parseResume: apis.talentSaas.tenant.resume.parseFileId,
      orgList: apis.tenant.orgList
    });

    const completeProfileButton = (
      <Button type="primary" onClick={() => navigate(`${baseUrl}/complete-profile`)}>
        {formatMessage({ id: 'tenantAdmin.completeMyProfile' })}
      </Button>
    );

    return (
      <Page title={formatMessage({ id: 'tenantAdmin.myEmployeeProfile' })} extra={hasProfile ? completeProfileButton : null}>
        <TalentProfile
          self
          readOnly
          baseUrl={baseUrl}
          apis={employeeApis}
          onData={onData}
          empty={
            <Empty description={formatMessage({ id: 'talentProfile.NoLinkedEmployee' })} style={{ padding: '80px 0' }}>
              {completeProfileButton}
            </Empty>
          }
        />
      </Page>
    );
  })
);

export default Home;
