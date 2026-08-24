import { useMemo, useState, useCallback } from 'react';
import { Button, Flex, message } from 'antd';
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
import style from './style.module.scss';

const countParsedFields = parsed => {
  if (!parsed || typeof parsed !== 'object') return 0;
  return Object.keys(parsed).filter(key => {
    const value = parsed[key];
    if (value == null || value === '') return false;
    if (Array.isArray(value)) return value.length > 0;
    if (typeof value === 'object') return Object.keys(value).length > 0;
    return true;
  }).length;
};

const hasContactValue = value => {
  if (value == null || value === '') return false;
  if (typeof value === 'string') return value.trim().length > 0;
  if (typeof value === 'object') {
    const number = value.number ?? value.phone ?? value.value;
    return number != null && String(number).trim().length > 0;
  }
  return true;
};

const getMissingLabels = (data, formatMessage) => {
  const missing = [];
  if (!data?.name) missing.push(formatMessage({ id: 'tenantAdmin.completeFullName' }));
  const hasPhone = hasContactValue(data?.phone);
  const hasEmail = hasContactValue(data?.email);
  if (!hasPhone && !hasEmail) {
    missing.push(formatMessage({ id: 'tenantAdmin.completePhoneOrEmail' }));
  }
  if (!data?.options?.openRelocation) missing.push(formatMessage({ id: 'tenantAdmin.completeOpenRelocation' }));
  if (!Array.isArray(data?.skills) || data.skills.length === 0) {
    missing.push(formatMessage({ id: 'tenantAdmin.completeSkills' }));
  }
  return missing;
};

const CompleteProfile = createWithRemoteLoader({
  modules: [
    'components-core:Global@usePreset',
    'components-core:FormInfo',
    'components-core:InfoPage',
    'components-core:FileList@DragAreaOuter',
    'components-core:FileList@UploadTips',
    'components-core:FileList@UploadButton',
    'components-core:File@List'
  ]
})(
  withLocale(({ remoteModules, baseUrl = '/tenant' }) => {
    const { formatMessage } = useIntl();
    if (!Array.isArray(remoteModules) || remoteModules.length < 7) {
      return null;
    }
    const [usePreset, FormInfo, InfoPage, DragAreaOuter, UploadTips, UploadButton, FileList] = remoteModules;
    if (typeof usePreset !== 'function' || !FormInfo || !InfoPage || !DragAreaOuter || !UploadTips || !UploadButton || !FileList) {
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
    const [interviewFinished, setInterviewFinished] = useState(false);
    const handleInterviewComplete = useCallback(() => setInterviewFinished(true), []);

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

    const goHome = () => navigate(baseUrl || '/tenant');

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

    const activeReviewData = reviewData || uploadState.parsed || {};
    const resumeFile = Array.isArray(uploadState.resumes) ? uploadState.resumes[0] : null;

    return (
      <Page title={pageTitle} back toolbar={false}>
        <div className={style['complete-profile']}>
          <Stepper items={stepTitles} current={current} />

          <div className={style.content}>
            <div className={style['content-inner']}>
              {current === 0 && (
                <div className={style['step-panel']}>
                  <div className={style['step-body']}>
                    <UploadStep usePreset={usePreset} DragAreaOuter={DragAreaOuter} UploadTips={UploadTips} UploadButton={UploadButton} FileList={FileList} ajax={ajax} apis={employeeApis} value={uploadState} onChange={setUploadState} />
                  </div>
                  <Footer
                    primary={
                      <Button
                        type="primary"
                        size="middle"
                        className={style['primary-btn']}
                        onClick={() => {
                          if (!Array.isArray(uploadState.resumes) || uploadState.resumes.length === 0) {
                            message.warning(formatMessage({ id: 'tenantAdmin.completeUploadRequired' }));
                            return;
                          }
                          setReviewData(prev => {
                            if (prev) return prev;
                            const parsed = uploadState.parsed || {};
                            return {
                              ...parsed,
                              skills: Array.isArray(parsed.skills) ? parsed.skills : []
                            };
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
                      setReviewData(data);
                      setCurrent(2);
                    }}
                  >
                    <div className={style['step-body']}>
                      <ReviewStep FormInfo={FormInfo} resumeFile={resumeFile} parsedCount={countParsedFields(activeReviewData)} missing={getMissingLabels(activeReviewData, formatMessage)} />
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
                  <Form
                    className={style['step-form']}
                    data={projectsData || { projects: [{ name: '', role: '', description: '', skills: [], period: [] }] }}
                    bordered
                    onSubmit={data => {
                      setProjectsData(data);
                      setCurrent(3);
                    }}
                  >
                    <div className={style['step-body']}>
                      <ProjectsStep FormInfo={FormInfo} InfoPage={InfoPage} />
                    </div>
                    <Footer
                      primary={
                        <SubmitButton type="primary" size="middle" className={style['primary-btn']}>
                          {formatMessage({ id: 'tenantAdmin.completeSaveContinue' })}
                        </SubmitButton>
                      }
                    />
                  </Form>
                </div>
              )}

              {current === 3 && (
                <div className={style['step-panel']}>
                  <div className={style['step-body']}>
                    <InterviewStep
                      profilePayload={{
                        ...(reviewData || uploadState.parsed || {}),
                        projects: projectsData?.projects || []
                      }}
                      onInterviewComplete={handleInterviewComplete}
                    />
                  </div>
                  {interviewFinished ? (
                    <Footer
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
