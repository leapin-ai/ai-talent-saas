import { useCallback, useRef } from 'react';
import { App, Button } from 'antd';
import { MdOutlineEdit } from 'react-icons/md';
import { useIntl } from '@kne/react-intl';
import { isMobile } from '@kne/system-layout';
import SparkIcon from './SparkIcon';
import { createPaySalary } from './PAY_SALARY';
import { buildDetailsFields } from './detailsFields';
import { pickDetailsFormData, toSavePayload } from './payload';
import { savePosition } from './savePosition';
import style from './jobTitleField.module.scss';

const FORM_INFO_CLASS = 'position-form-info';

const TaxonomyLink = ({ onClick, children }) => (
  <button type="button" className={style['taxonomy-link']} onClick={onClick}>
    <SparkIcon className={style['taxonomy-icon']} size={11} />
    <span>{children}</span>
  </button>
);

const JobTitleField = ({ FormInfo, formModal, apis, isEdit, ajax, recordData }) => {
  const { useFormContext, fields } = FormInfo;
  const FormInfoList = FormInfo;
  const { Input } = fields;
  const { formData, openApi } = useFormContext();
  const { formatMessage } = useIntl();
  const { message } = App.useApp();
  const formDataRef = useRef(formData);
  formDataRef.current = formData;
  const jobTitleLabel = formatMessage({ id: 'position.name' });
  const mobile = isMobile();

  const getFormSnapshot = useCallback(() => {
    return openApi?.getFormData?.() ?? formDataRef.current ?? {};
  }, [openApi]);

  const openDetailsModal = useCallback(() => {
    const snapshot = getFormSnapshot();
    formModal({
      title: formatMessage({ id: 'position.editBasicsTitle' }),
      size: 'small',
      formProps: {
        data: pickDetailsFormData(snapshot),
        rules: { PAY_SALARY: createPaySalary(formatMessage) },
        onError: () => {
          message.warning(formatMessage({ id: 'position.completeBasicsHint' }));
        },
        onSubmit: async values => {
          const live = getFormSnapshot();
          const details = pickDetailsFormData(values);
          const merged = Object.assign({}, live, details);
          openApi.setFormData(merged, false);
          if (isEdit) {
            const payload = toSavePayload(merged);
            const resData = await savePosition({ ajax, apis, payload, record: recordData || merged });
            if (resData.code !== 0) {
              throw new Error(resData.msg || formatMessage({ id: 'position.saveFailed' }));
            }
            message.success(formatMessage({ id: 'position.saveSuccess' }));
          }
        }
      },
      children: <FormInfoList column={1} className={FORM_INFO_CLASS} list={buildDetailsFields({ FormInfo, apis, formatMessage, mobile, required: true, orgInterceptor: false })} />
    });
  }, [ajax, apis, formModal, formatMessage, FormInfo, FormInfoList, getFormSnapshot, isEdit, message, mobile, openApi, recordData]);

  const onTaxonomyClick = () => {
    message.info(formatMessage({ id: 'position.matchedInTaxonomyComingSoon' }));
  };

  return (
    <div className={style.field} data-job-title-field>
      <div className={style['label-row']}>
        <div className={style.label}>
          {jobTitleLabel}
          <span className={style.required}>*</span>
        </div>
        <Button type="text" className={style['edit-btn']} icon={<MdOutlineEdit size={18} />} aria-label={formatMessage({ id: 'position.editBasicsTitle' })} onClick={openDetailsModal} />
      </div>
      <div className={style['input-wrapper']}>
        <div className={style['input-area']}>
          <div className={style['input-row']}>
            <Input name="name" label={jobTitleLabel} labelHidden rule="REQ LEN-0-200" variant="borderless" />
            <TaxonomyLink onClick={onTaxonomyClick}>{formatMessage({ id: 'position.matchedInTaxonomy' })}</TaxonomyLink>
          </div>
        </div>
      </div>
    </div>
  );
};

export default JobTitleField;
