import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Collapse, Empty, Segmented, Spin, Tabs, Tag, Typography } from 'antd';
import { DownOutlined } from '@ant-design/icons';
import classnames from 'classnames';
import { createWithRemoteLoader } from '@kne/remote-loader';
import { useIntl } from '@kne/react-intl';
import dayjs from 'dayjs';
import ActivityTaskTable from '@components/ActivityTaskTable';
import RoleInsightsContent from '@components/Position/Detail/RoleInsightsContent';
import confirmLocale from '@components/ReadinessConfirm/withLocale';
import { groupQuestions, InterviewList, QuestionGroups } from '@components/ReadinessConfirm/Questionnaire';
import { formatProjectPeriod, isBlankProject } from '@components/TenantAdmin/CompleteProfile/ProjectsStep';
import { hasSavedProfileData, splitAssessmentProfileData } from '@components/TenantAdmin/CompleteProfile/profileDataUtils';
import { buildPersonAnalysis, buildRolePreview } from './readinessPreviewMap';
import RoleApplyTalent from './RoleApplyTalent';
import { notifyError } from './common';
import style from './result.module.scss';

const asArray = value => (Array.isArray(value) ? value : []);
const resultOf = output => (output && output.result && typeof output.result === 'object' && !Array.isArray(output.result) ? output.result : output || {});
const formatTime = value => (value ? dayjs(value).format('YYYY-MM-DD HH:mm') : null);
// 上游比例字段有 0–1 与 0–100 两种写法
const formatPct = value => (typeof value === 'number' ? `${Math.round(value <= 1 ? value * 100 : value)}%` : null);

const useResultText = () => {
  const { formatMessage } = useIntl();
  return (id, values) => formatMessage({ id: `tenantAdmin.readiness.result.${id}`, defaultMessage: id }, values);
};

/** 从阶段输入里找任务清单，用于把 task_id 显示成任务名 */
const taskNamesOf = input => {
  const params = input?.params || input || {};
  const tasks = asArray(params.tasks).length ? params.tasks : asArray(params.catalog?.tasks);
  return new Map(asArray(tasks).map(item => [item.task_id, item.task]));
};

const EXPOSURE_COLOR = { low: 'success', medium: 'warning', high: 'error' };
const CHANGE_COLOR = { add: 'success', change: 'processing', replaced: 'warning', replace: 'warning', disappear: 'error' };

const Stats = ({ items }) => (
  <div className={style.stats}>
    {items
      .filter(item => item && item[1] !== null && item[1] !== undefined)
      .map(([label, value]) => (
        <div key={label} className={style.stat}>
          <span className={style.statValue}>{value}</span>
          <span className={style.statLabel}>{label}</span>
        </div>
      ))}
  </div>
);

const Importance = ({ value }) =>
  typeof value === 'number' ? (
    <span className={style.importance} title={String(value)}>
      {[1, 2, 3, 4, 5].map(level => (
        <i key={level} className={level <= value ? style.importanceOn : undefined} />
      ))}
      <span className={style.importanceValue}>{value}</span>
    </span>
  ) : (
    '-'
  );

const AiLevel = ({ value, tr }) => (value && value !== 'unknown' ? <Tag color="blue">{value}</Tag> : <Tag>{tr('unknown')}</Tag>);

/** 任务按活动分组，用岗位洞察同款的分组任务表展示 */
const TaskTable = ({ tasks, tr, columns, renderSecondary, renderMetric, renderTrailing }) => {
  const [expanded, setExpanded] = useState({});
  const groups = useMemo(() => {
    const map = new Map();
    tasks.forEach(item => {
      const title = item.activity || item.task;
      if (!map.has(title)) {
        map.set(title, { id: title, title, children: [] });
      }
      map.get(title).children.push(Object.assign({}, item, { id: item.task_id || item.task, name: item.task }));
    });
    return [...map.values()].map(group => Object.assign(group, { countLabel: tr('countTasks', { count: group.children.length }) }));
  }, [tasks, tr]);
  return (
    <ActivityTaskTable
      groups={groups}
      expanded={expanded}
      onToggle={id => setExpanded(prev => Object.assign({}, prev, { [id]: prev[id] === false }))}
      columns={[tr('activityTask'), ...columns]}
      renderPrimary={item => item.task}
      renderSecondary={renderSecondary}
      renderMetric={renderMetric}
      renderTrailing={renderTrailing}
    />
  );
};

