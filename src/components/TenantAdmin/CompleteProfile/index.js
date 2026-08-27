import { useMemo, useState, useCallback, useEffect, useRef } from 'react';
import { Alert, Button, Flex, message, Spin } from 'antd';
import { Page } from '@kne/system-layout';
import { ButtonFooter } from '@kne/button-group';
import '@kne/button-group/dist/index.css';
import { createWithRemoteLoader } from '@kne/remote-loader';
import { useNavigate, useSearchParams } from 'react-router-dom';
import withLocale from '../withLocale';
import { useIntl } from '@kne/react-intl';
import Stepper from './Stepper';
import UploadStep from './UploadStep';
import ReviewStep from './ReviewStep';
import ProjectsStep from './ProjectsStep';
import InterviewStep from './InterviewStep';
import { hasPrefilledReviewData, hasSavedProfileData, hasSavedProjectsData, mapEmployeeToCompleteProfileData, mergeCompleteProfilePrefill, normalizeReviewProfileData, splitAssessmentProfileData } from './profileDataUtils';
import style from './style.module.scss';

const hasContactValue = value => {
  if (value == null || value === '') return false;
  if (typeof value === 'string') return value.trim().length > 0;
  if (typeof value === 'object') {
    const number = value.number ?? value.phone ?? value.value;
    return number != null && String(number).trim().length > 0;
  }
  return true;
};

