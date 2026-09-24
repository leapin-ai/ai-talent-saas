import { useCallback } from 'react';
import { Page } from '@kne/system-layout';
import { Empty } from 'antd';
import { createWithRemoteLoader } from '@kne/remote-loader';
import TalentProfile from '@components/TalentProfile';
import withLocale from './withLocale';
import { useIntl } from '@kne/react-intl';
import { TENANT_ADMIN_PERMISSIONS, TALENT_PROFILE_CARD_PERMISSIONS } from './constants';

const Home = createWithRemoteLoader({
  modules: ['components-core:Global@usePreset', 'components-core:Permissions']
})(
  withLocale(({ remoteModules, baseUrl }) => {
    const { formatMessage } = useIntl();
    const [usePreset, Permissions] = remoteModules;
    const { apis } = usePreset();
    const onData = useCallback(() => {}, []);
    const employeeApis = Object.assign({}, apis.talentSaas.tenant.employee, {
      positionList: apis.talentSaas.tenant.position.list,
      parseResume: apis.talentSaas.tenant.resume.parseFileId,
      orgList: apis.tenant.orgList
    });

    return (
      <Permissions request={TENANT_ADMIN_PERMISSIONS.home} type="error">
        <Page title={formatMessage({ id: 'tenantAdmin.myEmployeeProfile' })}>
          <TalentProfile
            self
            readOnly
            baseUrl={baseUrl}
            apis={employeeApis}
            onData={onData}
            permissions={TALENT_PROFILE_CARD_PERMISSIONS}
            empty={<Empty description={formatMessage({ id: 'talentProfile.NoLinkedEmployee' })} style={{ padding: '80px 0' }} />}
          />
        </Page>
      </Permissions>
    );
  })
);

export default Home;
