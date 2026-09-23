import { Empty, Typography } from 'antd';
import style from './interviewVideoTranscript.module.scss';

const joinText = entry => {
  if (!entry) {
    return '';
  }
  if (entry.text) {
    return String(entry.text).trim();
  }
  if (Array.isArray(entry.sentences)) {
    return entry.sentences
      .map(item => item?.message || item?.text || '')
      .filter(Boolean)
      .join('');
  }
  return '';
};

/**
 * 本仓叠层：在 InterviewResultSession 下方展示视频转写（不改 remote Answer）
 */
const InterviewVideoTranscript = ({ interview, videoTranscripts }) => {
  const questionList = Array.isArray(interview?.questionList) ? interview.questionList : [];
  const transcripts = videoTranscripts && typeof videoTranscripts === 'object' ? videoTranscripts : {};
  const answers = interview?.answers && typeof interview.answers === 'object' ? interview.answers : {};

  const items = [];
  questionList.forEach((pq, index) => {
    const qid = pq?.questionDigital?.question?.id || pq?.question?.id || pq?.questionId;
    if (!qid) {
      return;
    }
    const title = pq?.questionDigital?.question?.title || pq?.question?.title || `题目 ${index + 1}`;
    const answerType = pq?.questionDigital?.question?.answerType || pq?.question?.answerType;
    const answer = answers[qid];
    const isVideo = answerType === 'video' || (!answerType && Array.isArray(answer?.result));
    if (!isVideo) {
      return;
    }

    const fromStore = transcripts[qid];
    const fromAiResult = Array.isArray(answer?.aiResult)
      ? answer.aiResult
          .map(row => row?.message || row?.text || '')
          .filter(Boolean)
          .join('')
      : '';
    const text = joinText(fromStore) || fromAiResult;
    items.push({
      key: String(qid),
      title,
      text: text || ''
    });

    (fromStore?.probes || answer?.probeList || []).forEach((probe, probeIndex) => {
      const probeText =
        joinText(fromStore?.probes?.[probeIndex]) ||
        (Array.isArray(probe?.aiResult)
          ? probe.aiResult
              .map(row => row?.message || '')
              .filter(Boolean)
              .join('')
          : '');
      items.push({
        key: `${qid}-probe-${probeIndex}`,
        title: probe?.question?.title || `追问 ${probeIndex + 1}`,
        text: probeText || '',
        isProbe: true
      });
    });
  });

  if (!items.length) {
    return (
      <div className={style.root}>
        <Typography.Text type="secondary" className={style.heading}>
          视频转写
        </Typography.Text>
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无视频转写" />
      </div>
    );
  }

  return (
    <div className={style.root}>
      <Typography.Text strong className={style.heading}>
        视频转写
      </Typography.Text>
      <div className={style.list}>
        {items.map(item => (
          <div key={item.key} className={item.isProbe ? `${style.item} ${style.probe}` : style.item}>
            <div className={style.title}>{item.title}</div>
            <div className={style.body}>{item.text || '暂无转写'}</div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default InterviewVideoTranscript;
