import { createWithRemoteLoader } from '@kne/remote-loader';
import { useIntl } from '@kne/react-intl';
import { useNavigate, useParams } from 'react-router-dom';
import { App, Button, Flex } from 'antd';
import { MdWorkOutline, MdInfoOutline } from 'react-icons/md';
import { Card } from '@kne/react-box';
import '@kne/react-box/dist/index.css';
import Fetch from '@kne/react-fetch';
import merge from 'lodash/merge';
import { useIsMobile } from '@kne/responsive-utils';
import withLocale from '../withLocale';
import BaseFormInner, { createPaySalary } from '../PositionForm';
import style from './style.module.scss';
import './index.scss';

const FORM_INFO_CLASS = 'position-form-info';
const DEFAULT_PRIMARY = '#4183F0';

const hasValue = value => {
  if (value == null) {
    return false;
  }
  if (typeof value === 'string') {
    return value.replace(/<[^>]*>/g, '').trim().length > 0;
  }
  if (Array.isArray(value)) {
    return value.length > 0;
  }
  if (typeof value === 'object') {
    if (value.id != null || value.value != null) {
      return true;
    }
    if (value.min != null || value.max != null || value.amount != null) {
      return true;
    }
    return Object.keys(value).length > 0;
  }
  return true;
};

const computeCompleteness = formData => {
  const data = formData || {};
  const checks = [
    hasValue(data.name),
    hasValue(data.tenantOrgId),
    hasValue(data.language),
    hasValue(data.locationType),
    data.locationType === 'remote' ? true : hasValue(data.location),
    hasValue(data.capacity),
    hasValue(data.salary),
    hasValue(data.description),
    hasValue(data.requirement)
  ];
  const filled = checks.filter(Boolean).length;
  return Math.round((filled / checks.length) * 100);
};

const CompletenessCard = ({ FormInfo }) => {
  const { useFormContext } = FormInfo;
  const { formData } = useFormContext();
  const { formatMessage } = useIntl();
  const percent = computeCompleteness(formData);

  return (
    <div className={style['completeness-card']}>
      <div className={style['completeness-head']}>
        <p className={style['completeness-label']}>{formatMessage({ id: 'position.completenessTitle' })}</p>
        <span className={style['completeness-percent']}>{percent}%</span>
      </div>
      <div className={style['completeness-track']}>
        <div className={style['completeness-bar']} style={{ width: `${percent}%` }} />
      </div>
      <p className={style['completeness-desc']}>{formatMessage({ id: 'position.completenessDesc' })}</p>
    </div>
  );
};

