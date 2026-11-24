/**
 * Readiness 问卷 ↔ AI 面试 适配层
 *
 * 「新建题目 + 建项目」已由确认后的 ReadinessPublish 任务通过 open-api/admin 完成；
 * 「回收答卷」通过 open-api 的面试记录列表 + 面试详情取得问卷答案（options.questionnaire.answers，键为题号）。
 *
 * 契约：
 *   collectAnswers({ tenantId, projectId, invites }) -> [{ inviteId, shorten, answers }]
 *     invites: [{ inviteId, shorten, email }]，shorten 即邀请的免登录码（面试记录的 code），找不到时按邮箱对应
 *     只返回已提交问卷或已作答视频题的邀请；answers 为 题号 -> 答（可直接作为上游 answers 入参）；videoAnswers 为视频题作答 [{ questionId, title, transcript, submitted, fileIds }]
 */
const { collectVideoJobs } = require('./video-asr');

const NOT_READY_MESSAGE = 'AI 面试尚未提供“回收答卷”开放接口，暂不能自动对接';

const PAGE_SIZE = 100;

const hasAnswers = answers => !!answers && typeof answers === 'object' && Object.keys(answers).length > 0;

/** 录像文件 ID 按题目汇总（题目本身 + 追问），挑选逻辑与 invite-video-asr 共用 utils/video-asr 的 collectVideoJobs */
const fileIdsByQuestion = detail => {
  const map = new Map();
  collectVideoJobs(detail).forEach(job => map.set(job.questionId, [...(map.get(job.questionId) || []), ...job.fileIds]));
  return map;
};

/**
 * 视频题（AI 面试的题目）的作答：interview-detail.answers 按题目 ID 存放，转写文本在 aiResult（speechList）的 message 里。
 * 没有转写文本（尚未转写）时 transcript 为空，submitted 表示该题已录制提交；fileIds 为录像文件 ID（含追问），供后续转写。
 */
const videoAnswersOf = detail => {
  const fileIds = fileIdsByQuestion(detail);
  return Object.values(detail?.answers || {})
    .filter(item => item && typeof item === 'object' && item.question)
    .map(item => ({
      questionId: String(item.question.id ?? ''),
      title: String(item.question.title || ''),
      transcript: (Array.isArray(item.aiResult) ? item.aiResult : []).map(part => part?.message || '').join(''),
      submitted: !!item.submit,
      fileIds: fileIds.get(String(item.question.id ?? '')) || []
    }))
    .filter(item => item.transcript || item.submitted);
};

const normalizeEmail = value =>
  String(value || '')
    .trim()
    .toLowerCase();

/** 面试记录与邀请的对应：优先免登录码（code = 邀请 shorten），其次邮箱（与租户端邀请记录的匹配口径一致） */
const createAdapter = ({ services }) => ({
  collectAnswers: async ({ tenantId, projectId, invites }) => {
    const list = invites || [];
    if (!list.length) {
      return [];
    }
    const codes = new Set(list.map(item => String(item.shorten || '')).filter(Boolean));
    const emails = new Set(list.map(item => normalizeEmail(item.email)).filter(Boolean));
    // 先按项目把面试记录翻完，再逐个对上邀请
    const rows = [];
    let seen = 0;
    for (let currentPage = 1; ; currentPage += 1) {
      const res = await services.aiInterview.getInterviewList({ tenantId, projectId, currentPage, perPage: PAGE_SIZE });
      const page = res?.pageData || [];
      seen += page.length;
      rows.push(...page);
      // 以实际返回条数累计，不假设 open-api 按请求的 perPage 返回
      if (!page.length || seen >= Number(res?.totalCount || 0)) {
        break;
      }
    }
    const results = [];
    for (const invite of list) {
      const shorten = String(invite.shorten || '');
      const email = normalizeEmail(invite.email);
      const row = (shorten && codes.has(shorten) && rows.find(item => String(item.code || '') === shorten)) || (email && emails.has(email) && rows.find(item => normalizeEmail(item.email || item.user?.email) === email)) || null;
      if (!row) {
        continue;
      }
      const detail = await services.aiInterview.getInterviewDetail({ tenantId, id: String(row.id) });
      const questionnaire = detail?.options?.questionnaire;
      const questionnaireDone = !!questionnaire?.submittedAt && hasAnswers(questionnaire.answers);
      const videoAnswers = videoAnswersOf(detail);
      if (!questionnaireDone && !videoAnswers.length) {
        continue;
      }
      results.push({
        inviteId: invite.inviteId,
        shorten: invite.shorten || row.code || null,
        email: invite.email || row.email || row.user?.email || null,
        answers: questionnaireDone ? questionnaire.answers : {},
        videoAnswers
      });
    }
    return results;
  }
});

module.exports = { createAdapter, NOT_READY_MESSAGE };
