import { createWithRemoteLoader } from '@kne/remote-loader';

const PerformanceReviewFormInner = createWithRemoteLoader({
  modules: ['components-core:FormInfo']
})(({ remoteModules }) => {
  const [FormInfo] = remoteModules;
  const { DatePicker, Input, TextArea, Rate } = FormInfo.fields;

  return (
    <FormInfo
      column={1}
      list={[
        <DatePicker name="date" label="评价日期" rule="REQ" />,
        <Rate name="score" label="绩效分数" rule="REQ" min={0} max={5} />,
        <Input name="evaluatorName" label="评价人姓名" rule="REQ LEN-0-50" />,
        <TextArea name="comment" label="绩效评价" rule="LEN-0-1000" block />
      ]}
    />
  );
});

export default PerformanceReviewFormInner;
