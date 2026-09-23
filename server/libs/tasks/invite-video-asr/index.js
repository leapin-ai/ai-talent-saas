/**
 * 邀请触发分析前：视频录像 → 阿里云录音文件识别 → 写 invite.interviewData → 再建完善任务
 * 由 @kne/fastify-task 加载 libs/tasks/invite-video-asr/index.js
 */
const { getAsrConfigFromEnv, transcribeFileLink } = require('../../utils/ali-filetrans-asr');

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

const runner = async (fastify, options, { task, updateProgress }) => {
  const { inviteId, tenantId } = task.input || {};
  if (!inviteId || !tenantId) {
    throw new Error('invite-video-asr 缺少 inviteId / tenantId');
  }

  const services = fastify.project?.services;
  const models = fastify.project?.models;
  if (!services?.talentCollectInvite || !models?.talentCollectInvite) {
    throw new Error('talentCollectInvite 服务未就绪');
  }

  const row = await models.talentCollectInvite.findOne({
    where: { id: String(inviteId), tenantId: String(tenantId) }
  });
  if (!row) {
    throw new Error('邀请记录不存在');
  }

  const patchInterviewData = async patch => {
    await row.reload();
    row.interviewData = Object.assign({}, row.interviewData || {}, patch);
    row.changed('interviewData', true);
    await row.save();
  };

  await patchInterviewData({
    videoAsrStatus: 'running',
    videoAsrTaskId: task.id,
    videoAsrError: null,
    videoAsrStartedAt: new Date().toISOString()
  });

  try {
    await updateProgress?.(5);
    const auth = { tenantId: String(tenantId) };
    const clientUserId = await services.talentCollectInvite.resolveClientUserId(tenantId, row);
    if (!clientUserId) {
      throw new Error('未找到对应面试记录，无法转写');
    }
    const interview = await services.aiInterview.getInterviewDetail({
      tenantId: String(tenantId),
      id: String(clientUserId)
    });
    if (!interview) {
      throw new Error('未找到面试详情，无法转写');
    }

    const jobs = collectVideoJobs(interview);
    const asrConfig = getAsrConfigFromEnv(fastify.config);
    const videoTranscripts = {};
    const errors = [];

    if (!jobs.length) {
      // 无视频题：视为成功空转写，仍继续创建完善任务
      await patchInterviewData({
        videoAsrStatus: 'succeeded',
        videoTranscripts: {},
        videoAsrCompletedAt: new Date().toISOString(),
        videoAsrError: null
      });
      await updateProgress?.(80);
      const analysis = await services.talentCollectInvite.createRefineOrGenerateTask(auth, { id: String(row.id) });
      await updateProgress?.(100);
      return Object.assign({ videoTranscripts: {}, skipped: true }, analysis || {});
    }

    for (let i = 0; i < jobs.length; i++) {
      const job = jobs[i];
      const progress = 10 + Math.floor((i / jobs.length) * 60);
      await updateProgress?.(progress);

      const fileTexts = [];
      const fileSentences = [];
      for (const fileId of job.fileIds) {
        try {
          const fileLink = await services.aiInterview.getFileUrl({ tenantId: String(tenantId), id: fileId });
          const transcribed = await transcribeFileLink(asrConfig, fileLink, {
            maxTimes: 36,
            intervalMs: 10000,
            onPoll: async ({ attempt }) => {
              await updateProgress?.(Math.min(75, progress + attempt));
            }
          });
          fileSentences.push(...(transcribed.sentences || []));
          if (transcribed.text) {
            fileTexts.push(transcribed.text);
          }
        } catch (e) {
          errors.push({ questionId: job.questionId, fileId, probeIndex: job.probeIndex, message: e.message || String(e) });
        }
      }

      const entry = {
        fileIds: job.fileIds,
        sentences: fileSentences,
        text: fileTexts.join('')
      };

      if (job.probeIndex == null) {
        videoTranscripts[job.questionId] = Object.assign({}, videoTranscripts[job.questionId] || {}, entry);
      } else {
        const parent = videoTranscripts[job.questionId] || { fileIds: [], sentences: [], text: '', probes: [] };
        const probes = Array.isArray(parent.probes) ? parent.probes.slice() : [];
        probes[job.probeIndex] = entry;
        videoTranscripts[job.questionId] = Object.assign({}, parent, { probes });
      }
    }

    const hasAnyText = Object.values(videoTranscripts).some(item => item?.text || (item?.probes || []).some(p => p?.text));
    if (!hasAnyText && errors.length) {
      throw new Error(`视频转写全部失败: ${errors.map(e => e.message).join('; ')}`);
    }

    await patchInterviewData({
      videoAsrStatus: 'succeeded',
      videoTranscripts,
      videoAsrErrors: errors.length ? errors : null,
      videoAsrCompletedAt: new Date().toISOString(),
      videoAsrError: null
    });
    await updateProgress?.(85);

    const analysis = await services.talentCollectInvite.createRefineOrGenerateTask(auth, { id: String(row.id) });
    await updateProgress?.(100);
    return Object.assign({ videoTranscripts, errors }, analysis || {});
  } catch (e) {
    try {
      await patchInterviewData({
        videoAsrStatus: 'failed',
        videoAsrError: e.message || String(e),
        videoAsrCompletedAt: new Date().toISOString()
      });
    } catch (saveErr) {
      fastify.log?.error?.(saveErr);
    }
    throw e;
  }
};

module.exports = runner;
