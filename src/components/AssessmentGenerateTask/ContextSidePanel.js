import { Empty, Flex, Tabs, Typography } from 'antd';
import { createWithRemoteLoader } from '@kne/remote-loader';
import dayjs from 'dayjs';
import ResumeParseEditor from './ResumeParseEditor';
import { formatValue } from './assessmentReviewUtils';
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
  const projects = Array.isArray(profileData.projects) ? profileData.projects : [];
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
          projects.map((project, index) => (
            <div key={index} className={style['nested-card']}>
              <Typography.Text strong>{project.name || `项目 ${index + 1}`}</Typography.Text>
              <div className={style['meta-label']}>角色：{formatValue(project.role)}</div>
              <Typography.Paragraph className={style['info-paragraph']} ellipsis={{ rows: 4, expandable: true, symbol: '展开' }}>
                {formatValue(project.description)}
              </Typography.Paragraph>
            </div>
          ))
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

const InterviewPane = () => <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="AI 面试数据暂未接入，后续在此展示报告与结论" />;

const ContextSidePanel = ({ context, resumeParsed, onResumeParsedChange }) => {
  const resumes = Array.isArray(context?.resumes) ? context.resumes : [];
  const resumeFile = resumes[0];
  const fileId = resumeFile?.id || resumeFile?.ossId || resumeFile?.fileId || resumeParsed?.fileId;
  const filename = resumeFile?.filename || resumeFile?.originalName || resumeFile?.name || resumeParsed?.filename;

  return (
    <div className={style['side-panel']}>
      <Tabs
        size="small"
        className={style['side-tabs']}
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
                <InterviewPane />
              </div>
            )
          }
        ]}
      />
    </div>
  );
};

export default ContextSidePanel;