/** 岗位任务清单（draft / revise） */
const TaskListResult = ({ output, tr }) => {
  const tasks = asArray(resultOf(output).tasks);
  return (
    <>
      <Stats items={[[tr('tasks'), tasks.length]]} />
      <TaskTable tasks={tasks} tr={tr} columns={[tr('importanceNow'), '', '']} renderSecondary={item => <Importance value={item.importance_now} />} />
    </>
  );
};

/** 问卷题目沿用问卷确认页的展示；上游字段先转成确认页的结构 */
const toConfirmQuestion = item => ({
  no: item.no,
  type: item.type,
  module: item.module,
  question: item.question,
  options: item.options,
  showIf: item.show_if?.no ? { no: String(item.show_if.no), op: item.show_if.op === 'not_in' ? 'not_in' : 'in', values: [].concat(item.show_if.values ?? []).map(String) } : null
});

const ConfirmQuestionnaire = confirmLocale(({ questionnaire, interview = [], answers, unanswered, renderInterviewAnswer }) => {
  const { formatMessage, locale } = useIntl();
  const t = (id, values) => formatMessage({ id: `readinessConfirm.${id}` }, values);
  const list = questionnaire.map(toConfirmQuestion);
  const byNo = new Map(list.map(item => [item.no, item]));
  return (
    <div className={style.questionnaire}>
      <QuestionGroups groups={groupQuestions(list, locale)} byNo={byNo} t={t} answers={answers} unanswered={unanswered} />
      {interview.length ? <InterviewList list={interview} t={t} renderAnswer={renderInterviewAnswer} /> : null}
    </div>
  );
});

/** 经理 / 员工问卷 */
const QuestionnaireResult = ({ output, tr }) => {
  const result = resultOf(output);
  const questionnaire = asArray(result.questionnaire);
  const interview = asArray(result.interview);
  return (
    <>
      <Stats
        items={[
          [tr('questions'), questionnaire.length],
          [tr('interviews'), interview.length]
        ]}
      />
      <ConfirmQuestionnaire questionnaire={questionnaire} interview={interview} />
    </>
  );
};

/** 补充问卷 */
const ReassessResult = ({ output, tr }) => {
  const result = resultOf(output);
  const rows = asArray(result.reassess?.rows);
  const meta = result.reassess?.meta || {};
  return (
    <>
      <Stats
        items={[
          [tr('questions'), rows.length],
          [tr('supplements'), meta.n_need_supplement],
          [tr('coverage'), formatPct(result.coverage_report?.absolute_task_coverage_pct)]
        ]}
      />
      <ConfirmQuestionnaire questionnaire={rows} />
    </>
  );
};

/** 视频回答：录像（已转存到本仓文件系统）+ 转写 */
const VideoAnswer = createWithRemoteLoader({
  modules: ['components-core:FilePreview']
})(({ remoteModules, video, tr }) => {
  const [FilePreview] = remoteModules;
  const files = asArray(video?.files).filter(file => file?.fileId);
  return (
    <div className={style.video}>
      {files.length ? (
        files.map(file => (
          <div key={file.fileId} className={style.videoPlayer}>
            <FilePreview id={String(file.fileId)} filename="answer.mp4" />
          </div>
        ))
      ) : (
        <div className={style.muted}>{video ? tr('videoPending') : tr('noVideo')}</div>
      )}
      {video ? (
        <div className={style.transcriptBox}>
          <span className={style.transcriptLabel}>{tr('transcript')}</span>
          <span className={video.transcript ? undefined : style.muted}>{video.transcript || tr('noTranscript')}</span>
        </div>
      ) : null}
    </div>
  );
});

