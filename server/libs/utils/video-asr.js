/**
 * 视频题转写的公共部分：从 AI 面试详情里挑出需要转写的录像（视频题 + 追问）
 * 转写本身由 invite-video-asr 任务完成（只转写，不做业务落库）；谁发起谁在任务回调里处理结果
 */
const NO_INTERVIEW_MESSAGES = ['面试记录不存在'];

/** open-api 统一包成 500，只能按文案识别「无面试数据」 */
const isNoInterviewError = e => NO_INTERVIEW_MESSAGES.some(text => String(e?.message || '').includes(text));

/** 返回 [{ questionId, fileIds, probeIndex }]；probeIndex 为 null 表示题目本身的录像，否则为第几条追问 */
const collectVideoJobs = interview => {
  const jobs = [];
  const answers = interview?.answers && typeof interview.answers === 'object' ? interview.answers : {};
  const questionList = Array.isArray(interview?.questionList) ? interview.questionList : [];

  const pushJob = (questionId, fileIds, probeIndex = null) => {
    const ids = (Array.isArray(fileIds) ? fileIds : []).map(id => String(id)).filter(Boolean);
    if (!questionId || !ids.length) {
      return;
    }
    jobs.push({ questionId: String(questionId), fileIds: ids, probeIndex });
  };

  questionList.forEach(pq => {
    const qid = pq?.questionDigital?.question?.id || pq?.question?.id || pq?.questionId;
    const answerType = pq?.questionDigital?.question?.answerType || pq?.question?.answerType;
    const answer = answers[qid];
    if (!qid || !answer) {
      return;
    }
    if (answerType === 'video' || (!answerType && Array.isArray(answer.result))) {
      pushJob(qid, answer.result);
    }
    (answer.probeList || []).forEach((probe, index) => {
      pushJob(qid, probe?.result, index);
    });
  });

  Object.entries(answers).forEach(([qid, answer]) => {
    if (jobs.some(job => job.questionId === String(qid) && job.probeIndex == null)) {
      return;
    }
    const answerType = answer?.question?.answerType || answer?.answerType;
    if (answerType === 'video' || (!answerType && Array.isArray(answer?.result))) {
      pushJob(qid, answer.result);
    }
  });

  return jobs;
};

module.exports = { collectVideoJobs, isNoInterviewError };
