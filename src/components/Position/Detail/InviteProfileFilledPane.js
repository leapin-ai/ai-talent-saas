import { useState } from 'react';
import { createWithRemoteLoader } from '@kne/remote-loader';
import { Empty, Flex, Typography } from 'antd';
import { FileTextOutlined } from '@ant-design/icons';
import { useIntl } from '@kne/react-intl';
import ResumeParseEditor from '../../AssessmentGenerateTask/ResumeParseEditor';
import style from './inviteAssessmentResult.module.scss';

const formatValue = value => {
  if (value == null || value === '') {
    return '-';
  }
  if (typeof value === 'object') {
    const number = value.number ?? value.phone ?? value.value ?? value.email;
    if (number != null && String(number).trim()) {
      return String(number).trim();
    }
    try {
      return JSON.stringify(value);
    } catch (e) {
      return '-';
    }
  }
  return String(value);
};

const InfoCard = ({ title, children }) => (
  <div className={style['info-card']}>
    {title ? (
      <Typography.Text strong className={style['info-card-title']}>
        {title}
      </Typography.Text>
    ) : null}
    <div>{children}</div>
  </div>
);

const MetaGrid = ({ items }) => (
  <div className={style['meta-grid']}>
    {items.map(item => (
      <div key={item.label}>
        <div className={style['meta-label']}>{item.label}</div>
        <div className={style['meta-value']}>{item.value}</div>
      </div>
    ))}
  </div>
);

const normalizeResumeFile = (file, index, formatMessage) => {
  const id = file?.id || file?.ossId || file?.fileId;
  const filename = file?.filename || file?.name || file?.originalName || formatMessage({ id: 'position.talentInviteFilledResumeItem' }, { index: index + 1 });
  return Object.assign({}, file, { id, filename });
};

const hasResumeParsedContent = resumeParsed => {
  if (!resumeParsed || typeof resumeParsed !== 'object') {
    return false;
  }
  return !!(
    resumeParsed.fileId ||
    resumeParsed.name ||
    resumeParsed.email ||
    resumeParsed.phone ||
    resumeParsed.expectJob ||
    resumeParsed.cont_my_desc ||
    (Array.isArray(resumeParsed.educationList) && resumeParsed.educationList.length) ||
    (Array.isArray(resumeParsed.workList) && resumeParsed.workList.length) ||
    (Array.isArray(resumeParsed.projectList) && resumeParsed.projectList.length) ||
    (Array.isArray(resumeParsed.skillList) && resumeParsed.skillList.length)
  );
};

