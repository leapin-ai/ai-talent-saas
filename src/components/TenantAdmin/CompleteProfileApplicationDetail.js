import { useCallback, useMemo, useState } from 'react';
import { Button, Flex, message, Modal, Space, Spin, Tag, Typography } from 'antd';
import { Page } from '@kne/system-layout';
import Fetch from '@kne/react-fetch';
import { createWithRemoteLoader } from '@kne/remote-loader';
import { useNavigate, useParams } from 'react-router-dom';
import { useIntl } from '@kne/react-intl';
import dayjs from 'dayjs';
import TalentProfile from '@components/TalentProfile';
import withLocale from './withLocale';

const STATUS_LABEL_IDS = {
  pending: 'tenantAdmin.assessmentStatusPending',
  interviewing: 'tenantAdmin.assessmentStatusInterviewing',
  generating: 'tenantAdmin.assessmentStatusGenerating',
  submitted: 'tenantAdmin.assessmentStatusSubmitted',
  approved: 'tenantAdmin.assessmentStatusApproved',
  closed: 'tenantAdmin.assessmentStatusClosed'
};

const STATUS_COLORS = {
  pending: 'default',
  interviewing: 'processing',
  generating: 'warning',
  submitted: 'blue',
  approved: 'success',
  closed: 'default'
};

const CompleteProfileApplicationDetail = createWithRemoteLoader({
  modules: ['components-core:Global@usePreset']
})(
  withLocale(({ remoteModules, baseUrl }) => {
    const [usePreset] = remoteModules;
    const { apis, ajax } = usePreset();
    const { id } = useParams();
    const navigate = useNavigate();
    const { formatMessage } = useIntl();
    const [reloadKey, setReloadKey] = useState(0);
    const [acting, setActing] = useState('');

    const employeeApis = useMemo(
      () =>
        Object.assign({}, apis.talentSaas.tenant.employee, {
          positionList: apis.talentSaas.tenant.position.list,
          parseResume: apis.talentSaas.tenant.resume.parseFileId,
          orgList: apis.tenant.orgList
        }),
      [apis]
    );

    const runAction = useCallback(
      async (api, successId) => {
        setActing(successId);
        try {
          const { data: resData } = await ajax(Object.assign({}, api, { data: { id } }));
          if (resData.code !== 0) {
            throw new Error(resData.msg || formatMessage({ id: 'tenantAdmin.completeProfileActionFailed' }));
          }
          message.success(formatMessage({ id: successId }));
          setReloadKey(key => key + 1);
        } catch (e) {
          message.error(e.message || formatMessage({ id: 'tenantAdmin.completeProfileActionFailed' }));
        } finally {
          setActing('');
        }
      },
      [ajax, formatMessage, id]
    );

    return (
      <Fetch
        key={reloadKey}
        {...apis.talentSaas.tenant.assessment.getDetail}
        params={{ id }}
        render={({ data, isComplete }) => {
          if (!isComplete) {
            return (
              <Page title={formatMessage({ id: 'tenantAdmin.completeProfileApplicationDetail' })} back>
                <Flex justify="center" style={{ padding: 80 }}>
                  <Spin size="large" />
                </Flex>
              </Page>
            );
          }

          const canReview = data?.status === 'submitted';
          const displayName = data?.profileDetail?.name || data?.reviewData?.employee?.name || data?.name || formatMessage({ id: 'tenantAdmin.completeProfileApplicationDetail' });
          const statusLabel = formatMessage({ id: STATUS_LABEL_IDS[data?.status] || 'tenantAdmin.assessmentInterviewStatusUnknown' });
          const metaParts = [
            data?.projectName ? `${formatMessage({ id: 'tenantAdmin.assessmentInterviewProject' })}：${data.projectName}` : null,
            data?.updatedAt ? `${formatMessage({ id: 'tenantAdmin.completeProfileUpdatedAt' })}：${dayjs(data.updatedAt).format('YYYY-MM-DD HH:mm')}` : null
          ].filter(Boolean);

          return (
            <Page
              title={
                <Flex align="center" gap={8} wrap="wrap">
                  <span>{displayName}</span>
                  <Tag color={STATUS_COLORS[data?.status] || 'default'} style={{ marginInlineEnd: 0 }}>
                    {statusLabel}
                  </Tag>
                </Flex>
              }
              back
              extra={
                <Space wrap>
                  {data?.employeeId ? (
                    <Button type="link" onClick={() => navigate(`${baseUrl}/profile/${data.employeeId}`)}>
                      {formatMessage({ id: 'tenantAdmin.completeProfileViewEmployee' })}
                    </Button>
                  ) : null}
                  {canReview ? (
                    <>
                      <Button
                        type="primary"
                        loading={acting === 'tenantAdmin.completeProfileApproveSuccess'}
                        onClick={() => {
                          Modal.confirm({
                            title: formatMessage({ id: 'tenantAdmin.completeProfileApproveConfirm' }),
                            onOk: () => runAction(apis.talentSaas.tenant.assessment.approve, 'tenantAdmin.completeProfileApproveSuccess')
                          });
                        }}
                      >
                        {formatMessage({ id: 'tenantAdmin.completeProfileApprove' })}
                      </Button>
                      <Button
                        danger
                        loading={acting === 'tenantAdmin.completeProfileRejectSuccess'}
                        onClick={() => {
                          Modal.confirm({
                            title: formatMessage({ id: 'tenantAdmin.completeProfileRejectConfirm' }),
                            onOk: () => runAction(apis.talentSaas.tenant.assessment.reject, 'tenantAdmin.completeProfileRejectSuccess')
                          });
                        }}
                      >
                        {formatMessage({ id: 'tenantAdmin.completeProfileReject' })}
                      </Button>
                    </>
                  ) : null}
                </Space>
              }
            >
              <Flex vertical gap={16}>
                {metaParts.length > 0 ? <Typography.Text type="secondary">{metaParts.join(' · ')}</Typography.Text> : null}
                {data?.profileDetail ? <TalentProfile baseUrl={baseUrl} apis={employeeApis} data={data.profileDetail} readOnly /> : null}
              </Flex>
            </Page>
          );
        }}
      />
    );
  })
);

export default CompleteProfileApplicationDetail;
