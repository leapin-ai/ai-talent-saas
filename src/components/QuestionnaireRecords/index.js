import { Empty, Flex, Tag } from 'antd';
import { CalendarOutlined, CheckCircleOutlined, SendOutlined } from '@ant-design/icons';
import classnames from 'classnames';
import dayjs from 'dayjs';
import { useIntl } from '@kne/react-intl';
import { buildQuestionnaireResponsesExport } from '@components/PositionAnalysisTask/exportInterviewData';
import withLocale from './withLocale';
import style from './style.module.scss';

const formatTime = value => (value ? dayjs(value).format('YYYY-MM-DD HH:mm') : '-');

const isPlainObject = value => value && typeof value === 'object' && !Array.isArray(value);

const NestedValue = ({ value }) => {
  if (Array.isArray(value)) {
    return value.map((item, index) => (
      <div key={index} className={style.nested}>
        <NestedValue value={item} />
      </div>
    ));
  }
  if (isPlainObject(value)) {
    return Object.entries(value).map(([label, item]) => (
      <div key={label}>
        <div className={style.question}>{label}</div>
        <NestedValue value={item} />
      </div>
    ));
  }
  return value == null || value === '' ? '-' : String(value);
};

/** answers 顶层为「分组标题 → 题目」时拆成分组；只有一个分组时不显示组名 */
const toSections = answers => {
  const sections = [];
  const loose = { title: '', items: [] };
  Object.entries(answers || {}).forEach(([key, value]) => {
    if (isPlainObject(value)) {
      sections.push({ title: key, items: Object.entries(value) });
    } else {
      loose.items.push([key, value]);
    }
  });
  if (loose.items.length) {
    sections.unshift(loose);
  }
  if (sections.length === 1) {
    sections[0].title = '';
  }
  return sections;
};

const AnswerSections = ({ answers }) => {
  let index = 0;
  return (
    <div className={style.answers}>
      {toSections(answers).map((section, sectionIndex) => (
        <Flex key={sectionIndex} vertical gap={10}>
          {section.title ? <div className={style['section-title']}>{section.title}</div> : null}
          {section.items.map(([question, value]) => {
            index += 1;
            return (
              <div key={question} className={style.qa}>
                <div className={style.question}>
                  <span className={style['question-index']}>{String(index).padStart(2, '0')}</span>
                  {question}
                </div>
                <div className={style.answer}>
                  <NestedValue value={value} />
                </div>
              </div>
            );
          })}
        </Flex>
      ))}
    </div>
  );
};

const RecordCard = ({ record }) => {
  const { formatMessage } = useIntl();
  const submitted = record.status === 'submitted';
  const expired = !submitted && record.deadline && dayjs(record.deadline).isBefore(dayjs());
  const answers = submitted ? buildQuestionnaireResponsesExport([record])?.[0]?.answers : null;
  const statusTag = submitted ? (
    <Tag color="success">{formatMessage({ id: 'questionnaireRecords.submitted' })}</Tag>
  ) : expired ? (
    <Tag>{formatMessage({ id: 'questionnaireRecords.expired' })}</Tag>
  ) : (
    <Tag color="warning">{formatMessage({ id: 'questionnaireRecords.invited' })}</Tag>
  );

  return (
    <div className={style.record}>
      <div className={style['record-header']}>
        <div className={style['record-title']}>{record.projectName || '-'}</div>
        {statusTag}
      </div>
      <div className={style['record-meta']}>
        {record.createdAt ? (
          <span className={style['record-meta-item']}>
            <SendOutlined />
            {formatMessage({ id: 'questionnaireRecords.sentAt' })} {formatTime(record.createdAt)}
          </span>
        ) : null}
        {record.deadline ? (
          <span className={style['record-meta-item']}>
            <CalendarOutlined />
            {formatMessage({ id: 'questionnaireRecords.deadline' })} {formatTime(record.deadline)}
          </span>
        ) : null}
        {submitted ? (
          <span className={style['record-meta-item']}>
            <CheckCircleOutlined />
            {formatMessage({ id: 'questionnaireRecords.submittedAt' })} {formatTime(record.submittedAt)}
          </span>
        ) : null}
      </div>
      {submitted ? answers ? <AnswerSections answers={answers} /> : null : <div className={style['pending-hint']}>{formatMessage({ id: expired ? 'questionnaireRecords.expiredHint' : 'questionnaireRecords.pendingHint' })}</div>}
    </div>
  );
};

/** 员工补充问卷记录：showSummary 控制顶部发送/提交统计 */
const QuestionnaireRecords = withLocale(({ data, showSummary = true }) => {
  const { formatMessage } = useIntl();
  const list = Array.isArray(data) ? data : [];
  if (!list.length) {
    return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={formatMessage({ id: 'questionnaireRecords.empty' })} />;
  }
  const submittedCount = list.filter(item => item.status === 'submitted').length;
  const summary = [
    { key: 'total', value: list.length, label: formatMessage({ id: 'questionnaireRecords.total' }) },
    { key: 'submitted', value: submittedCount, label: formatMessage({ id: 'questionnaireRecords.submitted' }) },
    { key: 'pending', value: list.length - submittedCount, label: formatMessage({ id: 'questionnaireRecords.invited' }) }
  ];
  return (
    <>
      {showSummary ? (
        <div className={style.summary}>
          {summary.map(item => (
            <div key={item.key} className={style['summary-item']}>
              <span className={classnames(style['summary-value'], style[`summary-value-${item.key}`])}>{item.value}</span>
              <span className={style['summary-label']}>{item.label}</span>
            </div>
          ))}
        </div>
      ) : null}
      <div className={style.list}>
        {list.map(record => (
          <RecordCard key={record.id} record={record} />
        ))}
      </div>
    </>
  );
});

export default QuestionnaireRecords;
