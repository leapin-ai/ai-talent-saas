import { Empty, Flex } from 'antd';
import { useIntl } from '@kne/react-intl';
import get from 'lodash/get';
import { getDimensionList } from './constants';
import QuestionnaireView, { hasQuestionnaire } from './QuestionnaireView';
import style from './style.module.scss';

export const ObjectInfo = ({ setting }) => {
  const { formatMessage } = useIntl();
  const config = get(setting, 'questionnaire');
  if (!hasQuestionnaire(config)) return <Empty description={formatMessage({ id: 'questionnaireDisabled' })} />;
  return <QuestionnaireView config={config} />;
};

export const DimensionInfo = ({ project }) => {
  const { formatMessage } = useIntl();
  const dimensions = getDimensionList(project);
  if (!dimensions.length) return <Empty description={formatMessage({ id: 'noDimension' })} />;
  const rows = project.projectQuestions || [];
  return (
    <Flex vertical gap={16}>
      {dimensions.map((dim, index) => {
        const questions = rows.filter(row => (get(row, 'options.projectDimension') || []).includes(dim.type) || (dimensions.length === 1 && !get(row, 'options.projectDimension')));
        return (
          <div key={dim.type} className={style['dimension-block']}>
            <div className={style['dimension-block-title']}>{formatMessage({ id: 'reviewDimensionN' }, { index: index + 1 })}</div>
            <Flex gap={32} style={{ marginBottom: 12 }}>
              <div>
                <div className={style['muted']}>{formatMessage({ id: 'reviewDimension' })}</div>
                <div>{dim.name || formatMessage({ id: dim.type })}</div>
              </div>
              <div>
                <div className={style['muted']}>{formatMessage({ id: 'modelName' })}</div>
                <div>{dim.questionModelName || '-'}</div>
              </div>
            </Flex>
            {questions.length ? (
              questions.map(row => (
                <div key={row.id} className={style['question-item']}>
                  {get(row, 'questionDigital.question.title') || get(row, 'questionDigital.title')}
                </div>
              ))
            ) : (
              <div className={style['muted']}>{formatMessage({ id: 'noQuestions' })}</div>
            )}
          </div>
        );
      })}
    </Flex>
  );
};
