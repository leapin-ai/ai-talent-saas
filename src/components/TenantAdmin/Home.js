import { useState, useCallback, useEffect } from 'react';
import { Page } from '@kne/system-layout';
import { Button, Empty, Space } from 'antd';
import { useNavigate } from 'react-router-dom';
import { createWithRemoteLoader } from '@kne/remote-loader';
import Fetch from '@kne/react-fetch';
import TalentProfile from '@components/TalentProfile';
import AssessmentGeneratingBadge from './AssessmentGeneratingBadge';
import AssessmentRegenerateButton from './AssessmentRegenerateButton';
import withLocale from './withLocale';
import { useIntl } from '@kne/react-intl';
import { TENANT_ADMIN_PERMISSIONS, TALENT_PROFILE_CARD_PERMISSIONS } from './constants';

const SyncAssessmentStatus = ({ status, onChange }) => {
  useEffect(() => {
    onChange(status ?? null);
  }, [status, onChange]);
  return null;
};

const Home = createWithRemoteLoader({
  modules: ['components-core:Global@usePreset', 'components-core:Permissions']
})(
  withLocale(({ remoteModules, baseUrl }) => {
    const { formatMessage } = useIntl();
    const [usePreset, Permissions] = remoteModules;
    const { apis } = usePreset();
    const navigate = useNavigate();
    const [hasProfile, setHasProfile] = useState(false);
    const [assessmentStatus, setAssessmentStatus] = useState(null);
    const [assessmentReloadKey, setAssessmentReloadKey] = useState(0);
    const onData = useCallback(data => setHasProfile(!!data), []);
    const onAssessmentStatusChange = useCallback(status => setAssessmentStatus(status), []);
    const employeeApis = Object.assign({}, apis.talentSaas.tenant.employee, {
      positionList: apis.talentSaas.tenant.position.list,
      parseResume: apis.talentSaas.tenant.resume.parseFileId,
      orgList: apis.tenant.orgList
    });

    const showCompleteProfile = hasProfile && assessmentStatus !== 'generating';

    const completeProfileButton = (
      <Permissions request={TENANT_ADMIN_PERMISSIONS.homeCompleteProfile}>
        <Button type="primary" onClick={() => navigate(`${baseUrl}/complete-profile`)}>
          {formatMessage({ id: 'tenantAdmin.completeMyProfile' })}
        </Button>
      </Permissions>
    );

    return (
      <Permissions request={TENANT_ADMIN_PERMISSIONS.home} type="error">
        <Page
          title={formatMessage({ id: 'tenantAdmin.myEmployeeProfile' })}
          extra={
            <Space wrap>
              <Fetch
                key={assessmentReloadKey}
                {...apis.talentSaas.tenant.assessment.detail}
                error={null}
                render={({ data }) => (
                  <>
                    <SyncAssessmentStatus status={data?.status} onChange={onAssessmentStatusChange} />
                    {!data ? null : data.status === 'generating' ? (
                      <Space wrap>
                        <AssessmentGeneratingBadge />
                        <AssessmentRegenerateButton baseUrl={baseUrl} onRestarted={() => setAssessmentReloadKey(k => k + 1)} />
                      </Space>
                    ) : data.status === 'interviewing' ? (
                      <Permissions request={TENANT_ADMIN_PERMISSIONS.homeCompleteProfile}>
                        <Button type="primary" onClick={() => navigate(`${baseUrl}/complete-profile?step=interview`)}>
                          {formatMessage({ id: 'tenantAdmin.assessmentContinueInterview' })}
                        </Button>
                      </Permissions>
                    ) : null}
                  </>
                )}
              />
              {showCompleteProfile ? completeProfileButton : null}
            </Space>
          }
        >
          <TalentProfile
            self
            readOnly
            baseUrl={baseUrl}
            apis={employeeApis}
            onData={onData}
            permissions={TALENT_PROFILE_CARD_PERMISSIONS}
            empty={
              <Empty description={formatMessage({ id: 'talentProfile.NoLinkedEmployee' })} style={{ padding: '80px 0' }}>
                {assessmentStatus === 'generating' ? null : completeProfileButton}
              </Empty>
            }
          />
        </Page>
      </Permissions>
    );
  })
);

export default Home;
