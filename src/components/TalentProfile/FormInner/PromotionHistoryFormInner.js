import { createWithRemoteLoader } from '@kne/remote-loader';

const PromotionHistoryFormInner = createWithRemoteLoader({
  modules: ['components-core:FormInfo']
})(({ remoteModules }) => {
  const [FormInfo] = remoteModules;
  const { TableList } = FormInfo;
  const { DatePicker, Input } = FormInfo.fields;

  return (
    <TableList
      name="promotionHistory"
      title="晋升历史"
      list={[<DatePicker name="time" label="晋升时间" picker="month" format="YYYY-MM" rule="REQ" />, <Input name="occupation" label="岗位名称" rule="REQ LEN-0-100" />, <Input name="level" label="晋升等级" rule="LEN-0-100" />]}
    />
  );
});

export default PromotionHistoryFormInner;
