import { useMemo, useState, useCallback, useEffect } from 'react';
import { Alert, Button, Flex, message, Spin } from 'antd';
import { Page } from '@kne/system-layout';
import { ButtonFooter } from '@kne/button-group';
import '@kne/button-group/dist/index.css';
import { createWithRemoteLoader } from '@kne/remote-loader';
import { useSearchParams } from 'react-router-dom';
import { ResultCard } from '@kne/react-box';
import '@kne/react-box/dist/index.css';
import withLocale from '../withLocale';
import { useIntl } from '@kne/react-intl';
import Stepper from './Stepper';
import UploadStep from './UploadStep';
import ProjectsStep from './ProjectsStep';
import InterviewStep from './InterviewStep';
import { hasPrefilledReviewData, hasSavedProfileData, hasSavedProjectsData, joinLinkedinUrl, normalizeReviewProfileData, splitAssessmentProfileData, stripLinkedinPrefix } from './profileDataUtils';
import style from './style.module.scss';

const stripInviteContact = data => {
  if (!data || typeof data !== 'object') {
    return data;
  }
  const next = { ...data };
  delete next.name;
  delete next.email;
  delete next.phone;
  return next;
};

const CompleteProfile = createWithRemoteLoader({
  modules: ['components-core:Global@usePreset', 'components-core:FormInfo', 'components-core:FileList@DragAreaOuter', 'components-core:FileList@UploadTips', 'components-core:FileList@UploadButton', 'components-core:File@List']
})(
  withLocale(({ remoteModules, code: codeProp }) => {
    const { formatMessage } = useIntl();
    if (!Array.isArray(remoteModules) || remoteModules.length < 6) {
      return null;
    }
    const [usePreset, FormInfo, DragAreaOuter, UploadTips, UploadButton, FileList] = remoteModules;
    if (typeof usePreset !== 'function' || !FormInfo || !DragAreaOuter || !UploadTips || !UploadButton || !FileList) {
      return null;
    }
    const { apis, ajax } = usePreset();
    const [searchParams] = useSearchParams();
    const code = codeProp || searchParams.get('code') || '';
    const [current, setCurrent] = useState(() => (searchParams.get('step') === 'interview' ? 2 : 0));
    const [uploadState, setUploadState] = useState({ resumes: [], parsed: null, linkedin: '' });
    const [reviewData, setReviewData] = useState(null);
    const [projectsData, setProjectsData] = useState(null);
    const [projectsEditing, setProjectsEditing] = useState(false);
    const [interviewFinished, setInterviewFinished] = useState(false);
    const [interviewPhase, setInterviewPhase] = useState('loading');
    const [interviewLocked, setInterviewLocked] = useState(false);
    const [prefillLoaded, setPrefillLoaded] = useState(false);
    const [initialLoading, setInitialLoading] = useState(true);
    const [inviteMeta, setInviteMeta] = useState(null);
    const [bootError, setBootError] = useState('');

    const collectApis = useMemo(() => {
      if (!code) {
        return null;
      }
      const publicApis = apis.talentSaas.public.talentCollectInvite;
      return {
        detail: async () => {
          const { data } = await ajax(
            Object.assign({}, publicApis.detail, {
              params: { code }
            })
          );
          if (data.code !== 0) {
            throw new Error(data.msg || formatMessage({ id: 'tenantAdmin.completeInterviewInviteFailed' }));
          }
          return data.data;
        },
        saveProfile: async profileData => {
          const { data } = await ajax(
            Object.assign({}, publicApis.saveProfile, {
              data: {
                code,
                profileData: stripInviteContact(profileData)
              }
            })
          );
          if (data.code !== 0) {
            throw new Error(data.msg || formatMessage({ id: 'tenantAdmin.completeInterviewSaveFailed' }));
          }
          return data.data;
        },
        ensureInvite: async (options = {}) => {
          const { data } = await ajax(
            Object.assign({}, publicApis.ensureInvite, {
              data: Object.assign({ code }, options)
            })
          );
          if (data.code !== 0) {
            throw new Error(data.msg || formatMessage({ id: 'tenantAdmin.completeInterviewInviteFailed' }));
          }
          return data.data;
        },
        markDone: async ({ interviewId } = {}) => {
          const { data } = await ajax(
            Object.assign({}, publicApis.markDone, {
              data: { code, interviewId }
            })
          );
          if (data.code !== 0) {
            throw new Error(data.msg || formatMessage({ id: 'tenantAdmin.completeInterviewInviteFailed' }));
          }
          return data.data;
        }
      };
    }, [ajax, apis, formatMessage, code]);

    const handleInterviewComplete = useCallback(
      event => {
        // 作答/评价完成：隐藏「上一步」，留在面试间展示完成页（勿 navigate）
        if (event?.stage === 'feedback' || (event?.stage === 'interview' && !event?.directFinish)) {
          setInterviewFinished(true);
          setInterviewLocked(true);
          return;
        }
        setInterviewFinished(true);
        setInterviewLocked(true);
        message.success(formatMessage({ id: 'tenantAdmin.completeFinishTip' }));
      },
      [formatMessage]
    );

    useEffect(() => {
      let cancelled = false;
      (async () => {
        try {
          if (!code) {
            setBootError(formatMessage({ id: 'tenantAdmin.collectInviteInvalid' }));
            return;
          }
          const detail = await collectApis.detail();
          if (cancelled) {
            return;
          }
          setInviteMeta(detail);
          // 邀请已完成：刷新后仍隐藏「上一步」，留在完成页
          if (detail?.status === 'done') {
            setInterviewFinished(true);
            setInterviewLocked(true);
          }
          if (detail?.inviteType === 'manager') {
            setCurrent(0);
            return;
          }
          const savedProfileData = detail?.profileData;
          const inviteContact = {
            name: detail?.name || '',
            email: detail?.email || '',
            phone: detail?.phone || ''
          };
          const assessmentMapped = savedProfileData && hasSavedProfileData(savedProfileData) ? splitAssessmentProfileData(savedProfileData) : null;
          const reviewBase = Object.assign({}, assessmentMapped?.review || {}, inviteContact);
          const projects = assessmentMapped?.projects || { projects: [] };
          const savedResumes = Array.isArray(savedProfileData?.resumes) ? savedProfileData.resumes : [];
          const savedResumeParsed = savedProfileData?.resumeParsed && typeof savedProfileData.resumeParsed === 'object' ? savedProfileData.resumeParsed : null;
          const hasPrefill = hasPrefilledReviewData(reviewBase) || hasSavedProjectsData(projects?.projects) || savedResumes.length > 0 || !!savedResumeParsed;

          setUploadState(prev => {
            if (Array.isArray(prev.resumes) && prev.resumes.length > 0) {
              return {
                ...prev,
                linkedin: stripLinkedinPrefix(reviewBase.linkedin || '')
              };
            }
            return {
              resumes: savedResumes,
              parsed: savedResumeParsed || reviewBase,
              linkedin: stripLinkedinPrefix(reviewBase.linkedin || '')
            };
          });
          setReviewData(prev => prev || normalizeReviewProfileData(reviewBase));
          setProjectsData(prev => prev || projects);
          if (hasPrefill) {
            setPrefillLoaded(true);
          }
          if (detail?.status === 'interviewing' || detail?.status === 'done' || detail?.shorten) {
            setCurrent(2);
          }
          return;
        } catch (e) {
          if (!cancelled) {
            setBootError(e.message || formatMessage({ id: 'tenantAdmin.collectInviteInvalid' }));
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
    }, [collectApis, formatMessage, code]);

    const employeeApis = useMemo(
      () => ({
        parseResume: Object.assign({}, apis.talentSaas.public.talentCollectInvite.parseResume, {
          data: { code }
        }),
        positionList: null,
        orgList: null
      }),
      [apis, code]
    );

    const isManagerCollect = inviteMeta?.inviteType === 'manager';

    const stepTitles = isManagerCollect
      ? [formatMessage({ id: 'tenantAdmin.completeStepInterview' })]
      : [formatMessage({ id: 'tenantAdmin.completeStepUpload' }), formatMessage({ id: 'tenantAdmin.completeStepProjects' }), formatMessage({ id: 'tenantAdmin.completeStepInterview' })];

    const pageTitle = isManagerCollect
      ? formatMessage({ id: 'tenantAdmin.completeTitleInterview' })
      : [formatMessage({ id: 'tenantAdmin.completeTitleUpload' }), formatMessage({ id: 'tenantAdmin.completeTitleProjects' }), formatMessage({ id: 'tenantAdmin.completeTitleInterview' })][current];

    const goHome = () => {
      message.success(formatMessage({ id: 'tenantAdmin.collectInviteDone' }));
    };

    const mergeLinkedinIntoReview = () => {
      const linkedinUrl = joinLinkedinUrl(uploadState.linkedin);
      setReviewData(prev => {
        const base = prev ? Object.assign({}, prev) : Object.assign({}, uploadState.parsed || {});
        Object.assign(base, {
          name: inviteMeta?.name || base.name || '',
          email: inviteMeta?.email || base.email || '',
          phone: inviteMeta?.phone || base.phone || ''
        });
        base.linkedin = linkedinUrl;
        return normalizeReviewProfileData(base);
      });
    };

    const skip = () => {
      if (current >= stepTitles.length - 1) {
        goHome();
        return;
      }
      if (current === 0) {
        mergeLinkedinIntoReview();
      }
      setCurrent(c => c + 1);
    };

    const goPreviousStep = () => {
      if (current <= 0) {
        return;
      }
      if (current === 1 && projectsEditing) {
        message.warning(formatMessage({ id: 'tenantAdmin.completeFinishEditFirst' }));
        return;
      }
      if (current === 2) {
        setInterviewPhase('loading');
        setInterviewLocked(false);
      }
      // 回到职业信息步时，用 reviewData 回填 LinkedIn 后缀，避免未写入 uploadState 时空白
      if (current === 1) {
        setUploadState(prev => ({
          ...prev,
          linkedin: stripLinkedinPrefix(prev.linkedin || reviewData?.linkedin || '')
        }));
      }
      setCurrent(c => Math.max(0, c - 1));
    };

    const Footer = ({ primary, showSkip = true, showPrevious = false, variant }) => {
      const actions = (
        <Flex className={style['footer-actions']} gap={16} justify="flex-end" wrap="wrap" style={{ width: '100%' }}>
          {showSkip ? (
            <Button size="middle" className={style['skip-btn']} onClick={skip}>
              {formatMessage({ id: 'tenantAdmin.completeSkip' })}
            </Button>
          ) : null}
          {showPrevious ? (
            <Button size="middle" className={style['skip-btn']} onClick={goPreviousStep}>
              {formatMessage({ id: 'tenantAdmin.completePrevious' })}
            </Button>
          ) : null}
          {primary}
        </Flex>
      );
      // 面试嵌入阶段不用 ButtonFooter（移动端会 fixed 全页底栏，与会话内提交条冲突）
      if (variant === 'interview-prestart') {
        return (
          <>
            {/* fixed 脱流，占位避免内容被底栏挡住且无法继续滚动 */}
            <div className={style['footer-spacer']} aria-hidden="true" />
            <div className={`${style.footer} ${style['footer-interview-prestart']}`}>{actions}</div>
          </>
        );
      }
      return (
        <ButtonFooter className={style.footer} placement="bottomEnd">
          {actions}
        </ButtonFooter>
      );
    };

    const activeReviewData = normalizeReviewProfileData(
      Object.assign({}, reviewData || uploadState.parsed || {}, {
        name: inviteMeta?.name || reviewData?.name || '',
        email: inviteMeta?.email || reviewData?.email || '',
        phone: inviteMeta?.phone || reviewData?.phone || ''
      })
    );
    const activeProjectsData = projectsData || splitAssessmentProfileData(uploadState.parsed || {}).projects;
    // CV 必填：仅有预填档案不够，必须实际上传简历文件
    const canContinueUpload = Array.isArray(uploadState.resumes) && uploadState.resumes.length > 0;
    // 设备检测(deviceTesting)期间仍可返回；设备检测完成进入面试间后再锁定
    const canLeaveInterviewStep = !interviewFinished && !interviewLocked;
    const interviewProfilePayload = stripInviteContact({
      ...activeReviewData,
      projects: activeProjectsData?.projects || [],
      resumes: Array.isArray(uploadState.resumes) ? uploadState.resumes : [],
      resumeParsed: uploadState.parsed && typeof uploadState.parsed === 'object' && (uploadState.parsed.fileId || Array.isArray(uploadState.parsed.educationList) || Array.isArray(uploadState.parsed.workList)) ? uploadState.parsed : null
    });

    if (initialLoading) {
      return (
        <Page title={pageTitle} back={false} toolbar={false}>
          <Flex align="center" justify="center" className={style['initial-loading']}>
            <Spin size="large" />
          </Flex>
        </Page>
      );
    }

    if (bootError) {
      return (
        <Page title={pageTitle} back={false} toolbar={false}>
          <Flex align="center" justify="center" className={style['invite-invalid-panel']}>
            <ResultCard.Error width={560} title={formatMessage({ id: 'tenantAdmin.collectInviteInvalidTitle' })} description={bootError || formatMessage({ id: 'tenantAdmin.collectInviteInvalidDesc' })} />
          </Flex>
        </Page>
      );
    }

    if (isManagerCollect) {
      return (
        <Page title={pageTitle} back={false} toolbar={false}>
          <div className={`${style['complete-profile']} ${style['complete-profile-interview']}`}>
            <div className={style.content}>
              <div className={style['content-inner']}>
                <div className={style['step-panel']}>
                  <div className={style['step-body']}>
                    <InterviewStep profilePayload={null} onInterviewComplete={handleInterviewComplete} apisAdapter={collectApis} />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Page>
      );
    }

    return (
      <Page title={pageTitle} back={false} toolbar={false}>
        <div className={`${style['complete-profile']}${current === 2 ? ` ${style['complete-profile-interview']}` : ''}`}>
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
                    showSkip={false}
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
                          mergeLinkedinIntoReview();
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
                  <div className={style['step-body']}>
                    <ProjectsStep FormInfo={FormInfo} value={activeProjectsData?.projects || []} onChange={projects => setProjectsData({ projects })} onEditingChange={setProjectsEditing} />
                  </div>
                  <Footer
                    showSkip={false}
                    showPrevious
                    primary={
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
                          setInterviewPhase('loading');
                          setInterviewLocked(false);
                          setCurrent(2);
                        }}
                      >
                        {formatMessage({ id: 'tenantAdmin.completeSaveContinue' })}
                      </Button>
                    }
                  />
                </div>
              )}

              {current === 2 && (
                <div className={`${style['step-panel']}${!interviewFinished && canLeaveInterviewStep && interviewPhase === 'room' ? ` ${style['step-panel-interview-prestart']}` : ''}`}>
                  <div className={style['step-body']}>
                    <InterviewStep
                      key={`complete-profile-interview-${current}`}
                      profilePayload={interviewProfilePayload}
                      onInterviewComplete={handleInterviewComplete}
                      onPhaseChange={setInterviewPhase}
                      onInterviewLockChange={setInterviewLocked}
                      apisAdapter={collectApis}
                      withStepper
                      withHostFooter={!interviewFinished && canLeaveInterviewStep}
                    />
                  </div>
                  {!interviewFinished && canLeaveInterviewStep ? <Footer showSkip={false} showPrevious primary={null} variant={interviewPhase === 'room' ? 'interview-prestart' : undefined} /> : null}
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
