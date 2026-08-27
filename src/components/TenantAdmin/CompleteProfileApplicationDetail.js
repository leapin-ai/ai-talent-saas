import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button, Flex, message, Modal, Space, Spin, Tag, Typography } from 'antd';
import { Page } from '@kne/system-layout';
import Fetch from '@kne/react-fetch';
import { createWithRemoteLoader } from '@kne/remote-loader';
import { useNavigate, useParams } from 'react-router-dom';
import { useIntl } from '@kne/react-intl';
import dayjs from 'dayjs';
import TalentProfile from '@components/TalentProfile';
import { toReviewData } from '@components/AssessmentGenerateTask/assessmentReviewUtils';
import { ensurePositionEnums, fromIntentionSelectValue } from '@components/TalentProfile/intentionPositionUtils';
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

const ApplicationProfileEditor = ({ baseUrl, employeeApis, ajax, positionDetailApi, saveReviewApi, assessmentId, initialDetail, canEdit }) => {
  const { formatMessage } = useIntl();
  const [profileDetail, setProfileDetail] = useState(initialDetail || null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setProfileDetail(initialDetail || null);
  }, [initialDetail]);

  const persist = useCallback(
    async nextDetail => {
      if (!canEdit || !saveReviewApi) {
        return nextDetail;
      }
      setSaving(true);
      try {
        const reviewData = toReviewData(nextDetail);
        if (Array.isArray(reviewData.profile?.intentionPosition)) {
          reviewData.profile.intentionPosition = fromIntentionSelectValue(reviewData.profile.intentionPosition);
        }
        const { data: resData } = await ajax(
          Object.assign({}, saveReviewApi, {
            data: {
              id: assessmentId,
              reviewData
            }
          })
        );
        if (resData.code !== 0) {
          throw new Error(resData.msg || formatMessage({ id: 'tenantAdmin.completeProfileActionFailed' }));
        }
        const refreshed = resData.data?.profileDetail || nextDetail;
        setProfileDetail(refreshed);
        message.success(formatMessage({ id: 'tenantAdmin.completeProfileSaveSuccess' }));
        return refreshed;
      } catch (e) {
        message.error(e.message || formatMessage({ id: 'tenantAdmin.completeProfileActionFailed' }));
        throw e;
      } finally {
        setSaving(false);
      }
    },
    [ajax, assessmentId, canEdit, formatMessage, saveReviewApi]
  );

  const saveEmployee = useCallback(
    async employeeData => {
      const next = Object.assign({}, profileDetail, employeeData, {
        id: profileDetail.id,
        options: Object.assign({}, profileDetail.options || {}, employeeData.options || {}),
        profile: profileDetail.profile,
        orgEnums: profileDetail.orgEnums,
        positionEnums: profileDetail.positionEnums
      });
      setProfileDetail(next);
      await persist(next);
    },
    [persist, profileDetail]
  );

  const saveProfile = useCallback(
    async profilePatch => {
      const patch = Object.assign({}, profilePatch);
      if (Object.prototype.hasOwnProperty.call(patch, 'intentionPosition')) {
        patch.intentionPosition = fromIntentionSelectValue(patch.intentionPosition);
      }
      let nextEnums = profileDetail?.positionEnums;
      if (Object.prototype.hasOwnProperty.call(patch, 'intentionPosition')) {
        nextEnums = await ensurePositionEnums({
          ajax,
          positionDetailApi,
          refs: patch.intentionPosition,
          existingEnums: profileDetail?.positionEnums
        });
      }
      const next = Object.assign({}, profileDetail, {
        positionEnums: nextEnums || profileDetail.positionEnums,
        profile: Object.assign({}, profileDetail.profile || {}, patch, {
          options: Object.assign({}, profileDetail.profile?.options || {}, patch.options || {})
        })
      });
      setProfileDetail(next);
      await persist(next);
    },
    [ajax, persist, positionDetailApi, profileDetail]
  );

  const createPerformance = useCallback(async performanceData => {
    setProfileDetail(prev =>
      Object.assign({}, prev, {
        performances: [Object.assign({}, performanceData, { id: `local-${Date.now()}` }), ...(prev.performances || [])]
      })
    );
  }, []);

  const removePerformance = useCallback(async performanceId => {
    setProfileDetail(prev =>
      Object.assign({}, prev, {
        performances: (prev.performances || []).filter(item => item.id !== performanceId)
      })
    );
  }, []);

  const savePerformance = useCallback(async performanceData => {
    setProfileDetail(prev =>
      Object.assign({}, prev, {
        performances: (prev.performances || []).map(item => (item.id === performanceData.id ? Object.assign({}, item, performanceData) : item))
      })
    );
  }, []);

  if (!profileDetail) {
    return null;
  }

  return (
    <div style={{ opacity: saving ? 0.85 : 1 }}>
      <TalentProfile
        baseUrl={baseUrl}
        apis={employeeApis}
        data={profileDetail}
        readOnly={!canEdit}
        saveEmployee={canEdit ? saveEmployee : undefined}
        saveProfile={canEdit ? saveProfile : undefined}
        createPerformance={canEdit ? createPerformance : undefined}
        removePerformance={canEdit ? removePerformance : undefined}
        savePerformance={canEdit ? savePerformance : undefined}
      />
    </div>
  );
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
          const canEdit = data?.status === 'submitted';
          const displayName = data?.profileDetail?.name || data?.reviewData?.employee?.name || data?.name || formatMessage({ id: 'tenantAdmin.completeProfileApplicationDetail' });
          const statusLabel = formatMessage({ id: STATUS_LABEL_IDS[data?.status] || 'tenantAdmin.assessmentInterviewStatusUnknown' });
          const metaParts = [
            data?.projectName ? `${formatMessage({ id: 'tenantAdmin.assessmentInterviewProject' })}：${data.projectName}` : null,
            data?.updatedAt ? `${formatMessage({ id: 'tenantAdmin.completeProfileUpdatedAt' })}：${dayjs(data.updatedAt).format('YYYY-MM-DD HH:mm')}` : null,
            canEdit ? formatMessage({ id: 'tenantAdmin.completeProfileEditableHint' }) : null
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
                {data?.profileDetail ? (
                  <ApplicationProfileEditor
                    baseUrl={baseUrl}
                    employeeApis={employeeApis}
                    ajax={ajax}
                    positionDetailApi={apis.talentSaas.tenant.position.detail}
                    saveReviewApi={apis.talentSaas.tenant.assessment.saveReviewData}
                    assessmentId={id}
                    initialDetail={data.profileDetail}
                    canEdit={canEdit}
                  />
                ) : null}
              </Flex>
            </Page>
          );
        }}
      />
    );
  })
);

export default CompleteProfileApplicationDetail;
