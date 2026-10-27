import classnames from 'classnames';
import { Button, Flex, Tooltip } from 'antd';
import { FileTextOutlined, ProfileOutlined } from '@ant-design/icons';
import { createWithRemoteLoader } from '@kne/remote-loader';
import { useIntl } from '@kne/react-intl';
import { LANGUAGES } from './constants';
import style from './style.module.scss';

const SectionTitle = ({ icon, children }) => (
  <Flex component="span" align="center" gap={8} style={{ display: 'inline-flex' }}>
    <span className={style['card-title-icon']}>{icon}</span>
    {children}
  </Flex>
);

/** 「Review Information」两组表单（须放在 FormInfo 的 Form 内）；disabled 时用于详情只读 */
const InfoFields = createWithRemoteLoader({
  modules: ['components-core:FormInfo']
})(({ remoteModules, disabled, ownerOptions = [] }) => {
  const [FormInfo] = remoteModules;
  const { Input, TextArea, Select, DateRangePicker } = FormInfo.fields;
  const { formatMessage } = useIntl();
  const req = rule => (disabled ? undefined : rule);
  const rangePlaceholder = [formatMessage({ id: 'startDatePlaceholder' }), formatMessage({ id: 'endDatePlaceholder' })];
  return (
    <Flex vertical gap={24} className={classnames(style['info-form'], style['info-flat'])}>
      <FormInfo
        title={<SectionTitle icon={<ProfileOutlined />}>{formatMessage({ id: 'projectBasicInfo' })}</SectionTitle>}
        column={2}
        list={[
          <Input name="name" label={formatMessage({ id: 'reviewName' })} rule={req('REQ LEN-0-100')} placeholder={formatMessage({ id: 'projectNamePlaceholder' })} disabled={disabled} block />,
          <DateRangePicker name="period" label={formatMessage({ id: 'reviewPeriod' })} rule={req('REQ')} placeholder={rangePlaceholder} disabled={disabled} block />,
          <Select
            name="language"
            label={formatMessage({ id: 'language' })}
            rule={req('REQ')}
            placeholder={formatMessage({ id: 'select' })}
            options={LANGUAGES.map(item => ({ value: item.value, label: formatMessage({ id: item.labelId }) }))}
            disabled={disabled}
          />,
          <Select name="owner" label={formatMessage({ id: 'projectOwner' })} labelInValue showSearch optionFilterProp="label" allowClear placeholder={formatMessage({ id: 'select' })} options={ownerOptions} disabled={disabled} />
        ]}
      />
      <FormInfo
        title={<SectionTitle icon={<FileTextOutlined />}>{formatMessage({ id: 'reviewDescription' })}</SectionTitle>}
        extra={
          disabled ? null : (
            <Tooltip title={formatMessage({ id: 'notSupported' })}>
              <Button size="small" disabled>
                {formatMessage({ id: 'oneClickGeneration' })}
              </Button>
            </Tooltip>
          )
        }
        column={1}
        list={[<TextArea name="description" rule={req('LEN-0-2000')} rows={4} placeholder={formatMessage({ id: 'descriptionPlaceholder' })} disabled={disabled} block />]}
      />
    </Flex>
  );
});

export default InfoFields;
