import { createWithRemoteLoader } from '@kne/remote-loader';
import withLocale from '../withLocale';
import { useIntl } from '@kne/react-intl';

const EvidenceFormInner = createWithRemoteLoader({
  modules: ['components-core:FormInfo']
})(
  withLocale(({ remoteModules }) => {
    const { formatMessage } = useIntl();
    const [FormInfo] = remoteModules;
    const { List } = FormInfo;
    const { Input, TextArea, Select } = FormInfo.fields;
    const sourceOptions = [
      { label: formatMessage({ id: 'talentProfile.evidenceSourceCv' }), value: 'cv' },
      { label: formatMessage({ id: 'talentProfile.evidenceSourceLinkedin' }), value: 'linkedin' },
      { label: formatMessage({ id: 'talentProfile.evidenceSourceInterview' }), value: 'ai_interview' },
      { label: formatMessage({ id: 'talentProfile.evidenceSourceProject' }), value: 'project' },
      { label: formatMessage({ id: 'talentProfile.evidenceSourceProfile' }), value: 'profile' }
    ];
    const confidenceOptions = [
      { label: formatMessage({ id: 'talentProfile.confidenceHigh' }), value: 'high' },
      { label: formatMessage({ id: 'talentProfile.confidenceMedium' }), value: 'medium' },
      { label: formatMessage({ id: 'talentProfile.confidenceLow' }), value: 'low' }
    ];

    return (
      <>
        <FormInfo column={1} list={[<Select name="confidence" label={formatMessage({ id: 'talentProfile.confidence' })} options={confidenceOptions} rule="REQ" />]} />
        <List
          name="items"
          title={formatMessage({ id: 'talentProfile.evidenceUsed' })}
          block
          addText={formatMessage({ id: 'talentProfile.editAddEvidence' })}
          itemTitle={({ index }) => formatMessage({ id: 'talentProfile.editEvidenceItem' }, { index: index + 1 })}
          list={[
            <Select name="sourceType" label={formatMessage({ id: 'talentProfile.evidenceSource' })} options={sourceOptions} rule="REQ" />,
            <Input name="title" label={formatMessage({ id: 'talentProfile.editEvidenceTitle' })} rule="LEN-0-200" />,
            <TextArea name="summary" label={formatMessage({ id: 'talentProfile.editEvidenceSummary' })} rule="REQ LEN-1-2000" block />
          ]}
        />
      </>
    );
  })
);

export default EvidenceFormInner;
