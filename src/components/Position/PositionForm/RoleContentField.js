import { useMemo } from 'react';
import { App } from 'antd';
import { useIntl } from '@kne/react-intl';
import SparkIcon from './SparkIcon';
import style from './roleContentField.module.scss';

const PLAIN_TEXT_LENGTH = value => {
  if (value == null || value === '') {
    return 0;
  }
  if (typeof value === 'string') {
    return value.replace(/<[^>]*>/g, '').length;
  }
  return String(value).length;
};

const ImproveWithAiLink = ({ onClick, children }) => (
  <button type="button" className={style['ai-link']} onClick={onClick}>
    <SparkIcon className={style['ai-icon']} />
    <span>{children}</span>
  </button>
);

const RoleContentField = ({ FormInfo, Field, name, label, rule, maxLength, showAiButton, showCounter = true, block, ...fieldProps }) => {
  const { useFormContext } = FormInfo;
  const { formData } = useFormContext();
  const { formatMessage } = useIntl();
  const { message } = App.useApp();

  const required = typeof rule === 'string' && rule.includes('REQ');
  const currentLength = useMemo(() => PLAIN_TEXT_LENGTH(formData?.[name]), [formData, name]);

  const onAiClick = () => {
    message.info(formatMessage({ id: 'position.improveWithAiComingSoon' }));
  };

  return (
    <div className={style.field} data-role-content-field={name}>
      <div className={style['label-row']}>
        <div className={style.label}>
          {label}
          {required ? <span className={style.required}>*</span> : null}
        </div>
        {showAiButton ? <ImproveWithAiLink onClick={onAiClick}>{formatMessage({ id: 'position.improveWithAi' })}</ImproveWithAiLink> : null}
      </div>
      <div className={`${style['input-shell']} ${showCounter ? '' : style['input-shell-no-counter']}`}>
        <Field name={name} labelHidden rule={rule} block={block} maxLength={maxLength} showCount={false} {...fieldProps} />
        {showCounter && maxLength != null ? (
          <div className={style.counter} aria-live="polite">
            {currentLength} / {maxLength}
          </div>
        ) : null}
      </div>
    </div>
  );
};

export default RoleContentField;
