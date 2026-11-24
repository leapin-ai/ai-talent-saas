/**
 * 视频录像转写（阿里云录音文件识别）：只转写，返回结果，不做任何业务落库
 * 由 @kne/fastify-task 加载 libs/tasks/invite-video-asr/index.js
 *
 * input = { tenantId, jobs: [{ questionId, fileIds, probeIndex }] }（jobs 由 utils/video-asr 的 collectVideoJobs 生成）
 * 返回 { videoTranscripts: { [questionId]: { fileIds, sentences, text, probes? } }, errors }
 * 结果由发起方在 server.js 里该任务的 handler / errorHandler 中按 task.targetType 自行处理
 */
const { getAsrConfigFromEnv, transcribeFileLink } = require('../../utils/ali-filetrans-asr');

const runner = async (fastify, options, { task, updateProgress }) => {
  const { tenantId, jobs } = task.input || {};
  if (!tenantId || !Array.isArray(jobs)) {
    throw new Error('invite-video-asr 缺少 tenantId / jobs');
  }
  const services = fastify.project?.services;
  if (!services?.aiInterview) {
    throw new Error('aiInterview 服务未就绪');
  }

  const asrConfig = getAsrConfigFromEnv(fastify.config);
  const videoTranscripts = {};
  const errors = [];

  for (let i = 0; i < jobs.length; i++) {
    const job = jobs[i];
    const progress = 10 + Math.floor((i / jobs.length) * 80);
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
            await updateProgress?.(Math.min(90, progress + attempt));
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

    const entry = { fileIds: job.fileIds, sentences: fileSentences, text: fileTexts.join('') };
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
  await updateProgress?.(100);
  return { videoTranscripts, errors };
};

module.exports = runner;
