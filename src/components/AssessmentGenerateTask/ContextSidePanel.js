import { App, Button, Empty, Flex, Tabs, Typography } from 'antd';
import { useMemo } from 'react';
import { createWithRemoteLoader } from '@kne/remote-loader';
import { applyAiInterviewRemote } from '../../preset';
import dayjs from 'dayjs';
import ResumeParseEditor from './ResumeParseEditor';
import { formatValue } from './assessmentReviewUtils';
import InterviewVideoTranscript from '@components/InterviewVideoTranscript';
import { downloadInterviewExport } from '@components/PositionAnalysisTask/exportInterviewData';
import style from './style.module.scss';

const InfoCard = ({ title, children }) => (
  <div className={style['info-card']}>
    {title ? (
      <Typography.Text strong className={style['info-card-title']}>
        {title}
      </Typography.Text>
    ) : null}
    <div className={style['info-card-body']}>{children}</div>
  </div>
);

const MetaGrid = ({ items }) => (
  <div className={style['meta-grid']}>
    {items.map(item => (
      <div key={item.label} className={style['meta-item']}>
        <div className={style['meta-label']}>{item.label}</div>
        <div className={style['meta-value']}>{item.value}</div>
      </div>
    ))}
  </div>
);

const SubmittedInfoPane = ({ submittedInfo, assessment }) => {
  const profileData = submittedInfo && typeof submittedInfo === 'object' ? submittedInfo : assessment?.profileData || {};
  const projects = Array.isArray(profileData.projects) ? profileData.projects : Array.isArray(profileData.projects?.projects) ? profileData.projects.projects : [];
  const skills = profileData.skills?.work_related || profileData.skills;

  return (
    <Flex vertical gap={12}>
      <InfoCard title="联系信息">
        <MetaGrid
          items={[
            { label: '姓名', value: formatValue(profileData.name || assessment?.name) },
            { label: '手机', value: formatValue(profileData.phone || assessment?.phone) },
            { label: '邮箱', value: formatValue(profileData.email || assessment?.email) },
            { label: 'LinkedIn', value: formatValue(profileData.linkedin) }
          ]}
        />
      </InfoCard>

      <InfoCard title="目标岗位与偏好">
        <MetaGrid
          items={[
            {
              label: '目标岗位',
              value: formatValue(Array.isArray(profileData.intentionPosition) ? profileData.intentionPosition.join('、') : profileData.intentionPosition)
            },
            {
              label: '工作模式',
              value: formatValue(profileData.workPreference?.work_mode_preference || profileData.workPreference?.workMode)
            },
            {
              label: '出差意愿',
              value: formatValue(profileData.workPreference?.business_travel_willingness || profileData.workPreference?.openTravel)
            },
            {
              label: 'Relocation',
              value: formatValue(profileData.workPreference?.relocation_willingness || profileData.workPreference?.openRelocation)
            }
          ]}
        />
      </InfoCard>

      <InfoCard title="技能">
        <Typography.Paragraph className={style['info-paragraph']}>{Array.isArray(skills) ? skills.join('、') || '-' : formatValue(skills)}</Typography.Paragraph>
      </InfoCard>

      <InfoCard title="项目经历">
        {projects.length === 0 ? (
          <Typography.Text type="secondary">-</Typography.Text>
        ) : (
          projects.map((project, index) => {
            const skillTags = Array.isArray(project.skills) ? project.skills.filter(Boolean) : [];
            return (
              <div key={index} className={style['nested-card']}>
                <Typography.Text strong>{project.name || `项目 ${index + 1}`}</Typography.Text>
                <div className={style['meta-label']}>角色：{formatValue(project.role)}</div>
                {project.period != null && project.period !== '' ? <div className={style['meta-label']}>周期：{formatValue(project.period)}</div> : null}
                <Typography.Paragraph className={style['info-paragraph']} ellipsis={{ rows: 4, expandable: true, symbol: '展开' }}>
                  {formatValue(project.description)}
                </Typography.Paragraph>
                {skillTags.length ? <div className={style['meta-label']}>技能：{skillTags.join('、')}</div> : null}
              </div>
            );
          })
        )}
      </InfoCard>

      {assessment?.updatedAt ? (
        <Typography.Text type="secondary" className={style['meta-foot']}>
          提交时间：{dayjs(assessment.updatedAt).format('YYYY-MM-DD HH:mm')}
        </Typography.Text>
      ) : null}
    </Flex>
  );
};

