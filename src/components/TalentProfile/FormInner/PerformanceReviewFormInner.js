import { createWithRemoteLoader } from '@kne/remote-loader';
import withLocale from '../withLocale';
import { useIntl } from '@kne/react-intl';

const PerformanceReviewFormInner = createWithRemoteLoader({
  modules: ['components-core:FormInfo']
})(
  withLocale(({ remoteModules }) => {
    const { formatMessage } = useIntl();
    const [FormInfo] = remoteModules;
    const { DatePicker, Input, TextArea, Rate } = FormInfo.fields;

    return (
      <FormInfo
        column={1}
        list={[
          <DatePicker name="date" label={formatMessage({ id: 'talentProfile.ReviewDate' })} rule="REQ" />,
          <Rate name="score" label={formatMessage({ id: 'talentProfile.PerformanceScore' })} rule="REQ" min={0} max={5} />,
          <Input name="evaluatorName" label={formatMessage({ id: 'talentProfile.EvaluatorName' })} rule="REQ LEN-0-50" />,
          <TextArea name="comment" label={formatMessage({ id: 'talentProfile.PerformanceReview' })} rule="LEN-0-1000" block />
        ]}
      />
    );
  })
);

export default PerformanceReviewFormInner;
