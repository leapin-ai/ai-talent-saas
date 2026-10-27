import { useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { Alert, Empty, Flex, Spin } from 'antd';
import { createWithRemoteLoader } from '@kne/remote-loader';
import { useIntl } from '@kne/react-intl';
import { useFetch } from '@kne/react-fetch';
import { Page } from '@kne/system-layout';
import withLocale from './withLocale';
import { SectionCard, StatusTag } from './common';
import { formatDateTime } from './constants';
import style from './style.module.scss';

const groupCodeOf = question => {
  const group = (question.groups || [])[0];
  return typeof group === 'object' ? group?.code || group?.name : group;
};

const QuestionList = ({ api, model }) => {
  const { formatMessage } = useIntl();
  const { data, isComplete } = useFetch(Object.assign({}, api, { params: { questionModelId: model.id, language: model.language } }));
  const groups = useMemo(() => {
    const list = (model.groups || []).map(group => ({ code: group.code, name: group.name, questions: [] }));
    const fallback = { code: '', name: formatMessage({ id: 'ungrouped' }), questions: [] };
    (data?.pageData || []).forEach(question => {
      (list.find(group => group.code === groupCodeOf(question)) || fallback).questions.push(question);
    });
    return [...list, fallback].filter(group => group.questions.length);
  }, [data, model.groups, formatMessage]);

  if (!isComplete) return <Spin style={{ display: 'block', padding: 24 }} />;
  if (!groups.length) return <Empty description={formatMessage({ id: 'noQuestions' })} />;
  return groups.map(group => (
    <div key={group.code || 'ungrouped'} className={style['dimension-block']}>
      <Flex justify="space-between" className={style['dimension-block-title']}>
        {group.name}
        <span className={style['grid-badge']}>{group.questions.length}</span>
      </Flex>
      {group.questions.map(question => (
        <div key={question.id} className={style['question-item']}>
          {question.title}
        </div>
      ))}
    </div>
  ));
};

const ModelDetail = createWithRemoteLoader({
  modules: ['components-core:Global@usePreset']
})(
  withLocale(({ remoteModules, guard }) => {
    const [usePreset] = remoteModules;
    const { apis } = usePreset();
    const { formatMessage } = useIntl();
    const { id } = useParams();
    const api = apis.talentSaas.tenant.talentReview;
    const { data: model } = useFetch(Object.assign({}, api.modelDetail, { params: { id } }));
    return guard(
      <Page
        title={
          model ? (
            <Flex align="center" gap={8}>
              {model.name}
              <StatusTag tone={model.status === 'closed' ? 'draft' : 'info'}>{formatMessage({ id: model.status === 'closed' ? 'modelClosed' : 'modelOpen' })}</StatusTag>
            </Flex>
          ) : (
            formatMessage({ id: 'modelDetail' })
          )
        }
        back
      >
        {model ? (
          <div className={style['page']}>
            <Alert type="info" showIcon message={formatMessage({ id: 'modelReadonlyTip' })} />
            <SectionCard title={formatMessage({ id: 'modelDescription' })}>
              <div style={{ whiteSpace: 'pre-wrap' }}>{model.description || '-'}</div>
              <div className={style['muted']} style={{ marginTop: 12, fontSize: 12 }}>
                {formatMessage({ id: 'category' })}：{formatMessage({ id: model.clientId ? 'categoryCustomized' : 'categoryIndustry' })} · {formatMessage({ id: 'createdDate' })}：{formatDateTime(model.createdAt)}
              </div>
            </SectionCard>
            <SectionCard title={formatMessage({ id: 'modelQuestions' })}>
              <QuestionList api={api.modelQuestions} model={model} />
            </SectionCard>
          </div>
        ) : (
          <Spin style={{ display: 'block', padding: 80 }} />
        )}
      </Page>
    );
  })
);

export default ModelDetail;
