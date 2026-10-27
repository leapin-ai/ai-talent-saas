import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Alert, App, Button } from 'antd';
import { ArrowRightOutlined } from '@ant-design/icons';
import { createWithRemoteLoader } from '@kne/remote-loader';
import { useIntl } from '@kne/react-intl';
import { useFetch } from '@kne/react-fetch';
import { Page } from '@kne/system-layout';
import withLocale from '../withLocale';
import { SectionCard, StepBar } from '../common';
import { useApiAction } from '../useApiAction';
import InfoFields from '../InfoFields';
import { DimensionInfo, ObjectInfo } from '../ProjectReadonly';
import StepObject from './StepObject';
import StepDimension from './StepDimension';
import StepAssessment from './StepAssessment';
import { buildPayload, initialValue, projectToValue } from './utils';
import style from '../style.module.scss';

const ProjectCreate = createWithRemoteLoader({
  modules: ['components-core:Global@usePreset', 'components-core:FormInfo']
})(
  withLocale(({ remoteModules, baseUrl, guard, project }) => {
    const [usePreset, FormInfo] = remoteModules;
    const { Form, SubmitButton } = FormInfo;
    const { apis } = usePreset();
    const api = apis.talentSaas.tenant.talentReview;
    const { formatMessage, locale } = useIntl();
    const { message, modal } = App.useApp();
    const navigate = useNavigate();
    const [step, setStep] = useState(0);
    const [value, setValue] = useState(() => (project ? projectToValue(project, { ungroupedLabel: formatMessage({ id: 'ungrouped' }) }) : initialValue()));
    const [run, submitting] = useApiAction(usePreset);
    const { data: orgSource } = useFetch(api.orgSource);
    const { data: modelData } = useFetch(Object.assign({}, api.modelList, { params: { perPage: 100, currentPage: 1 } }));
    const ownerOptions = useMemo(() => {
      const options = (orgSource?.employees || []).map(item => ({ value: item.id, label: item.name }));
      const owner = value.info.owner;
      return owner && !options.some(item => item.value === owner.value) ? [owner, ...options] : options;
    }, [orgSource, value.info.owner]);
    const models = useMemo(() => (modelData?.pageData || []).filter(item => item.status !== 'closed'), [modelData]);
    const dimensionTypes = value.dimensions.filter(item => item.type && item.modelId).map(item => item.type);
    const isEdit = !!project;
    const dimensionEditable = !isEdit || project.sourceType === 'client';
    const questionsApi = useMemo(() => (isEdit ? Object.assign({}, api.modelQuestions, { params: { digitalId: project.digitalId } }) : api.modelQuestions), [api.modelQuestions, isEdit, project]);

    const groupNameRestored = useRef(false);
    useEffect(() => {
      if (!project || !modelData || groupNameRestored.current) return;
      groupNameRestored.current = true;
      const { dimensions, groupOrder } = projectToValue(project, { models: modelData.pageData || [], ungroupedLabel: formatMessage({ id: 'ungrouped' }) });
      setValue(current => Object.assign({}, current, { dimensions, groupOrder }));
    }, [project, modelData, formatMessage]);

    const steps = [formatMessage({ id: 'stepReviewInfo' }), formatMessage({ id: 'stepObjectInfo' }), formatMessage({ id: 'stepReviewDimension' }), formatMessage({ id: 'stepAssessmentSetting' })];

    const exit = () =>
      modal.confirm({
        title: formatMessage({ id: 'exitConfirm' }),
        onOk: () => navigate(isEdit ? `${baseUrl}/projects/${project.id}` : `${baseUrl}/projects`)
      });

    const submitInfo = info => {
      setValue(current => Object.assign({}, current, { info }));
      setStep(1);
    };

    const next = () => {
      if (step === 2 && dimensionEditable) {
        const valid = value.dimensions.filter(item => item.type && item.modelId && Object.keys(item.selected).length);
        if (!valid.length || valid.length !== value.dimensions.filter(item => item.type || item.modelId).length) {
          message.error(formatMessage({ id: 'dimensionRequired' }));
          return;
        }
      }
      setStep(step + 1);
    };

    const submit = async () => {
      const payload = buildPayload(value, {
        locale,
        questionnaireTitle: formatMessage({ id: 'stepObjectInfo' }),
        dimensionName: type => formatMessage({ id: type })
      });
      if (!isEdit) {
        const result = await run(api.projectCreate, payload, formatMessage({ id: 'createSuccess' }));
        result && navigate(`${baseUrl}/projects`);
        return;
      }
      if (!dimensionEditable || value.questionnaireLocked) delete payload.setting.questionnaire;
      const result = await run(api.projectSave, Object.assign({ id: project.id }, payload), formatMessage({ id: 'saveSuccess' }));
      result && navigate(`${baseUrl}/projects/${project.id}`);
    };

    const readonlyTip = id => <Alert type="info" showIcon message={formatMessage({ id })} style={{ marginBottom: 16 }} />;

    const renderObject = () => {
      if (dimensionEditable && !value.questionnaireLocked) {
        return <StepObject questions={value.questions} onChange={questions => setValue(current => Object.assign({}, current, { questions }))} />;
      }
      return (
        <>
          {readonlyTip(dimensionEditable ? 'questionnaireReadonly' : 'adminProjectReadonly')}
          <SectionCard title={formatMessage({ id: 'reviewObjectInfo' })}>
            <ObjectInfo setting={project.setting} />
          </SectionCard>
        </>
      );
    };

    const renderDimension = () => {
      if (dimensionEditable) {
        return <StepDimension value={value} models={models} questionsApi={questionsApi} onChange={setValue} />;
      }
      return (
        <>
          {readonlyTip('adminProjectReadonly')}
          <SectionCard title={formatMessage({ id: 'addReviewDimension' })}>
            <DimensionInfo project={project} />
          </SectionCard>
        </>
      );
    };

    return guard(
      <Page title={formatMessage({ id: isEdit ? 'editProject' : 'newReviewProject' })} back>
        <Form data={isEdit ? value.info : { language: 'zh-CN' }} onSubmit={submitInfo}>
          <div className={style['page']}>
            <StepBar items={steps} current={step} />
            <div className={style['card']} style={{ padding: 0, overflow: 'hidden' }}>
              <div style={{ padding: 24 }}>
                <div style={{ display: step === 0 ? 'block' : 'none' }}>
                  <InfoFields ownerOptions={ownerOptions} />
                </div>
                {step === 1 ? renderObject() : null}
                {step === 2 ? renderDimension() : null}
                {step === 3 ? (
                  <StepAssessment
                    value={value.assessment}
                    dimensionTypes={dimensionTypes}
                    enablePerformance={value.performance.enable}
                    locale={locale}
                    onChange={assessment => setValue(current => Object.assign({}, current, { assessment }))}
                  />
                ) : null}
              </div>
            </div>
          </div>
          <Page.Footer>
            <Button onClick={exit}>{formatMessage({ id: 'exit' })}</Button>
            {step > 0 ? <Button onClick={() => setStep(step - 1)}>{formatMessage({ id: 'back' })}</Button> : null}
            {step === 0 ? (
              <SubmitButton type="primary">
                {formatMessage({ id: 'next' })} <ArrowRightOutlined />
              </SubmitButton>
            ) : step < steps.length - 1 ? (
              <Button type="primary" onClick={next}>
                {formatMessage({ id: 'next' })} <ArrowRightOutlined />
              </Button>
            ) : (
              <Button type="primary" loading={submitting} onClick={submit}>
                {formatMessage({ id: 'save' })} <ArrowRightOutlined />
              </Button>
            )}
          </Page.Footer>
        </Form>
      </Page>
    );
  })
);

export default ProjectCreate;