const CompleteProfile = createWithRemoteLoader({
  modules: ['components-core:Global@usePreset', 'components-core:FormInfo', 'components-core:FileList@DragAreaOuter', 'components-core:FileList@UploadTips', 'components-core:FileList@UploadButton', 'components-core:File@List']
})(
  withLocale(({ remoteModules, baseUrl = '/tenant' }) => {
    const { formatMessage } = useIntl();
    if (!Array.isArray(remoteModules) || remoteModules.length < 6) {
      return null;
    }
    const [usePreset, FormInfo, DragAreaOuter, UploadTips, UploadButton, FileList] = remoteModules;
    if (typeof usePreset !== 'function' || !FormInfo || !DragAreaOuter || !UploadTips || !UploadButton || !FileList) {
      return null;
    }
    const { Form, SubmitButton } = FormInfo;
    const { apis, ajax } = usePreset();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const [current, setCurrent] = useState(() => (searchParams.get('step') === 'interview' ? 3 : 0));
    const [uploadState, setUploadState] = useState({ resumes: [], parsed: null });
    const [reviewData, setReviewData] = useState(null);
    const [projectsData, setProjectsData] = useState(null);
    const [projectsEditing, setProjectsEditing] = useState(false);
    const [interviewFinished, setInterviewFinished] = useState(false);
    const [prefillLoaded, setPrefillLoaded] = useState(false);
    const [initialLoading, setInitialLoading] = useState(true);
    const prefillAppliedRef = useRef(false);
    const handleInterviewComplete = useCallback(
      event => {
        if (event?.directFinish) {
          message.success(formatMessage({ id: 'tenantAdmin.completeFinishTip' }));
          navigate(baseUrl || '/tenant');
          return;
        }
        setInterviewFinished(true);
      },
      [baseUrl, formatMessage, navigate]
    );

    useEffect(() => {
      let cancelled = false;
      const isRestart = searchParams.get('restart') === '1';

      (async () => {
        try {
          const [assessmentResult, employeeResult] = await Promise.all([ajax(Object.assign({}, apis.talentSaas.tenant.assessment.detail)), ajax(Object.assign({}, apis.talentSaas.tenant.employee.myDetail))]);
          if (cancelled) {
            return;
          }

          const assessmentRes = assessmentResult?.data;
          const employeeRes = employeeResult?.data;
          const employeeMapped = employeeRes?.code === 0 && employeeRes.data ? mapEmployeeToCompleteProfileData(employeeRes.data) : null;
          const savedProfileData = assessmentRes?.code === 0 ? assessmentRes.data?.profileData : null;
          const assessmentMapped = savedProfileData && hasSavedProfileData(savedProfileData) ? splitAssessmentProfileData(savedProfileData) : null;

          const { review, projects } = mergeCompleteProfilePrefill(employeeMapped, assessmentMapped);
          const savedResumes = Array.isArray(savedProfileData?.resumes) ? savedProfileData.resumes : [];
          const savedResumeParsed = savedProfileData?.resumeParsed && typeof savedProfileData.resumeParsed === 'object' ? savedProfileData.resumeParsed : null;
          const hasPrefill = hasPrefilledReviewData(review) || hasSavedProjectsData(projects?.projects) || savedResumes.length > 0 || !!savedResumeParsed;
          if (!hasPrefill) {
            return;
          }
          if (prefillAppliedRef.current && !isRestart) {
            return;
          }
          prefillAppliedRef.current = true;

          setUploadState(prev => {
            if (Array.isArray(prev.resumes) && prev.resumes.length > 0) {
              return prev;
            }
            return {
              resumes: savedResumes,
              parsed: savedResumeParsed || review
            };
          });
          setReviewData(prev => prev || review);
          setProjectsData(prev => prev || projects);
          setPrefillLoaded(true);

          if (isRestart) {
            setInterviewFinished(false);
            setCurrent(0);
            message.success(formatMessage({ id: 'tenantAdmin.assessmentRestartPrefilled' }));
          }
        } catch (e) {
          if (!cancelled) {
            message.error(e.message || formatMessage({ id: 'tenantAdmin.assessmentRestartFailed' }));
          }
        } finally {
          if (!cancelled) {
            setInitialLoading(false);
          }
        }
      })();

      return () => {
        cancelled = true;
      };
    }, [ajax, apis, formatMessage, searchParams]);

    const employeeApis = useMemo(
      () =>
        Object.assign({}, apis.talentSaas.tenant.employee, {
          positionList: apis.talentSaas.tenant.position.list,
          parseResume: apis.talentSaas.tenant.resume.parseFileId,
          orgList: apis.tenant.orgList
        }),
      [apis]
    );

    const stepTitles = [
      formatMessage({ id: 'tenantAdmin.completeStepUpload' }),
      formatMessage({ id: 'tenantAdmin.completeStepReview' }),
      formatMessage({ id: 'tenantAdmin.completeStepProjects' }),
      formatMessage({ id: 'tenantAdmin.completeStepInterview' })
    ];

    const pageTitle = [
      formatMessage({ id: 'tenantAdmin.completeTitleUpload' }),
      formatMessage({ id: 'tenantAdmin.completeTitleReview' }),
      formatMessage({ id: 'tenantAdmin.completeTitleProjects' }),
      formatMessage({ id: 'tenantAdmin.completeTitleInterview' })
    ][current];

    const goHome = () => navigate(`${baseUrl}/home`);

    const skip = () => {
      if (current >= stepTitles.length - 1) {
        goHome();
        return;
      }
      setCurrent(c => c + 1);
    };

    const Footer = ({ primary, showSkip = true }) => (
      <ButtonFooter className={style.footer} placement="bottomEnd">
        <Flex className={style['footer-actions']} gap={16} justify="flex-end" wrap="wrap">
          {showSkip ? (
            <Button size="middle" className={style['skip-btn']} onClick={skip}>
              {formatMessage({ id: 'tenantAdmin.completeSkip' })}
            </Button>
          ) : null}
          {primary}
        </Flex>
      </ButtonFooter>
    );

    const activeReviewData = normalizeReviewProfileData(reviewData || uploadState.parsed || {});
    const activeProjectsData = projectsData || splitAssessmentProfileData(uploadState.parsed || {}).projects;
    const canContinueUpload = (Array.isArray(uploadState.resumes) && uploadState.resumes.length > 0) || hasPrefilledReviewData(uploadState.parsed) || hasPrefilledReviewData(reviewData);

    if (initialLoading) {
      return (
        <Page title={pageTitle} back toolbar={false}>
          <Flex align="center" justify="center" className={style['initial-loading']}>
            <Spin size="large" />
          </Flex>
        </Page>
      );
    }

    return (
      <Page title={pageTitle} back toolbar={false}>
        <div className={style['complete-profile']}>
          <Stepper items={stepTitles} current={current} />

          <div className={style.content}>
            <div className={style['content-inner']}>
              {current === 0 && (
                <div className={style['step-panel']}>
                  <div className={style['step-body']}>
                    {prefillLoaded ? <Alert type="info" showIcon message={formatMessage({ id: 'tenantAdmin.assessmentRestartPrefilledHint' })} style={{ marginBottom: 16 }} /> : null}
                    <UploadStep usePreset={usePreset} DragAreaOuter={DragAreaOuter} UploadTips={UploadTips} UploadButton={UploadButton} FileList={FileList} ajax={ajax} apis={employeeApis} value={uploadState} onChange={setUploadState} />
                  </div>
                  <Footer
                    primary={
                      <Button
                        type="primary"
                        size="middle"
                        className={style['primary-btn']}
                        onClick={() => {
                          if (!canContinueUpload) {
                            message.warning(formatMessage({ id: 'tenantAdmin.completeUploadRequired' }));
                            return;
                          }
                          setReviewData(prev => {
                            if (prev) return prev;
                            return normalizeReviewProfileData(uploadState.parsed || {});
                          });
                          setCurrent(1);
                        }}
                      >
                        {formatMessage({ id: 'tenantAdmin.completeUploadContinue' })}
                      </Button>
                    }
                  />
                </div>
              )}

              {current === 1 && (
                <div className={style['step-panel']}>
                  <Form
                    className={style['step-form']}
                    data={activeReviewData}
                    bordered
                    onSubmit={data => {
                      if (!hasContactValue(data?.phone) && !hasContactValue(data?.email)) {
                        message.error(formatMessage({ id: 'tenantAdmin.completePhoneOrEmailRequired' }));
                        return;
                      }
                      setReviewData(normalizeReviewProfileData(data));
                      setCurrent(2);
                    }}
                  >
                    <div className={style['step-body']}>
                      <ReviewStep FormInfo={FormInfo} positionListApi={apis.talentSaas.tenant.position.list} />
                    </div>
                    <Footer
                      showSkip={false}
                      primary={
                        <SubmitButton type="primary" size="middle" className={style['primary-btn']}>
                          {formatMessage({ id: 'tenantAdmin.completeConfirmContinue' })}
                        </SubmitButton>
                      }
                    />
                  </Form>
                </div>
              )}

              {current === 2 && (
                <div className={style['step-panel']}>
                  <div className={style['step-body']}>
                    <ProjectsStep FormInfo={FormInfo} value={activeProjectsData?.projects || []} onChange={projects => setProjectsData({ projects })} onEditingChange={setProjectsEditing} />
                  </div>
                  <Footer
                    showSkip={false}
                    primary={
                      <Flex gap={16} wrap="wrap" justify="flex-end">
                        <Button
                          size="middle"
                          className={style['skip-btn']}
                          onClick={() => {
                            if (projectsEditing) {
                              message.warning(formatMessage({ id: 'tenantAdmin.completeFinishEditFirst' }));
                              return;
                            }
                            setCurrent(1);
                          }}
                        >
                          {formatMessage({ id: 'tenantAdmin.completeBack' })}
                        </Button>
                        <Button
                          type="primary"
                          size="middle"
                          className={style['primary-btn']}
                          onClick={() => {
                            if (projectsEditing) {
                              message.warning(formatMessage({ id: 'tenantAdmin.completeFinishEditFirst' }));
                              return;
                            }
                            if (!projectsData && !hasSavedProjectsData(activeProjectsData?.projects)) {
                              setProjectsData({ projects: [] });
                            }
                            setCurrent(3);
                          }}
                        >
                          {formatMessage({ id: 'tenantAdmin.completeSaveContinue' })}
                        </Button>
                      </Flex>
                    }
                  />
                </div>
              )}

              {current === 3 && (
                <div className={style['step-panel']}>
                  <div className={style['step-body']}>
                    <InterviewStep
                      profilePayload={{
                        ...(reviewData || uploadState.parsed || {}),
                        projects: activeProjectsData?.projects || [],
                        resumes: Array.isArray(uploadState.resumes) ? uploadState.resumes : [],
                        resumeParsed:
                          uploadState.parsed && typeof uploadState.parsed === 'object' && (uploadState.parsed.fileId || Array.isArray(uploadState.parsed.educationList) || Array.isArray(uploadState.parsed.workList))
                            ? uploadState.parsed
                            : null
                      }}
                      onInterviewComplete={handleInterviewComplete}
                    />
                  </div>
                  {interviewFinished ? (
                    <Footer
                      showSkip={false}
                      primary={
                        <Button
                          type="primary"
                          size="middle"
                          className={style['primary-btn']}
                          onClick={() => {
                            message.success(formatMessage({ id: 'tenantAdmin.completeFinishTip' }));
                            goHome();
                          }}
                        >
                          {formatMessage({ id: 'tenantAdmin.completeFinish' })}
                        </Button>
                      }
                    />
                  ) : null}
                </div>
              )}
            </div>
          </div>
        </div>
      </Page>
    );
  })
);

export default CompleteProfile;
