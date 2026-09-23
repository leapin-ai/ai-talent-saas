/**
 * 从 open-api interview-detail 形状中抽取可供 LLM 使用的信号：
 * - 问卷答案 options.questionnaire.answers
 * - 题目作答：文本/选择题直接取 result；视频作答取 aiResult（语音转写）message
 */

const joinAiResult = aiResult => {
  if (!Array.isArray(aiResult) || aiResult.length === 0) {
    return '';
  }
  return aiResult
    .map(row => {
      if (typeof row === 'string') {
        return row.trim();
      }
      if (!row || typeof row !== 'object') {
        return '';
      }
      return String(row.message || row.text || row.content || '').trim();
    })
    .filter(Boolean)
    .join('');
};

const stringifyAnswerResult = (answerType, result) => {
  if (result == null || result === '') {
    return '';
  }
  if (typeof result === 'string') {
    return result.trim();
  }
  if (Array.isArray(result)) {
    // 视频题 result 通常是录像 fileId 列表，正文在 aiResult
    if (answerType === 'video') {
      return '';
    }
    return result
      .map(item => (typeof item === 'string' ? item : item?.label || item?.value || item?.name || ''))
      .filter(Boolean)
      .join(', ');
  }
  if (typeof result === 'object') {
    if (result.text != null && String(result.text).trim()) {
      return String(result.text).trim();
    }
    if (Array.isArray(result.selectedOptions)) {
      return result.selectedOptions
        .map(item => (typeof item === 'string' ? item : item?.label || item?.value || ''))
        .filter(Boolean)
        .join(', ');
    }
    if (result.value != null) {
      return String(result.value).trim();
    }
  }
  return '';
};

const extractProbe = probe => {
  if (!probe || typeof probe !== 'object') {
    return null;
  }
  const title = probe.question?.title || probe.title || '';
  const transcript = joinAiResult(probe.aiResult);
  const textAnswer = stringifyAnswerResult(probe.question?.answerType || 'video', probe.result);
  const answerText = transcript || textAnswer;
  if (!title && !answerText) {
    return null;
  }
  return {
    title,
    answerText,
    transcript: transcript || null
  };
};

const extractOneAnswer = (answerData, fallbackTitle) => {
  if (!answerData || typeof answerData !== 'object') {
    return null;
  }
  const question = answerData.question && typeof answerData.question === 'object' ? answerData.question : {};
  const answerType = question.answerType || answerData.answerType || 'video';
  const title = question.title || fallbackTitle || '';
  const transcript = joinAiResult(answerData.aiResult);
  const textAnswer = stringifyAnswerResult(answerType, answerData.result);
  const answerText = answerType === 'video' ? transcript || textAnswer : textAnswer || transcript;
  const probes = Array.isArray(answerData.probeList) ? answerData.probeList.map(extractProbe).filter(Boolean) : [];
  if (!title && !answerText && probes.length === 0) {
    return null;
  }
  return {
    questionId: question.id || answerData.questionId || null,
    title,
    answerType,
    answerText,
    transcript: transcript || null,
    textAnswer: textAnswer || null,
    probes
  };
};

/**
 * @param {object|null} interview open-api interview-detail
 * @returns {{ questionnaireAnswers: object|null, answers: array, meta: object }}
 */
const extractInterviewSignals = interview => {
  if (!interview || typeof interview !== 'object') {
    return {
      questionnaireAnswers: null,
      answers: [],
      meta: {}
    };
  }

  const questionnaireAnswers = interview.options?.questionnaire?.answers || interview.questionnaire?.answers || interview.questionnaireAnswers || interview.options?.questionnaireAnswers || null;

  const answersMap = interview.answers && typeof interview.answers === 'object' && !Array.isArray(interview.answers) ? interview.answers : {};
  const questionList = Array.isArray(interview.questionList) ? interview.questionList : [];
  const answers = [];
  const seen = new Set();

  questionList.forEach(pq => {
    const qid = pq?.questionDigital?.question?.id || pq?.question?.id || pq?.questionId;
    const title = pq?.questionDigital?.question?.title || pq?.questionDigital?.text || pq?.question?.title || '';
    if (!qid || !answersMap[qid]) {
      return;
    }
    const item = extractOneAnswer(answersMap[qid], title);
    if (item) {
      answers.push(item);
      seen.add(String(qid));
    }
  });

  Object.entries(answersMap).forEach(([qid, answerData]) => {
    if (seen.has(String(qid))) {
      return;
    }
    const item = extractOneAnswer(answerData);
    if (item) {
      answers.push(item);
    }
  });

  return {
    questionnaireAnswers: questionnaireAnswers && typeof questionnaireAnswers === 'object' ? questionnaireAnswers : null,
    answers,
    meta: {
      interviewId: interview.id || null,
      status: interview.status || null,
      projectName: interview.project?.name || null,
      projectId: interview.projectId || interview.project?.id || null
    }
  };
};

module.exports = {
  extractInterviewSignals,
  joinAiResult
};