const FormPageInner = ({ FormInfo, ajax, apis, action, baseUrl, data, cardColor }) => {
  const { Form, SubmitButton } = FormInfo;
  const { message } = App.useApp();
  const { formatMessage } = useIntl();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const isEdit = action === 'edit';
  const themeColor = cardColor || DEFAULT_PRIMARY;

  const goBack = () => {
    navigate(baseUrl ? `${baseUrl}/position` : -1);
  };

  const formData = typeof data === 'object' && data ? data : undefined;

  // 编辑页只改基础字段；不要把 detail 里的 skill/verdict/分析态原样回传（易被空数组盖掉）
  const pickEditablePayload = values => {
    const src = values || {};
    return {
      name: src.name,
      tenantOrgId: src.tenantOrgId,
      language: src.language,
      locationType: src.locationType,
      location: src.location,
      capacity: src.capacity,
      salary: src.salary,
      description: src.description,
      requirement: src.requirement,
      developmentGoal: src.developmentGoal
    };
  };

  const onSubmit = async values => {
    if (isEdit) {
      const payload = pickEditablePayload(values);
      const { data: resData } = await ajax(
        typeof apis.save === 'function'
          ? apis.save({ formData: payload, data, options: {} })
          : merge({}, apis.save, {
              data: Object.assign({}, payload, { id: data.id })
            })
      );
      if (resData.code !== 0) {
        return false;
      }
      message.success(formatMessage({ id: 'position.saveSuccess' }));
    } else {
      const { data: resData } = await ajax(
        typeof apis.create === 'function'
          ? apis.create({ formData: values, options: {} })
          : merge({}, apis.create, {
              data: values
            })
      );
      if (resData.code !== 0) {
        return false;
      }
      message.success(formatMessage({ id: 'position.createSuccess' }));
      const positionId = resData.data?.id;
      if (positionId) {
        navigate(baseUrl ? `${baseUrl}/position/${positionId}` : `/position/${positionId}`, { replace: true });
        return;
      }
    }
    goBack();
  };

  const tips = [formatMessage({ id: 'position.formTip1' }), formatMessage({ id: 'position.formTip2' }), formatMessage({ id: 'position.formTip3' }), formatMessage({ id: 'position.formTip4' })];

  return (
    <Form className={style['form']} data={formData} rules={{ PAY_SALARY: createPaySalary(formatMessage) }} onSubmit={onSubmit}>
      <div className={style['body']}>
        <Card
          className={style['main-card']}
          theme="ribbon"
          color={themeColor}
          hover={false}
          title={
            <Flex align="center" gap={12}>
              <span className={style['section-icon']}>
                <MdWorkOutline size={17} />
              </span>
              <span>{formatMessage({ id: 'position.basicInfo' })}</span>
            </Flex>
          }
          description={formatMessage({ id: 'position.formDescription' })}
        >
          <BaseFormInner apis={apis} className={FORM_INFO_CLASS} outer={<div />} />
        </Card>

        {!isMobile && (
          <aside className={style['aside']}>
            <Card
              theme="inset"
              color={themeColor}
              hover={false}
              title={formatMessage({ id: 'position.formTipsTitle' })}
              extra={<span className={style['tip-count']}>{tips.length}</span>}
              description={formatMessage({ id: 'position.formTipsDesc' })}
            >
              <ul className={style['tip-list']}>
                {tips.map(text => (
                  <li key={text} className={style['tip-item']}>
                    <span className={style['tip-dot']} />
                    <span>{text}</span>
                  </li>
                ))}
              </ul>
              <div className={style['tip-note']}>
                <MdInfoOutline size={15} className={style['tip-note-icon']} />
                <span>{formatMessage({ id: 'position.formTipsNote' })}</span>
              </div>
            </Card>
            <CompletenessCard FormInfo={FormInfo} />
          </aside>
        )}
      </div>

      <div className={style['footer']}>
        <Button onClick={goBack}>{formatMessage({ id: 'position.cancel' })}</Button>
        <SubmitButton type="primary">{isEdit ? formatMessage({ id: 'position.save' }) : formatMessage({ id: 'position.create' })}</SubmitButton>
      </div>
    </Form>
  );
};

const FormPage = createWithRemoteLoader({
  modules: ['components-core:FormInfo', 'components-core:Global@usePreset', 'components-core:Global@useGlobalValue']
})(
  withLocale(({ remoteModules, apis, baseUrl, action: actionProp, children }) => {
    const [FormInfo, usePreset, useGlobalValue] = remoteModules;
    const { ajax } = usePreset();
    const themeToken = useGlobalValue('themeToken') || {};
    const cardColor = themeToken.colorPrimary || DEFAULT_PRIMARY;
    const { formatMessage } = useIntl();
    const { id } = useParams();
    const action = actionProp || (id ? 'edit' : 'create');
    const pageTitle = action === 'edit' ? formatMessage({ id: 'position.editTitle' }) : formatMessage({ id: 'position.createTitle' });

    const renderInner = data => {
      const content = <FormPageInner FormInfo={FormInfo} ajax={ajax} apis={apis} action={action} baseUrl={baseUrl} data={data} cardColor={cardColor} />;
      if (typeof children === 'function') {
        return children({ children: content, title: pageTitle });
      }
      return content;
    };

    if (action === 'edit') {
      return (
        <Fetch
          {...Object.assign({}, apis.detail, {
            params: { id }
          })}
          render={({ data }) => {
            const org = (data.orgEnums || []).find(item => item.value === data.tenantOrgId);
            const prepared = Object.assign({}, data, {
              tenantOrgId: org ? { name: org.description, id: org.value } : data.tenantOrgId
            });
            return renderInner(prepared);
          }}
        />
      );
    }

    return renderInner();
  })
);

export default FormPage;