const InterviewPane = createWithRemoteLoader({
  modules: ['ai-interview-flowup:ComponentPreset', 'ai-interview-flowup:InterviewResultSession', 'components-core:Global@useGlobalValue']
})(({ remoteModules, interview, interviewError, apiHost }) => {
  const [ComponentPreset, InterviewResultSession, useGlobalValue] = remoteModules;
  const hostThemeToken = useGlobalValue('themeToken');
  if (interviewError) {
    return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={interviewError} />;
  }
  if (!interview) {
    return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无面试数据" />;
  }
  if (!ComponentPreset || !InterviewResultSession || !apiHost) {
    return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="面试结果组件未就绪" />;
  }
  return (
    <ComponentPreset apiHost={apiHost} themeToken={hostThemeToken}>
      <InterviewResultSession data={interview} />
    </ComponentPreset>
  );
});

const InterviewPaneGate = ({ interview, interviewError, apiHost, cdnUrl, version }) => {
  const remoteKey = useMemo(() => `${cdnUrl || ''}|${version || ''}|${apiHost || ''}`, [apiHost, cdnUrl, version]);
  const remoteApplied = useMemo(() => {
    if (!cdnUrl || !version) {
      return false;
    }
    return applyAiInterviewRemote({ cdnUrl, version });
  }, [cdnUrl, version]);

  if (interviewError) {
    return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={interviewError} />;
  }
  if (!interview) {
    return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无面试数据" />;
  }
  if (!remoteApplied || !apiHost) {
    return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="AI 面试组件未配置，请先在设置中填写 CDN 与版本" />;
  }
  return <InterviewPane key={remoteKey} interview={interview} interviewError={interviewError} apiHost={apiHost} />;
};

const ContextSidePanel = ({ context, resumeParsed, onResumeParsedChange, profileDetail }) => {
  const { message } = App.useApp();
  const resumes = Array.isArray(context?.resumes) ? context.resumes : [];
  const resumeFile = resumes[0];
  const fileId = resumeFile?.id || resumeFile?.ossId || resumeFile?.fileId || resumeParsed?.fileId;
  const filename = resumeFile?.filename || resumeFile?.originalName || resumeFile?.name || resumeParsed?.filename;

  const exportData = () => {
    const submittedInfo = context?.submittedInfo || context?.assessment?.profileData || null;
    if (!context?.interview && !context?.position && !context?.company && !context?.employee && !resumeParsed && !submittedInfo && !profileDetail) {
      message.warning('暂无可导出数据');
      return;
    }
    const name = context?.employee?.name || profileDetail?.name || context?.assessment?.name || context?.position?.name || 'export';
    downloadInterviewExport({
      interview: context?.interview,
      videoTranscripts: context?.videoTranscripts,
      position: context?.position,
      company: context?.company,
      employee: context?.employee,
      assessment: context?.assessment,
      resumeParsed,
      submittedInfo,
      profileDetail,
      includeEmployee: true,
      includeResume: true,
      includeSubmittedInfo: true,
      includeReviewData: true,
      filename: `profile-data-${name}`
    });
    message.success('已导出数据');
  };

  return (
    <div className={style['side-panel']}>
      <Tabs
        size="small"
        className={style['side-tabs']}
        tabBarExtraContent={
          <Button size="small" type="link" className={style['export-btn']} onClick={exportData}>
            导出数据
          </Button>
        }
        items={[
          {
            key: 'resume-original',
            label: '简历原件',
            children: <div className={style['side-tab-body']}>{fileId ? <ResumeParseEditor mode="original" fileId={fileId} filename={filename} /> : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无简历原件" />}</div>
          },
          {
            key: 'resume-parsed',
            label: '简历解析',
            children: (
              <div className={style['side-tab-body']}>
                {resumeParsed ? <ResumeParseEditor mode="parsed" data={resumeParsed} onChange={onResumeParsedChange} /> : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无简历解析结果" />}
              </div>
            )
          },
          {
            key: 'submitted',
            label: '填写信息',
            children: (
              <div className={style['side-tab-body']}>
                <SubmittedInfoPane submittedInfo={context?.submittedInfo} assessment={context?.assessment} />
              </div>
            )
          },
          {
            key: 'interview',
            label: 'AI 面试',
            children: (
              <div className={style['side-tab-body']}>
                <Flex vertical gap={12}>
                  <InterviewPaneGate interview={context?.interview} interviewError={context?.interviewError} apiHost={context?.apiHost} cdnUrl={context?.cdnUrl} version={context?.version} />
                  <InterviewVideoTranscript interview={context?.interview} videoTranscripts={context?.videoTranscripts} />
                </Flex>
              </div>
            )
          }
        ]}
      />
    </div>
  );
};

export default ContextSidePanel;
