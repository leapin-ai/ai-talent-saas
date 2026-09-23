import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { App, Button, Flex, Select, Spin, Splitter, Typography, message } from 'antd';
import { createWithRemoteLoader } from '@kne/remote-loader';
import Fetch from '@kne/react-fetch';
import TalentProfile from '@components/TalentProfile';
import ContextSidePanel from './ContextSidePanel';
import { toReviewData, parseClipboardProfilePayload, applyClipboardToProfileDetail, withEstimatedCompletion } from './assessmentReviewUtils';
import style from './style.module.scss';

const AI_FILL_LANGUAGE_OPTIONS = [
  { label: '中文', value: 'zh-CN' },
  { label: 'English', value: 'en-US' }
];

const AiFillToolbar = ({ taskId, ajax, fillApi, profileDetail, setProfileDetail, resumeParsed, submittedInfo, languageRef, completionExtras }) => {
  const { message: msg } = App.useApp();
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [language, setLanguage] = useState(() => languageRef?.current || 'zh-CN');

  const changeLanguage = value => {
    setLanguage(value);
    if (languageRef) {
      languageRef.current = value;
    }
  };

  const onImportClipboard = async () => {
    setImporting(true);
    try {
      if (!navigator?.clipboard?.readText) {
        throw new Error('当前环境不支持读取剪贴板');
      }
      const text = await navigator.clipboard.readText();
      if (!text || !String(text).trim()) {
        throw new Error('剪贴板为空');
      }
      const bundle = parseClipboardProfilePayload(String(text).trim());
      setProfileDetail(prev => applyClipboardToProfileDetail(prev || profileDetail, bundle, completionExtras));
      const parts = [];
      if (bundle.employee && Object.keys(bundle.employee).length) {
        parts.push('员工信息');
      }
      if (bundle.profile && Object.keys(bundle.profile).length) {
        parts.push('档案');
      }
      if (bundle.skillAnalysis) {
        parts.push('就绪度');
      }
      if (bundle.aiSuggest) {
        parts.push('成长/匹配');
      }
      msg.success(`已从剪贴板导入：${parts.join('、') || '数据'}（已重算完成度）`);
    } catch (e) {
      msg.error(e.message || '导入失败');
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className={style['ai-fill-bar']}>
      <div className={style['ai-fill-main']}>
        {fillApi ? (
          <label className={style['ai-fill-field']}>
            <span className={style['ai-fill-label']}>生成语言</span>
            <Select size="middle" className={style['ai-fill-select']} value={language || 'zh-CN'} options={AI_FILL_LANGUAGE_OPTIONS} disabled={loading || importing} onChange={changeLanguage} />
          </label>
        ) : null}
        <Button className={style['ai-fill-action']} loading={importing} disabled={loading || importing} onClick={onImportClipboard}>
          从剪贴板导入
        </Button>
        {fillApi ? (
          <Button
            type="primary"
            className={style['ai-fill-action']}
            loading={loading}
            disabled={loading || importing || !profileDetail}
            onClick={async () => {
              if (!profileDetail) {
                return;
              }
              setLoading(true);
              try {
                const outputLanguage = languageRef?.current || language || 'zh-CN';
                const { data: resData } = await ajax(
                  Object.assign({}, fillApi, {
                    data: {
                      taskId,
                      language: outputLanguage,
                      draft: toReviewData(profileDetail),
                      resumeParsed: resumeParsed || null,
                      submittedInfo: submittedInfo || null,
                      persist: false
                    }
                  })
                );
                if (resData.code !== 0) {
                  throw new Error(resData.msg || 'AI 填充失败');
                }
                const payload = resData.data || {};
                const nextData = payload.data;
                if (!nextData || typeof nextData !== 'object') {
                  throw new Error('AI 未返回可用档案数据');
                }
                setProfileDetail(prev =>
                  withEstimatedCompletion(
                    Object.assign({}, prev, nextData, {
                      id: prev?.id,
                      orgEnums: prev?.orgEnums,
                      positionEnums: prev?.positionEnums,
                      performances: prev?.performances || [],
                      aiSuggest: payload.aiSuggest || prev?.aiSuggest || null,
                      skillAnalysisDraft: payload.readiness || prev?.skillAnalysisDraft || null,
                      profile: Object.assign({}, prev?.profile || {}, nextData.profile || {}, {
                        options: Object.assign({}, prev?.profile?.options || {}, nextData.profile?.options || {})
                      }),
                      options: Object.assign({}, prev?.options || {}, nextData.options || {})
                    }),
                    completionExtras
                  )
                );
                if (payload.insightError) {
                  msg.warning(`档案已填充；就绪度/成长/匹配未生成：${payload.insightError}`);
                } else {
                  msg.success('已生成档案与就绪度/成长/匹配，并重算完成度');
                }
              } catch (e) {
                msg.error(e.message || 'AI 填充失败');
              } finally {
                setLoading(false);
              }
            }}
          >
            AI 填充
          </Button>
        ) : null}
      </div>
      <div className={style['ai-fill-hint']}>可粘贴 reviewData JSON（employee/profile/skillAnalysis/aiSuggest）；或点 AI 填充一键生成；完成后会重算档案完成度，均不自动提交</div>
    </div>
  );
};

const ProfileEditorPanel = ({ employeeApis, profileDetail, setProfileDetail }) => {
  const saveEmployee = useCallback(
    async employeeData => {
      setProfileDetail(prev => {
        const next = Object.assign({}, prev, employeeData, {
          id: prev.id,
          options: Object.assign({}, prev.options || {}, employeeData.options || {}),
          profile: prev.profile
        });
        if (Array.isArray(prev.orgEnums)) {
          next.orgEnums = prev.orgEnums;
        }
        if (Array.isArray(prev.positionEnums)) {
          next.positionEnums = prev.positionEnums;
        }
        return next;
      });
    },
    [setProfileDetail]
  );

  const saveProfile = useCallback(
    async profilePatch => {
      setProfileDetail(prev =>
        Object.assign({}, prev, {
          profile: Object.assign({}, prev.profile || {}, profilePatch, {
            options: Object.assign({}, prev.profile?.options || {}, profilePatch.options || {})
          })
        })
      );
    },
    [setProfileDetail]
  );

  const saveAiSuggest = useCallback(
    async suggestData => {
      setProfileDetail(prev =>
        Object.assign({}, prev, {
          aiSuggest: Object.assign({}, prev.aiSuggest || {}, {
            shortTerm: suggestData.shortTerm !== undefined ? suggestData.shortTerm : prev.aiSuggest?.shortTerm || null,
            longTerm: suggestData.longTerm !== undefined ? suggestData.longTerm : prev.aiSuggest?.longTerm || null,
            matchPosition: suggestData.matchPosition !== undefined ? suggestData.matchPosition : prev.aiSuggest?.matchPosition || null
          })
        })
      );
    },
    [setProfileDetail]
  );

  const saveSkillAnalysis = useCallback(
    async analysisData => {
      setProfileDetail(prev =>
        Object.assign({}, prev, {
          skillAnalysisDraft: Object.assign({}, prev.skillAnalysisDraft || prev.skillAnalysis || {}, analysisData || {})
        })
      );
    },
    [setProfileDetail]
  );

  const createPerformance = useCallback(
    async performanceData => {
      setProfileDetail(prev =>
        Object.assign({}, prev, {
          performances: [Object.assign({}, performanceData, { id: `local-${Date.now()}` }), ...(prev.performances || [])]
        })
      );
    },
    [setProfileDetail]
  );

  const removePerformance = useCallback(
    async performanceId => {
      setProfileDetail(prev =>
        Object.assign({}, prev, {
          performances: (prev.performances || []).filter(item => item.id !== performanceId)
        })
      );
    },
    [setProfileDetail]
  );

  const savePerformance = useCallback(
    async performanceData => {
      setProfileDetail(prev =>
        Object.assign({}, prev, {
          performances: (prev.performances || []).map(item => (item.id === performanceData.id ? Object.assign({}, item, performanceData) : item))
        })
      );
    },
    [setProfileDetail]
  );

  if (!profileDetail) {
    return null;
  }

  return (
    <div className={style['profile-wrap']}>
      <TalentProfile
        baseUrl="/tenant"
        apis={employeeApis}
        data={profileDetail}
        saveEmployee={saveEmployee}
        saveProfile={saveProfile}
        saveAiSuggest={saveAiSuggest}
        saveSkillAnalysis={saveSkillAnalysis}
        createPerformance={createPerformance}
        removePerformance={removePerformance}
        savePerformance={savePerformance}
      />
    </div>
  );
};

const CompleteAssessmentGenerateTask = createWithRemoteLoader({
  modules: ['components-core:Global@usePreset', 'components-core:Modal']
})(({ remoteModules, data, onSuccess, children, ...props }) => {
  const [usePreset, Modal] = remoteModules;
  const { apis, ajax } = usePreset();
  const { message: msg } = App.useApp();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [profileDetail, setProfileDetail] = useState(null);
  const fillLanguageRef = useRef('zh-CN');

  const employeeApis = useMemo(
    () =>
      Object.assign({}, apis.talentSaas.tenant.employee, {
        positionList: apis.talentSaas.tenant.position.list,
        parseResume: apis.talentSaas.tenant.resume.parseFileId,
        orgList: apis.tenant.orgList
      }),
    [apis]
  );

  const fillApi = apis?.talentSaas?.tenant?.assessment?.generateAiFill;

  const handleComplete = async currentDetail => {
    setSubmitting(true);
    try {
      const reviewData = toReviewData(currentDetail);
      const { data: resData } = await ajax(
        Object.assign({}, apis.talentSaas.tenant.assessment.completeGenerate, {
          data: {
            taskId: data.id,
            reviewData
          }
        })
      );
      if (resData.code !== 0) {
        throw new Error(resData.msg || '完成生成任务失败');
      }
      msg.success('已完成生成并提交审核');
      setOpen(false);
      onSuccess && onSuccess();
      return true;
    } catch (e) {
      msg.error(e.message || '完成生成任务失败');
      return false;
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <Button
        {...props}
        onClick={() => {
          setProfileDetail(null);
          setOpen(true);
        }}
      >
        {children || '完成'}
      </Button>
      <Modal
        open={open}
        title="完善档案生成审核"
        size="large"
        noPadding
        destroyOnHidden
        disabledScroller
        onCancel={() => {
          if (!submitting) {
            setOpen(false);
          }
        }}
        onClose={() => {
          if (!submitting) {
            setOpen(false);
          }
        }}
        footerButtons={[
          {
            children: '取消',
            disabled: submitting,
            onClick: ({ close }) => {
              if (!submitting) {
                close();
              }
            }
          },
          {
            type: 'primary',
            children: '完成',
            loading: submitting,
            disabled: !profileDetail,
            onClick: async () => {
              const ok = await handleComplete(profileDetail);
              return ok;
            }
          }
        ]}
      >
        <Fetch
          {...apis.talentSaas.tenant.assessment.generateTaskContext}
          params={{ taskId: data.id }}
          render={({ data: context, isComplete }) => {
            if (!isComplete) {
              return (
                <Flex justify="center" style={{ padding: 48 }}>
                  <Spin size="large" />
                </Flex>
              );
            }
            return <TaskContextBody taskId={data.id} context={context} profileDetail={profileDetail} setProfileDetail={setProfileDetail} employeeApis={employeeApis} ajax={ajax} fillApi={fillApi} fillLanguageRef={fillLanguageRef} />;
          }}
        />
      </Modal>
    </>
  );
});

const TaskContextBody = ({ taskId, context, profileDetail, setProfileDetail, employeeApis, ajax, fillApi, fillLanguageRef }) => {
  const [resumeParsed, setResumeParsed] = useState(() => context?.resumeParsed || null);

  const completionExtras = useMemo(
    () => ({
      resumeParsed: resumeParsed || context?.resumeParsed || null,
      resumes: context?.resumes || [],
      interview: context?.interview || null,
      submittedInfo: context?.submittedInfo || null,
      assessment: context?.assessment || null
    }),
    [resumeParsed, context?.resumeParsed, context?.resumes, context?.interview, context?.submittedInfo, context?.assessment]
  );

  const setProfileDetailWithCompletion = useCallback(
    updater => {
      setProfileDetail(prev => {
        const next = typeof updater === 'function' ? updater(prev) : updater;
        return withEstimatedCompletion(next, completionExtras);
      });
    },
    [setProfileDetail, completionExtras]
  );

  useEffect(() => {
    if (context?.profileDetail) {
      setProfileDetail(prev => prev || withEstimatedCompletion(context.profileDetail, completionExtras));
    }
  }, [context?.profileDetail, setProfileDetail, completionExtras]);

  useEffect(() => {
    setResumeParsed(context?.resumeParsed || null);
  }, [context?.resumeParsed]);

  // 简历解析变更后重算完成度
  useEffect(() => {
    setProfileDetail(prev => (prev ? withEstimatedCompletion(prev, completionExtras) : prev));
  }, [completionExtras, setProfileDetail]);

  const currentDetail = profileDetail || context.profileDetail;

  return (
    <Splitter className={style['split-layout']}>
      <Splitter.Panel defaultSize="48%" min="320" max="70%" className={style['split-left']}>
        <ContextSidePanel context={context} resumeParsed={resumeParsed} onResumeParsedChange={setResumeParsed} profileDetail={currentDetail} />
      </Splitter.Panel>
      <Splitter.Panel className={style['split-right']}>
        <div className={style['form-scroll']}>
          <Flex vertical gap={12} className={style['right-panel']}>
            <Typography.Title level={5} style={{ margin: 0 }}>
              员工档案
            </Typography.Title>
            <AiFillToolbar
              taskId={taskId}
              ajax={ajax}
              fillApi={fillApi}
              profileDetail={currentDetail}
              setProfileDetail={setProfileDetailWithCompletion}
              resumeParsed={resumeParsed}
              submittedInfo={context?.submittedInfo}
              languageRef={fillLanguageRef}
              completionExtras={completionExtras}
            />
            <ProfileEditorPanel employeeApis={employeeApis} profileDetail={currentDetail} setProfileDetail={setProfileDetailWithCompletion} />
          </Flex>
        </div>
      </Splitter.Panel>
    </Splitter>
  );
};

export default CompleteAssessmentGenerateTask;
