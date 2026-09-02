import { createWithRemoteLoader } from '@kne/remote-loader';
import withLocale from '../withLocale';
import { useIntl } from '@kne/react-intl';
import { isMobile } from '@kne/system-layout';
import RoleContentField from './RoleContentField';
import JobTitleField from './JobTitleField';
import { buildDetailsFields } from './detailsFields';
import style from './baseFormInner.module.scss';
import '@kne/pay-details/dist/index.css';

const buildFieldList = ({ variant, FormInfo, apis, formatMessage, mobile, formModal, isEdit, ajax, recordData }) => {
  const { TextArea } = FormInfo.fields;
  const detailsFields = buildDetailsFields({ FormInfo, apis, formatMessage, mobile });

  const contentFields = [
    <RoleContentField key="description" FormInfo={FormInfo} Field={TextArea} name="description" label={formatMessage({ id: 'position.description' })} rule="LEN-0-2000" maxLength={2000} showAiButton block />,
    <RoleContentField key="requirement" FormInfo={FormInfo} Field={TextArea} name="requirement" label={formatMessage({ id: 'position.requirement' })} rule="LEN-0-2000" maxLength={2000} showAiButton block />,
    <RoleContentField key="developmentGoal" FormInfo={FormInfo} Field={TextArea} name="developmentGoal" label={formatMessage({ id: 'position.developmentGoal' })} rule="LEN-0-2000" showCounter={false} block />
  ];

  if (variant === 'details' || variant === 'basic') {
    return detailsFields;
  }
  if (variant === 'content') {
    const jobTitle = formModal != null ? [<JobTitleField key="jobTitle" FormInfo={FormInfo} formModal={formModal} apis={apis} isEdit={isEdit} ajax={ajax} recordData={recordData} />] : [];
    // 隐藏挂载 details：字段仍注册进主表单，setFormData / 底栏提交 / 完整度才能读到
    // required:false，避免底栏提交时在不可见区域报 REQ；完整性由弹窗 + isBasicsComplete 把关
    // display:none 不卸载 React 子树，字段保持注册；合并为一个 list 项避免占多行空白
    const hiddenDetails = (
      <div key="details-hidden" className={style['details-hidden']} data-position-details-hidden aria-hidden="true">
        {buildDetailsFields({ FormInfo, apis, formatMessage, mobile, required: false, orgInterceptor: false })}
      </div>
    );
    return [...jobTitle, hiddenDetails, ...contentFields];
  }
  return [...detailsFields, ...contentFields];
};

const BaseFormInner = createWithRemoteLoader({
  modules: ['components-core:FormInfo']
})(
  withLocale(({ remoteModules, apis, variant = 'full', formModal, isEdit, ajax, recordData, ...props }) => {
    const [FormInfo] = remoteModules;
    const { formatMessage } = useIntl();
    const mobile = isMobile();
    const list = buildFieldList({ variant, FormInfo, apis, formatMessage, mobile, formModal, isEdit, ajax, recordData });

    return <FormInfo {...props} column={1} list={list} />;
  })
);

export default BaseFormInner;
