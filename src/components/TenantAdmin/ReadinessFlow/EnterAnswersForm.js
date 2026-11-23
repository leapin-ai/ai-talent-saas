import { Flex, Typography } from 'antd';
import { createWithRemoteLoader } from '@kne/remote-loader';
import { useIntl } from '@kne/react-intl';
import withLocale from '../withLocale';

/** 与同步/阶段落库一致的答卷结构示例（题号 → 回答 + 可选视频题） */
export const DEFAULT_ANSWERS_JSON = `{
  "answers": {
    "Q01": "A",
    "Q02": ["A", "B"],
    "Q03": "文本回答"
  },
  "videoAnswers": [
    {
      "questionId": "v1",
      "title": "访谈题标题",
      "transcript": "视频题转写文本",
      "submitted": true,
      "fileIds": []
    }
  ]
}`;

const QUESTIONNAIRE_STAGE = {
  manager: 'manager_questionnaire',
  staff: 'staff_questionnaire',
  reassess: 'reassess'
};

const sampleAnswerForQuestion = question => {
  const type = String(question?.type || '').toLowerCase();
  const options = Array.isArray(question?.options) ? question.options : [];
  const first = options[0];
  const firstValue = first == null ? 'A' : typeof first === 'object' ? (first.value ?? first.key ?? first.label ?? 'A') : String(first);
  if (type === 'multiple' || type === 'multi' || type === 'checkbox') {
    return [String(firstValue)];
  }
  if (type === 'text' || type === 'textarea') {
    return '';
  }
  return String(firstValue);
};

/** 按真实问卷题号 / 访谈题生成默认 JSON；没有题目时用标准示例 */
export const buildAnswersDefaultJson = (questionnaireOutput = {}) => {
  const data = questionnaireOutput?.result && typeof questionnaireOutput.result === 'object' ? questionnaireOutput.result : questionnaireOutput;
  const questions = Array.isArray(data?.questionnaire) && data.questionnaire.length ? data.questionnaire : Array.isArray(data?.reassess?.rows) ? data.reassess.rows : [];
  const interview = Array.isArray(data?.interview) ? data.interview : [];
  if (!questions.length && !interview.length) {
    return DEFAULT_ANSWERS_JSON;
  }
  const answers = {};
  questions.forEach((item, index) => {
    const no = String(item?.no || `Q${String(index + 1).padStart(2, '0')}`);
    answers[no] = sampleAnswerForQuestion(item);
  });
  const videoAnswers = interview.map((item, index) => ({
    questionId: String(item?.id || item?.questionId || `v${index + 1}`),
    title: String(item?.question || item?.title || ''),
    transcript: '',
    submitted: true,
    fileIds: []
  }));
  return `${JSON.stringify({ answers, videoAnswers }, null, 2)}\n`;
};

/** 提交前解析：兼容扁平题号映射，或真实落库结构 { answers, videoAnswers } */
export const parseAnswersValue = value => {
  if (value != null && typeof value === 'object' && !Array.isArray(value)) {
    return value;
  }
  try {
    return JSON.parse(String(value ?? ''));
  } catch (e) {
    return null;
  }
};

/** 解析结果 → submitAnswers 入参；非法或不含有效答卷时返回 null */
export const normalizeAnswersPayload = value => {
  const parsed = parseAnswersValue(value);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return null;
  }
  const wrapped = parsed.answers != null || parsed.videoAnswers != null;
  const answers = wrapped ? (parsed.answers && typeof parsed.answers === 'object' && !Array.isArray(parsed.answers) ? parsed.answers : {}) : parsed;
  const videoAnswers = wrapped && Array.isArray(parsed.videoAnswers) ? parsed.videoAnswers : [];
  if (!Object.keys(answers).length && !videoAnswers.length) {
    return null;
  }
  return { answers, videoAnswers };
};

/** 打开录入弹窗前：尽量按当前问卷版本预填真实题号结构 */
export const loadAnswersDefaultJson = async ({ call, api, runId, kind, personId, stageData }) => {
  const stage = QUESTIONNAIRE_STAGE[kind];
  if (!stage) {
    return DEFAULT_ANSWERS_JSON;
  }
  try {
    let rows = Array.isArray(stageData) ? stageData : null;
    if (!rows) {
      const detail = await call(api.detail, { id: String(runId) });
      rows = detail?.stageData || [];
    }
    const matchPerson = personId ? String(personId) : null;
    const row = rows.find(item => item.stage === stage && item.isCurrent && item.status === 'succeeded' && (matchPerson ? String(item.personId || '') === matchPerson : !item.personId));
    if (!row?.id) {
      return DEFAULT_ANSWERS_JSON;
    }
    const full = await call(api.stageDetail, { id: String(row.id) });
    return buildAnswersDefaultJson(full?.output || {});
  } catch (e) {
    return DEFAULT_ANSWERS_JSON;
  }
};

/** 录入答卷：JSONEditor（Monaco）可编辑、可粘贴；表单值为 JSON 字符串 */
const EnterAnswersForm = createWithRemoteLoader({
  modules: ['components-core:FormInfo', 'components-thirdparty:JSONEditor']
})(
  withLocale(({ remoteModules }) => {
    const [FormInfo, JSONEditor] = remoteModules;
    const { formatMessage } = useIntl();
    const t = (id, values) => formatMessage({ id: `tenantAdmin.readiness.${id}` }, values);

    return (
      <Flex vertical gap={8}>
        <Typography.Text type="secondary">{t('answersTip')}</Typography.Text>
        <FormInfo column={1} list={[<JSONEditor name="answers" label={t('enterAnswers')} rule="REQ" height={360} />]} />
      </Flex>
    );
  })
);

export default EnterAnswersForm;
