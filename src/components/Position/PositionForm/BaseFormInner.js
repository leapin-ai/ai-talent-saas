import { createWithRemoteLoader } from '@kne/remote-loader';
import withLocale from '../withLocale';
import { useIntl } from '@kne/react-intl';
import { isMobile } from '@kne/system-layout';
import RoleContentField from './RoleContentField';
import JobTitleField from './JobTitleField';
import { buildDetailsFields } from './detailsFields';
import '@kne/pay-details/dist/index.css';

const buildFieldList = ({ variant, FormInfo, apis, formatMessage, mobile, formModal, isEdit, ajax, recordData, detailsDraft, onDetailsDraftChange }) => {
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
    const jobTitle =
      formModal != null
        ? [<JobTitleField key="jobTitle" FormInfo={FormInfo} formModal={formModal} apis={apis} isEdit={isEdit} ajax={ajax} recordData={recordData} detailsDraft={detailsDraft} onDetailsDraftChange={onDetailsDraftChange} />]
        : [];
    return [...jobTitle, ...contentFields];
  }
  return [...detailsFields, ...contentFields];
};

const BaseFormInner = createWithRemoteLoader({
  modules: ['components-core:FormInfo']
})(
  withLocale(({ remoteModules, apis, variant = 'full', formModal, isEdit, ajax, recordData, detailsDraft, onDetailsDraftChange, ...props }) => {
    const [FormInfo] = remoteModules;
    const { formatMessage } = useIntl();
    const mobile = isMobile();
    const list = buildFieldList({ variant, FormInfo, apis, formatMessage, mobile, formModal, isEdit, ajax, recordData, detailsDraft, onDetailsDraftChange });

    return <FormInfo {...props} column={1} list={list} />;
  })
);

export default BaseFormInner;
