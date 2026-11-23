import { Tag } from 'antd';
import { VideoCameraOutlined } from '@ant-design/icons';
import classnames from 'classnames';
import style from './style.module.scss';

/**
 * 保持题目原顺序分组：条件题（show_if 指向问卷里的前序题）跟在当前分组里；
 * 无条件的题 module 与当前分组不同时才另起分组。与发布到 AI 面试的问卷分块规则一致。
 */
export const groupQuestions = (list, locale) => {
  const nos = new Set(list.map(item => item.no));
  const groups = [];
  let current = null;
  list.forEach(item => {
    const follows = current && item.showIf?.no && nos.has(item.showIf.no);
    const key = item.module || '';
    if (!follows && (!current || current.module !== key)) {
      const info = item.moduleInfo?.[locale] || {};
      current = { key: `${groups.length}`, module: key, title: info.title || key, description: info.description || '', items: [] };
      groups.push(current);
    }
    current.items.push(item);
  });
  return groups;
};

/** 上游选项：[{ label: '选项文案', value: 'A' }]；value 为字母，非数组视为无选项 */
export const parseOptions = value =>
  (Array.isArray(value) ? value : [])
    .map(item => ({
      key: String(item?.value ?? '')
        .trim()
        .toUpperCase(),
      text: String(item?.label ?? '').trim()
    }))
    .filter(option => option.key && option.text);

// 中文问卷的题型为「单选 / 多选」
const SINGLE_TYPES = ['single', 'radio', '单选'];
const MULTIPLE_TYPES = ['multiple', 'multi', 'checkbox', '多选'];

/** 与发布到 AI 面试时的字段类型一致：有选项的单选/多选，其余按文本题 */
const answerTypeOf = (item, options) => {
  const type = String(item.type || '').toLowerCase();
  if (options.length && SINGLE_TYPES.includes(type)) {
    return 'single';
  }
  if (options.length && MULTIPLE_TYPES.includes(type)) {
    return 'multiple';
  }
  return 'text';
};

/** 条件说明：补上前序题的选项文案；选中的选项占多数时改写成「未选择 xx」，避免一长串 */
const showIfText = (showIf, byNo, t) => {
  const source = byNo.get(showIf.no);
  const sourceOptions = source ? parseOptions(source.options) : [];
  let op = showIf.op;
  let keys = showIf.values.map(value => String(value).toUpperCase());
  if (sourceOptions.length && keys.length * 2 > sourceOptions.length && keys.length < sourceOptions.length && keys.every(key => sourceOptions.some(o => o.key === key))) {
    keys = sourceOptions.map(o => o.key).filter(key => !keys.includes(key));
    op = op === 'not_in' ? 'in' : 'not_in';
  }
  const values = keys.map(key => {
    const option = sourceOptions.find(o => o.key === key);
    return option ? `${option.key}. ${option.text}` : key;
  });
  return t(op === 'not_in' ? 'showIfNot' : 'showIf', { no: showIf.no, values: values.join(t('showIfSeparator')) });
};

/** 答卷里的回答 → 选中的选项字母；与选项对不上时按文本回答展示 */
const selectedKeysOf = (value, options) => {
  const keys = (Array.isArray(value) ? value : String(value ?? '').split(/[,，、\s]+/)).map(key => String(key).trim().toUpperCase()).filter(Boolean);
  return keys.length && keys.every(key => options.some(option => option.key === key)) ? keys : [];
};

/** withAnswer：展示答卷（answered 为空即未作答）；确认页不传，只展示题目 */
export const Question = ({ item, byNo, t, withAnswer = false, answered, unanswered }) => {
  const options = parseOptions(item.options);
  const answerType = answerTypeOf(item, options);
  const hasAnswer = withAnswer && answered !== undefined && answered !== null && answered !== '';
  const selected = hasAnswer ? selectedKeysOf(answered, options) : [];
  const textAnswer = hasAnswer && !selected.length ? (Array.isArray(answered) ? answered.join('、') : typeof answered === 'object' ? JSON.stringify(answered) : String(answered)) : null;
  return (
    <div className={style['question']}>
      <span className={style['question-no']}>{item.no}</span>
      <div className={style['question-body']}>
        <div className={style['question-text']}>
          {item.question}
          <Tag className={style['type-tag']} bordered={false} color={answerType === 'single' ? 'blue' : answerType === 'multiple' ? 'purple' : 'default'}>
            {t(`type.${answerType}`)}
          </Tag>
        </div>
        {item.showIf?.values?.length ? <div className={style['show-if']}>{showIfText(item.showIf, byNo, t)}</div> : null}
        {options.length ? (
          <div className={style['options']}>
            {options.map(option => (
              <div key={option.key} className={classnames(style['option'], { [style['option-selected']]: selected.includes(option.key) })}>
                <span className={style['option-key']}>{option.key}</span>
                <span>{option.text}</span>
              </div>
            ))}
          </div>
        ) : null}
        {textAnswer ? <div className={style['answer-text']}>{textAnswer}</div> : null}
        {withAnswer && !hasAnswer ? <div className={style['unanswered']}>{unanswered}</div> : null}
      </div>
    </div>
  );
};

/** 题目分组：模块标题 + 说明 + 题目；t 取 readinessConfirm 文案 */
export const QuestionGroups = ({ groups, byNo, t, answers, unanswered }) =>
  groups.map(group => (
    <div key={group.key} className={style['group']}>
      <div className={style['group-header']}>
        <span>{group.title || t('noModule')}</span>
        <span className={style['group-count']}>{t('groupCount', { count: group.items.length })}</span>
      </div>
      {group.description ? <div className={style['group-description']}>{group.description}</div> : null}
      {group.items.map(item => (
        <Question key={item.no} item={item} byNo={byNo} t={t} withAnswer={!!answers} answered={answers?.[item.no]} unanswered={unanswered} />
      ))}
    </div>
  ));

/** 视频面试题；renderAnswer 用于答卷展示时在题目下放录像与转写 */
export const InterviewList = ({ list, t, renderAnswer }) =>
  list.map((item, index) => (
    <div key={item.no} className={style['interview']}>
      <div className={style['interview-head']}>
        <span className={style['question-no']}>{item.no}</span>
        <Tag icon={<VideoCameraOutlined />} bordered={false}>
          {t('videoAnswer')}
        </Tag>
      </div>
      <div className={style['question-text']}>{item.question}</div>
      {renderAnswer?.(item, index)}
    </div>
  ));
