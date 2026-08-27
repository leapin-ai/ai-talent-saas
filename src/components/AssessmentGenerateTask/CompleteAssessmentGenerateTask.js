import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { App, Button, Flex, Select, Spin, Splitter, Typography, message } from 'antd';
import { createWithRemoteLoader } from '@kne/remote-loader';
import Fetch from '@kne/react-fetch';
import TalentProfile from '@components/TalentProfile';
import ContextSidePanel from './ContextSidePanel';
import { toReviewData } from './assessmentReviewUtils';
import style from './style.module.scss';

const AI_FILL_LANGUAGE_OPTIONS = [
  { label: '中文', value: 'zh-CN' },
  { label: 'English', value: 'en-US' }
];

const AiFillToolbar = ({ taskId, ajax, fillApi, profileDetail, setProfileDetail, resumeParsed, submittedInfo, languageRef }) => {
  const { message: msg } = App.useApp();
  const [loading, setLoading] = useState(false);
  const [language, setLanguage] = useState(() => languageRef?.current || 'zh-CN');

  if (!fillApi) {
    return null;
  }

  const changeLanguage = value => {
    setLanguage(value);
    if (languageRef) {
      languageRef.current = value;
    }
  };

  return (
    <div className={style['ai-fill-bar']}>
      <div className={style['ai-fill-main']}>
        <label className={style['ai-fill-field']}>
          <span className={style['ai-fill-label']}>生成语言</span>
          <Select size="middle" className={style['ai-fill-select']} value={language || 'zh-CN'} options={AI_FILL_LANGUAGE_OPTIONS} disabled={loading} onChange={changeLanguage} />
        </label>
        <Button
          type="primary"
          className={style['ai-fill-action']}
          loading={loading}
          disabled={loading || !profileDetail}
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
                    submittedInfo: submittedInfo || null
                  }
                })
              );
              if (resData.code !== 0) {
                throw new Error(resData.msg || 'AI 填充失败');
              }
              const nextData = resData.data?.data;
              if (!nextData || typeof nextData !== 'object') {
                throw new Error('AI 未返回可用数据');
              }
              setProfileDetail(prev =>
                Object.assign({}, prev, nextData, {
                  id: prev?.id,
                  orgEnums: prev?.orgEnums,
                  positionEnums: prev?.positionEnums,
                  performances: prev?.performances || [],
                  aiSuggest: prev?.aiSuggest || null,
                  profile: Object.assign({}, prev?.profile || {}, nextData.profile || {}, {
                    options: Object.assign({}, prev?.profile?.options || {}, nextData.profile?.options || {})
                  }),
                  options: Object.assign({}, prev?.options || {}, nextData.options || {})
                })
              );
              msg.success('已根据左侧信息生成一版，可继续编辑');
            } catch (e) {
              msg.error(e.message || 'AI 填充失败');
            } finally {
              setLoading(false);
            }
          }}
        >
          AI 填充
        </Button>
      </div>
      <div className={style['ai-fill-hint']}>基于简历解析、填写信息与当前草稿生成，不会自动提交</div>
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

  useEffect(() => {
    if (context?.profileDetail) {
      setProfileDetail(prev => prev || context.profileDetail);
    }
  }, [context?.profileDetail, setProfileDetail]);

  useEffect(() => {
    setResumeParsed(context?.resumeParsed || null);
  }, [context?.resumeParsed]);

  const currentDetail = profileDetail || context.profileDetail;

  return (
    <Splitter className={style['split-layout']}>
      <Splitter.Panel defaultSize="48%" min="320" max="70%" className={style['split-left']}>
        <ContextSidePanel context={context} resumeParsed={resumeParsed} onResumeParsedChange={setResumeParsed} />
      </Splitter.Panel>
      <Splitter.Panel className={style['split-right']}>
        <div className={style['form-scroll']}>
          <Flex vertical gap={12} className={style['right-panel']}>
            <Typography.Title level={5} style={{ margin: 0 }}>
              员工档案
            </Typography.Title>
            <AiFillToolbar taskId={taskId} ajax={ajax} fillApi={fillApi} profileDetail={currentDetail} setProfileDetail={setProfileDetail} resumeParsed={resumeParsed} submittedInfo={context?.submittedInfo} languageRef={fillLanguageRef} />
            <ProfileEditorPanel employeeApis={employeeApis} profileDetail={currentDetail} setProfileDetail={setProfileDetail} />
          </Flex>
        </div>
      </Splitter.Panel>
    </Splitter>
  );
};

export default CompleteAssessmentGenerateTask;
