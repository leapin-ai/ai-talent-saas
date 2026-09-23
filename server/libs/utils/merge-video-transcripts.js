/**
 * 将邀请上的 videoTranscripts 合并进 interview-detail 的 answers.aiResult
 * 供 extractInterviewSignals / InterviewVideoTranscript 使用
 */

const toAiResult = entry => {
  if (!entry) {
    return null;
  }
  if (Array.isArray(entry.sentences) && entry.sentences.length) {
    return entry.sentences.map(item => ({
      message: item.message || item.text || '',
      time: item.beginTime != null ? new Date(Number(item.beginTime)).toISOString() : undefined
    }));
  }
  if (entry.text) {
    return [{ message: String(entry.text) }];
  }
  return null;
};

const mergeVideoTranscriptsIntoInterview = (interview, videoTranscripts) => {
  if (!interview || typeof interview !== 'object' || !videoTranscripts || typeof videoTranscripts !== 'object') {
    return interview;
  }
  const answers = interview.answers && typeof interview.answers === 'object' ? Object.assign({}, interview.answers) : {};
  let changed = false;

  Object.entries(videoTranscripts).forEach(([questionId, entry]) => {
    if (!questionId || !entry) {
      return;
    }
    const prev = answers[questionId] && typeof answers[questionId] === 'object' ? answers[questionId] : {};
    const next = Object.assign({}, prev);
    const aiResult = toAiResult(entry);
    if (aiResult && aiResult.length) {
      next.aiResult = aiResult;
      changed = true;
    }
    if (Array.isArray(entry.probes) && entry.probes.length) {
      const prevProbes = Array.isArray(prev.probeList) ? prev.probeList.slice() : [];
      next.probeList = entry.probes.map((probeEntry, index) => {
        const prevProbe = prevProbes[index] && typeof prevProbes[index] === 'object' ? prevProbes[index] : {};
        const probeAi = toAiResult(probeEntry);
        return Object.assign({}, prevProbe, probeAi && probeAi.length ? { aiResult: probeAi } : {});
      });
      changed = true;
    }
    answers[questionId] = next;
  });

  if (!changed) {
    return interview;
  }
  return Object.assign({}, interview, { answers });
};

module.exports = {
  mergeVideoTranscriptsIntoInterview,
  toAiResult
};
