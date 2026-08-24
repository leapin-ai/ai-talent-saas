import { useState } from 'react';
import { Button, message } from 'antd';
import { useNavigate } from 'react-router-dom';
import { createWithRemoteLoader } from '@kne/remote-loader';
import { useIntl } from '@kne/react-intl';

const AssessmentRegenerateButton = createWithRemoteLoader({
  modules: ['components-core:Global@usePreset']
})(({ remoteModules, baseUrl = '/tenant', className, block = false, size = 'middle', onRestarted }) => {
  const [usePreset] = remoteModules;
  const { apis, ajax } = usePreset();
  const navigate = useNavigate();
  const { formatMessage } = useIntl();
  const [loading, setLoading] = useState(false);

  const handleClick = async () => {
    setLoading(true);
    try {
      const { data: resData } = await ajax(Object.assign({}, apis.talentSaas.tenant.assessment.restart));
      if (resData.code !== 0) {
        throw new Error(resData.msg || formatMessage({ id: 'tenantAdmin.assessmentRestartFailed' }));
      }
      onRestarted && onRestarted();
      navigate(`${baseUrl}/complete-profile?restart=1`);
    } catch (e) {
      message.error(e.message || formatMessage({ id: 'tenantAdmin.assessmentRestartFailed' }));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button className={className} block={block} size={size} loading={loading} onClick={handleClick}>
      {formatMessage({ id: 'tenantAdmin.assessmentRegenerate' })}
    </Button>
  );
});

export default AssessmentRegenerateButton;
