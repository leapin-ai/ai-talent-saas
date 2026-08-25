import { createWithRemoteLoader } from '@kne/remote-loader';
import withLocale from '../../withLocale';
import { useIntl } from '@kne/react-intl';
import { CHANGE_VALUES, IMPORTANCE_MAX, IMPORTANCE_MIN, LEVEL_VALUES, ORIGIN_VALUES } from './skillModel';

const importanceOptions = Array.from({ length: IMPORTANCE_MAX - IMPORTANCE_MIN + 1 }, (_, i) => {
  const value = IMPORTANCE_MIN + i;
  return { label: String(value), value };
});

const SkillFormInner = createWithRemoteLoader({
  modules: ['components-core:FormInfo']
})(
  withLocale(({ remoteModules }) => {
    const [FormInfo] = remoteModules;
    const { Input, Select, TextArea } = FormInfo.fields;
    const { formatMessage } = useIntl();
    const currentYear = new Date().getFullYear();

    return (
      <FormInfo
        column={1}
        list={[
          <Input name="name" label={formatMessage({ id: 'position.skillName' })} rule="REQ LEN-1-200" />,
          <Select
            name="origin"
            label={formatMessage({ id: 'position.skillOrigin' })}
            rule="REQ"
            options={ORIGIN_VALUES.map(value => ({
              label: formatMessage({ id: `position.skillOrigin.${value}` }),
              value
            }))}
          />,
          <Select name="importanceNow" label={formatMessage({ id: 'position.skillImportanceNow' })} rule="REQ" options={importanceOptions} />,
          <Select name="importanceYear" label={formatMessage({ id: 'position.skillImportanceYear' }, { year: currentYear })} rule="REQ" options={importanceOptions} />,
          <Select
            name="change"
            label={formatMessage({ id: 'position.skillChange' })}
            rule="REQ"
            options={CHANGE_VALUES.map(value => ({
              label: formatMessage({ id: `position.skillChange.${value}` }),
              value
            }))}
          />,
          <Select
            name="aiExposure"
            label={formatMessage({ id: 'position.skillAiExposureLabel' })}
            options={LEVEL_VALUES.map(value => ({
              label: formatMessage({ id: `position.skillLevel.${value}` }),
              value
            }))}
          />,
          <Select
            name="confidence"
            label={formatMessage({ id: 'position.skillConfidenceLabel' })}
            options={LEVEL_VALUES.map(value => ({
              label: formatMessage({ id: `position.skillLevel.${value}` }),
              value
            }))}
          />,
          <TextArea name="jdText" label={formatMessage({ id: 'position.skillJdText' })} block rule="LEN-0-2000" />,
          <Input name="jdSource" label={formatMessage({ id: 'position.skillJdSource' })} rule="LEN-0-200" />,
          <TextArea name="shockText" label={formatMessage({ id: 'position.skillShockText' })} block rule="LEN-0-2000" />,
          <Input name="shockSource" label={formatMessage({ id: 'position.skillShockSource' })} rule="LEN-0-200" />
        ]}
      />
    );
  })
);

export default SkillFormInner;