const InviteProfileFilledPane = createWithRemoteLoader({
  modules: ['components-core:Modal', 'components-core:FilePreview']
})(({ remoteModules, invite }) => {
  const [Modal, FilePreview] = remoteModules;
  const { formatMessage } = useIntl();
  const [preview, setPreview] = useState(null);
  const profileData = invite?.profileData && typeof invite.profileData === 'object' ? invite.profileData : {};
  const projects = Array.isArray(profileData.projects) ? profileData.projects : [];
  const skills = profileData.skills?.work_related || profileData.skills;
  const resumes = (Array.isArray(profileData.resumes) ? profileData.resumes : []).map((file, index) => normalizeResumeFile(file, index, formatMessage));
  const resumeParsed = profileData.resumeParsed && typeof profileData.resumeParsed === 'object' ? profileData.resumeParsed : null;
  const showResumeParsed = hasResumeParsedContent(resumeParsed);
  const hasContent =
    !!(invite?.name || invite?.email || invite?.phone || profileData.linkedin) ||
    resumes.length > 0 ||
    showResumeParsed ||
    projects.length > 0 ||
    (Array.isArray(skills) ? skills.length > 0 : !!skills) ||
    !!(profileData.intentionPosition && (Array.isArray(profileData.intentionPosition) ? profileData.intentionPosition.length : true));

  if (!hasContent) {
    return (
      <div className={style['empty-wrap']}>
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={formatMessage({ id: 'position.talentInviteFilledEmpty' })} />
      </div>
    );
  }

  return (
    <Flex vertical gap={0}>
      <div className={style['pane-head']}>
        <p className={style['pane-title']}>{formatMessage({ id: 'position.talentInviteFilledTitle' })}</p>
        <p className={style['pane-desc']}>{formatMessage({ id: 'position.talentInviteFilledDesc' })}</p>
      </div>

      <InfoCard title={formatMessage({ id: 'position.talentInviteFilledContact' })}>
        <MetaGrid
          items={[
            { label: formatMessage({ id: 'position.talentInviteName' }), value: formatValue(profileData.name || invite?.name) },
            { label: formatMessage({ id: 'position.talentInvitePhone' }), value: formatValue(profileData.phone || invite?.phone) },
            { label: formatMessage({ id: 'position.talentInviteEmail' }), value: formatValue(profileData.email || invite?.email) },
            { label: 'LinkedIn', value: formatValue(profileData.linkedin) }
          ]}
        />
      </InfoCard>

      <InfoCard title={formatMessage({ id: 'position.talentInviteFilledResume' })}>
        <div className={style['resume-block']}>
          <div className={style['meta-label']}>{formatMessage({ id: 'position.talentInviteFilledResumeAttachment' })}</div>
          {resumes.length === 0 ? (
            <Typography.Text type="secondary">-</Typography.Text>
          ) : (
            <div className={style['file-list']}>
              {resumes.map((file, index) => (
                <button
                  key={file.id || index}
                  type="button"
                  className={style['file-link']}
                  disabled={!file.id}
                  onClick={() => {
                    if (!file.id) {
                      return;
                    }
                    setPreview({ id: file.id, filename: file.filename });
                  }}
                >
                  <FileTextOutlined />
                  <span>{file.filename}</span>
                </button>
              ))}
            </div>
          )}
        </div>
        <div className={style['resume-block']}>
          <div className={style['meta-label']}>{formatMessage({ id: 'position.talentInviteFilledResumeParsed' })}</div>
          {showResumeParsed ? (
            <div className={style['resume-parsed-wrap']}>
              <ResumeParseEditor mode="parsed" data={resumeParsed} />
            </div>
          ) : (
            <Typography.Text type="secondary">{formatMessage({ id: 'position.talentInviteFilledResumeParsedEmpty' })}</Typography.Text>
          )}
        </div>
      </InfoCard>

      <InfoCard title={formatMessage({ id: 'position.talentInviteFilledGoal' })}>
        <MetaGrid
          items={[
            {
              label: formatMessage({ id: 'position.talentInviteFilledTargetRole' }),
              value: formatValue(Array.isArray(profileData.intentionPosition) ? profileData.intentionPosition.join('、') : profileData.intentionPosition)
            },
            {
              label: formatMessage({ id: 'position.talentInviteFilledWorkMode' }),
              value: formatValue(profileData.workPreference?.work_mode_preference || profileData.workPreference?.workMode)
            },
            {
              label: formatMessage({ id: 'position.talentInviteFilledTravel' }),
              value: formatValue(profileData.workPreference?.business_travel_willingness || profileData.workPreference?.openTravel)
            },
            {
              label: formatMessage({ id: 'position.talentInviteFilledRelocation' }),
              value: formatValue(profileData.workPreference?.relocation_willingness || profileData.workPreference?.openRelocation)
            }
          ]}
        />
      </InfoCard>

      <InfoCard title={formatMessage({ id: 'position.talentInviteFilledSkills' })}>
        <Typography.Paragraph className={style['info-paragraph']}>{Array.isArray(skills) ? skills.join('、') || '-' : formatValue(skills)}</Typography.Paragraph>
      </InfoCard>

      <InfoCard title={formatMessage({ id: 'position.talentInviteFilledProjects' })}>
        {projects.length === 0 ? (
          <Typography.Text type="secondary">-</Typography.Text>
        ) : (
          projects.map((project, index) => (
            <div key={index} className={style['nested-card']}>
              <Typography.Text strong>{project.name || formatMessage({ id: 'position.talentInviteFilledProjectItem' }, { index: index + 1 })}</Typography.Text>
              <div className={style['meta-label']}>
                {formatMessage({ id: 'position.talentInviteFilledProjectRole' })}
                {formatValue(project.role)}
              </div>
              <Typography.Paragraph className={style['info-paragraph']} ellipsis={{ rows: 4, expandable: true, symbol: formatMessage({ id: 'position.talentInviteFilledExpand' }) }}>
                {formatValue(project.description)}
              </Typography.Paragraph>
            </div>
          ))
        )}
      </InfoCard>

      {Modal && FilePreview ? (
        <Modal open={!!preview} title={preview?.filename || formatMessage({ id: 'position.talentInviteFilledResume' })} size="large" destroyOnHidden footer={null} onCancel={() => setPreview(null)} onClose={() => setPreview(null)}>
          {preview ? <FilePreview id={preview.id} filename={preview.filename} /> : null}
        </Modal>
      ) : null}
    </Flex>
  );
});

export default InviteProfileFilledPane;