const answerText = value => (Array.isArray(value) ? value.join('、') : typeof value === 'object' ? JSON.stringify(value) : String(value));

const resumeFileId = file => (file == null ? null : String(file.id || file.fileId || file.value || ''));

const hasProfileCollect = profileData => hasSavedProfileData(profileData) || asArray(profileData?.resumes).some(item => resumeFileId(item));

/** 员工采集：简历文件 + LinkedIn / 核对信息 + 项目经历 */
const ProfileCollectResult = createWithRemoteLoader({
  modules: ['components-core:FilePreview']
})(({ remoteModules, profileData, tr }) => {
  const [FilePreview] = remoteModules;
  const { formatMessage } = useIntl();
  if (!hasProfileCollect(profileData)) {
    return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={tr('profileEmpty')} />;
  }
  const { review, projects } = splitAssessmentProfileData(profileData);
  const resumes = asArray(profileData?.resumes).filter(item => resumeFileId(item));
  const projectList = asArray(projects?.projects).filter(item => !isBlankProject(item));
  const soFarText = formatMessage({ id: 'tenantAdmin.completeSoFar', defaultMessage: 'Present' });
  const reviewFields = [
    [tr('profileName'), review.name],
    [tr('profileEmail'), review.email],
    [tr('profilePhone'), review.phone],
    [tr('profileLinkedin'), review.linkedin]
  ].filter(([, value]) => value != null && String(value).trim() !== '');

  return (
    <div className={style.block}>
      {resumes.length ? (
        <div className={style.profileBlock}>
          <div className={style.profileBlockTitle}>{tr('profileResumes')}</div>
          <div className={style.resumeList}>
            {resumes.map(file => {
              const id = resumeFileId(file);
              const name = String(file?.filename || file?.name || file?.originalName || id);
              return (
                <div key={id} className={style.resumeItem}>
                  <span className={style.resumeName}>{name}</span>
                  {FilePreview ? <FilePreview id={id} filename={name} /> : null}
                </div>
              );
            })}
          </div>
        </div>
      ) : null}
      {reviewFields.length ? (
        <div className={style.profileBlock}>
          <div className={style.profileBlockTitle}>{tr('profileReview')}</div>
          <dl className={style.fields}>
            {reviewFields.map(([label, value]) => (
              <div key={label} className={style.field}>
                <dt>{label}</dt>
                <dd>{String(value)}</dd>
              </div>
            ))}
          </dl>
        </div>
      ) : null}
      {projectList.length ? (
        <div className={style.profileBlock}>
          <div className={style.profileBlockTitle}>{tr('profileProjects')}</div>
          <div className={style.projectList}>
            {projectList.map((project, index) => {
              const periodText = formatProjectPeriod(project.period, soFarText);
              const meta = [project.role, periodText].filter(Boolean).join(' · ');
              const skills = asArray(project.skills).filter(Boolean);
              return (
                <div key={`${project.name || 'p'}-${index}`} className={style.projectCard}>
                  <Typography.Title level={5} className={style.projectTitle}>
                    {project.name || tr('untitledProject')}
                  </Typography.Title>
                  {meta ? <div className={style.muted}>{meta}</div> : null}
                  {project.description ? <Typography.Paragraph className={style.projectDesc}>{project.description}</Typography.Paragraph> : null}
                  {skills.length ? (
                    <div className={style.projectTags}>
                      {skills.map(skill => (
                        <Tag key={skill} bordered={false}>
                          {skill}
                        </Tag>
                      ))}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
});

/** 答卷正文（不含采集档案） */
const AnswersBody = ({ output, questionnaire, tr }) => {
  const answers = output?.answers || {};
  const videos = asArray(output?.videoAnswers);
  const questions = asArray(questionnaire?.questionnaire);
  const interview = asArray(questionnaire?.interview);
  const answeredCount = Object.values(answers).filter(value => value !== undefined && value !== null && value !== '').length;

  if (questions.length || interview.length) {
    const videoOf = (item, index) => videos.find(video => video.title && video.title === item.question) || videos[index];
    const matched = new Set(interview.map(videoOf).filter(Boolean));
    const extraVideos = videos.filter(video => !matched.has(video));
    return (
      <>
        <Stats
          items={[
            [tr('answeredOf', { total: questions.length }), answeredCount],
            interview.length || videos.length ? [tr('videoAnsweredOf', { total: interview.length || videos.length }), videos.filter(video => asArray(video.files).length).length] : null
          ]}
        />
        <ConfirmQuestionnaire questionnaire={questions} interview={interview} answers={answers} unanswered={tr('unanswered')} renderInterviewAnswer={(item, index) => <VideoAnswer video={videoOf(item, index)} tr={tr} />} />
        {extraVideos.map((video, index) => (
          <div key={video.questionId || index} className={style.question}>
            <div className={style.questionText}>{video.title}</div>
            <VideoAnswer video={video} tr={tr} />
          </div>
        ))}
      </>
    );
  }

  return (
    <>
      <Stats
        items={[
          [tr('answers'), answeredCount],
          [tr('videoAnswers'), videos.length]
        ]}
      />
      <div className={style.answerGrid}>
        {Object.entries(answers).map(([key, value]) => (
          <div key={key} className={style.answer}>
            <span className={style.questionNo}>{key}</span>
            <span className={style.answerValue}>{answerText(value)}</span>
          </div>
        ))}
      </div>
      {videos.map((video, index) => (
        <div key={video.questionId || index} className={style.question}>
          <div className={style.questionText}>{video.title}</div>
          <VideoAnswer video={video} tr={tr} />
        </div>
      ))}
    </>
  );
};

/** 答卷：有采集档案时分「答卷 / 采集档案」两个 Tab */
const AnswersResult = ({ output, questionnaire, tr }) => {
  const showProfile = hasProfileCollect(output?.profileData);
  if (!showProfile) {
    return <AnswersBody output={output} questionnaire={questionnaire} tr={tr} />;
  }
  return (
    <Tabs
      size="small"
      className={style.answersTabs}
      items={[
        {
          key: 'answers',
          label: tr('answersTab'),
          children: <AnswersBody output={output} questionnaire={questionnaire} tr={tr} />
        },
        {
          key: 'profile',
          label: tr('profileCollect'),
          children: <ProfileCollectResult profileData={output?.profileData} tr={tr} />
        }
      ]}
    />
  );
};

/** 个人评估 / 更新个人评估 */
const AssessResult = ({ output, tr }) => {
  const result = resultOf(output);
  const tasks = asArray(result.tasks);
  return (
    <>
      <Stats
        items={[
          [tr('completion'), formatPct(result.profile_completion_pct)],
          [tr('tasks'), tasks.length],
          [tr('evaluated'), tasks.filter(item => item.ai_level && item.ai_level !== 'unknown').length]
        ]}
      />
      <TaskTable
        tasks={tasks}
        tr={tr}
        columns={[tr('aiLevel'), tr('efficiencyGain'), tr('confidence')]}
        renderSecondary={item => <AiLevel value={item.ai_level} tr={tr} />}
        renderMetric={item => formatPct(item.efficiency_gain_pct) || '-'}
        renderTrailing={item => formatPct(item.level_confidence) || '-'}
      />
    </>
  );
};

const EvidenceList = ({ list, tr }) => (
  <div className={style.evidenceList}>
    {list.map((item, index) => (
      <div key={index} className={style.evidence}>
        <div className={style.questionHead}>
          <span className={style.evidenceTitle}>{item.title}</span>
          {item.source ? <Tag bordered={false}>{item.source}</Tag> : null}
          {typeof item.score === 'number' ? <span className={style.muted}>{tr('score', { score: item.score.toFixed(2) })}</span> : null}
        </div>
        {item.summary ? <div className={style.evidenceSummary}>{item.summary}</div> : null}
      </div>
    ))}
  </div>
);

/** 外部证据召回 */
const RecallResult = ({ output, input, tr }) => {
  const external = asArray(resultOf(output).external);
  const names = taskNamesOf(input);
  const total = external.reduce((sum, item) => sum + asArray(item.evidence).length, 0);
  return (
    <>
      <Stats
        items={[
          [tr('tasks'), external.length],
          [tr('evidence'), total]
        ]}
      />
      <Collapse
        size="small"
        defaultActiveKey={external[0] ? [external[0].task_id] : []}
        items={external.map((item, index) => ({
          key: item.task_id || String(index),
          label: (
            <span className={style.collapseLabel}>
              {names.get(item.task_id) || tr('taskIndex', { index: index + 1 })}
              <span className={style.muted}>{tr('evidenceCount', { count: asArray(item.evidence).length })}</span>
            </span>
          ),
          children: <EvidenceList list={asArray(item.evidence)} tr={tr} />
        }))}
      />
    </>
  );
};

/** 技能演进：每项任务按 A1–A5 等级查看技能 */
const SkillsResult = ({ output, tr }) => {
  const taskSkills = asArray(resultOf(output).task_skills);
  return (
    <>
      <Stats items={[[tr('tasks'), taskSkills.length]]} />
      <Collapse
        size="small"
        defaultActiveKey={taskSkills[0] ? [taskSkills[0].task_id] : []}
        items={taskSkills.map((item, index) => {
          const levels = Object.entries(item.levels || {});
          return {
            key: item.task_id || String(index),
            label: (
              <span className={style.collapseLabel}>
                {item.task || tr('taskIndex', { index: index + 1 })}
                {item.status ? <Tag bordered={false}>{item.status}</Tag> : null}
                <span className={style.muted}>{levels.map(([level, list]) => `${level} ${asArray(list).length}`).join(' · ')}</span>
              </span>
            ),
            children: levels.length ? (
              <Tabs
                size="small"
                items={levels.map(([level, list]) => ({
                  key: level,
                  label: `${level} (${asArray(list).length})`,
                  children: (
                    <div className={style.skillList}>
                      {asArray(list).map(skill => (
                        <div key={skill.skill_id || skill.name} className={style.skill}>
                          <div className={style.questionHead}>
                            <span className={style.evidenceTitle}>{skill.name}</span>
                            {skill.category ? <Tag bordered={false}>{skill.category}</Tag> : null}
                            {skill.change ? (
                              <Tag bordered={false} color={CHANGE_COLOR[skill.change]}>
                                {skill.change}
                              </Tag>
                            ) : null}
                          </div>
                          {skill.description ? <div className={style.evidenceSummary}>{skill.description}</div> : null}
                        </div>
                      ))}
                    </div>
                  )
                }))}
              />
            ) : (
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} />
            )
          };
        })}
      />
    </>
  );
};

/** 岗位预测 */
const ForecastResult = ({ output, tr }) => {
  const tasks = asArray(resultOf(output).tasks);
  return (
    <>
      <Stats
        items={[
          [tr('tasks'), tasks.length],
          [tr('highExposure'), tasks.filter(item => item.ai_exposure === 'high').length]
        ]}
      />
      <TaskTable
        tasks={tasks}
        tr={tr}
        columns={[tr('aiExposure'), tr('importanceTrend'), tr('confidence')]}
        renderSecondary={item =>
          item.ai_exposure ? (
            <Tag bordered={false} color={EXPOSURE_COLOR[item.ai_exposure]}>
              {item.ai_exposure}
            </Tag>
          ) : (
            '-'
          )
        }
        renderMetric={item => (
          <span className={style.metric}>
            {typeof item.importance_now === 'number' ? `${item.importance_now} → ${item.importance_year ?? '-'}` : '-'}
            <AiLevel value={item.expected_ai_level} tr={tr} />
          </span>
        )}
        renderTrailing={item => formatPct(item.prediction_confidence) || '-'}
      />
    </>
  );
};

/** 能力声明 */
const ClaimsResult = ({ output, tr }) => {
  const internal = asArray(resultOf(output).internal);
  return (
    <>
      <Stats items={[[tr('claims'), internal.length]]} />
      {internal.length ? (
        <div className={style.evidenceList}>
          {internal.map((item, index) => (
            <div key={index} className={style.evidence}>
              {typeof item === 'string' ? item : item.claim || item.text || item.statement || JSON.stringify(item)}
            </div>
          ))}
        </div>
      ) : (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={tr('noClaims')} />
      )}
    </>
  );
};

/**
 * 写回岗位：岗位洞察（Role Insights）+ 人才就绪（多人列表，样式对齐 AnalyzeTalent）。
 * 优先用任务产出里的 role / personAnalyses；旧数据从 input.params 现场映射。
 */
const RoleApplyResult = ({ output, input, tr }) => {
  const [tab, setTab] = useState('role');
  const params = input?.params || {};
  const positionId = String(output?.positionId || params.positionId || '');
  const role = output?.role || buildRolePreview({ report: params.role_report, forecast: params.forecast });
  const personAnalyses = useMemo(() => {
    if (Array.isArray(output?.personAnalyses) && output.personAnalyses.length) {
      return output.personAnalyses;
    }
    return asArray(params.persons)
      .filter(item => item?.employeeId)
      .map(item => ({
        person: { id: item.personId, employeeId: String(item.employeeId), name: item.name || '' },
        analysis: buildPersonAnalysis({ report: item.report, assess: item.assess, forecast: params.forecast })
      }));
  }, [output, params.forecast, params.persons]);

  return (
    <Tabs
      activeKey={tab}
      onChange={setTab}
      items={[
        {
          key: 'role',
          label: tr('tabRole'),
          children: <RoleInsightsContent skill={role?.skills || []} verdict={role?.verdict || {}} strategies={role?.strategies || []} />
        },
        {
          key: 'person',
          label: tr('tabPerson'),
          children: <RoleApplyTalent positionId={positionId} personAnalyses={personAnalyses} emptyDescription={tr('noPerson')} backLabel={tr('backToTalentList')} />
        }
      ]}
    />
  );
};

/** 人工阶段（确认 / 发布 / 发送 / 触发）：关键字段列表 */
const FieldsResult = ({ output, tr }) => {
  const via = output?.via ? tr(`via.${output.via}`) : null;
  const fields = [
    [tr('skippedAt'), formatTime(output?.skippedAt)],
    [tr('rejected'), output?.rejected ? tr('yes') : null],
    [tr('rejectComment'), output?.rejected ? output?.comment || '-' : null],
    [tr('rejectedAt'), formatTime(output?.rejectedAt)],
    [tr('confirmedBy'), [output?.confirmedByName, output?.confirmedByEmail].filter(Boolean).join(' · ') || null],
    [tr('confirmedAt'), formatTime(output?.confirmedAt)],
    [tr('via'), via],
    [tr('projectName'), output?.projectName],
    [tr('questions'), output?.questionnaireFields ? asArray(output.questionnaireFields).length : null],
    [tr('questionnaireVersion'), output?.questionnaireVersion ? `v${output.questionnaireVersion}` : null],
    [tr('deadline'), formatTime(output?.deadline)],
    [tr('sentAt'), formatTime(output?.sentAt)],
    [tr('recipients'), output?.recipients ? asArray(output.recipients).join('、') : null],
    [tr('triggeredAt'), formatTime(output?.triggeredAt)],
    [tr('appliedAt'), formatTime(output?.appliedAt)],
    [tr('taskCount'), output?.taskCount != null ? output.taskCount : null],
    [tr('strategyCount'), output?.strategyCount != null ? output.strategyCount : null],
    [tr('personCount'), output?.personCount != null ? output.personCount : null],
    [tr('outlookSummary'), output?.outlookSummary || null]
  ].filter(([, value]) => value !== null && value !== undefined && value !== '');
  return fields.length ? (
    <dl className={style.fields}>
      {fields.map(([label, value]) => (
        <div key={label} className={style.field}>
          <dt>{label}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  ) : (
    <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} />
  );
};

const RESULT_VIEWS = {
  draft: TaskListResult,
  revise: TaskListResult,
  manager_questionnaire: QuestionnaireResult,
  staff_questionnaire: QuestionnaireResult,
  reassess: ReassessResult,
  manager_answers: AnswersResult,
  answers: AnswersResult,
  reassess_answers: AnswersResult,
  assess: AssessResult,
  assess_update: AssessResult,
  recall: RecallResult,
  skills: SkillsResult,
  forecast: ForecastResult,
  claims: ClaimsResult,
  manager_confirm: FieldsResult,
  staff_confirm: FieldsResult,
  reassess_confirm: FieldsResult,
  manager_publish: FieldsResult,
  staff_publish: FieldsResult,
  reassess_publish: FieldsResult,
  manager_send: FieldsResult,
  staff_send: FieldsResult,
  reassess_send: FieldsResult,
  await_persons: FieldsResult,
  role_apply: RoleApplyResult
};

/** 只有关键字段的人工阶段不在页面内展开，仍可在「查看数据」里看 */
const INLINE_VIEWS = new Set([TaskListResult, QuestionnaireResult, ReassessResult, AnswersResult, AssessResult, RecallResult, SkillsResult, ForecastResult, ClaimsResult, RoleApplyResult]);

export const hasStageResult = (stage, output) => Boolean(RESULT_VIEWS[stage] && output && typeof output === 'object');
export const hasInlineResult = stage => INLINE_VIEWS.has(RESULT_VIEWS[stage]);

/** 按阶段把产出渲染成可读的结果视图；没有专属视图的阶段由调用方回退到原始 JSON */
const StageResult = ({ stage, output, input, questionnaire }) => {
  const tr = useResultText();
  const View = RESULT_VIEWS[stage];
  return (
    <div className={style.result}>
      <View output={output} input={input} questionnaire={questionnaire} tr={tr} />
    </div>
  );
};

/** 按阶段数据 id 取详情（含 output / input），由流程详情页提供 */
export const StageResultLoader = createContext(null);

/**
 * 页面内的阶段结果：整块可展开/收起；展开后用分段切换各阶段（默认最近产出）。
 * 详情按 id 缓存，轮询刷新时不重复请求。
 */
export const StageResultPanel = ({ t, stages }) => {
  const load = useContext(StageResultLoader);
  const list = stages.filter(item => item.result);
  const [open, setOpen] = useState(true);
  const [selectedKey, setSelectedKey] = useState(null);
  const selected = list.find(item => item.key === selectedKey) || list[list.length - 1];
  const id = selected?.result.id;
  const cacheRef = useRef(new Map());
  const [, setLoaded] = useState(0);

  useEffect(() => {
    if (!open || !id || !load || cacheRef.current.has(id)) {
      return;
    }
    load(id)
      .then(detail => {
        cacheRef.current.set(id, detail);
        setLoaded(count => count + 1);
      })
      .catch(notifyError);
  }, [open, id, load]);

  if (!selected || !load) {
    return null;
  }
  const detail = cacheRef.current.get(id);
  return (
    <div className={classnames(style.panel, { [style.panelCollapsed]: !open })}>
      <div className={style.panelHead}>
        <button type="button" className={style.panelToggle} aria-expanded={open} onClick={() => setOpen(value => !value)}>
          <DownOutlined className={classnames(style.panelToggleIcon, { [style.panelToggleIconOpen]: open })} />
          <span className={style.panelTitle}>{t('result.title')}</span>
        </button>
        {open ? list.length > 1 ? <Segmented size="small" value={selected.key} onChange={setSelectedKey} options={list.map(item => ({ value: item.key, label: item.label }))} /> : <span className={style.muted}>{selected.label}</span> : null}
      </div>
      {open ? <div className={style.panelBody}>{detail ? <StageResult stage={detail.stage} output={detail.output} input={detail.input} questionnaire={detail.questionnaire} /> : <Spin className={style.panelLoading} />}</div> : null}
    </div>
  );
};

export default StageResult;
