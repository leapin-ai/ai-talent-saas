import { createWithRemoteLoader } from '@kne/remote-loader';
import withLocale from '../withLocale';
import { useIntl } from '@kne/react-intl';

const TargetPositionFormInner = createWithRemoteLoader({
  modules: ['components-core:FormInfo']
})(
  withLocale(({ remoteModules, fieldName = 'name', title, bordered, required = true, positionListApi, mode = 'input' }) => {
    const { formatMessage } = useIntl();
    const [FormInfo] = remoteModules;
    const { MultiField } = FormInfo;
    const { Input, SuperSelect } = FormInfo.fields;
    const rule = required ? 'REQ LEN-0-100' : 'LEN-0-100';

    if (mode === 'select' && positionListApi && SuperSelect) {
      return (
        <FormInfo
          title={title}
          bordered={bordered}
          column={1}
          list={[
            <SuperSelect
              name={fieldName}
              label={formatMessage({ id: 'talentProfile.PositionName' })}
              rule={required ? 'REQ' : undefined}
              labelKey="name"
              valueKey="name"
              interceptor="array-output-value"
              api={Object.assign({}, positionListApi, {
                params: Object.assign({}, positionListApi?.params || {}, { filter: { status: 'published' } })
              })}
              getSearchProps={({ searchText }) => ({
                filter: {
                  keyword: searchText,
                  status: 'published'
                }
              })}
              dataFormat={data => ({
                list: (data.pageData || []).map(item =>
                  Object.assign({}, item, {
                    description: item.description ? String(item.description).replace(/<[^>]*>/g, '') : null
                  })
                ),
                total: data.totalCount
              })}
              pagination={{
                paramsType: 'params'
              }}
            />
          ]}
        />
      );
    }

    return <FormInfo title={title} bordered={bordered} column={1} list={[<MultiField name={fieldName} label={formatMessage({ id: 'talentProfile.PositionName' })} rule={rule} minLength={required ? 1 : 0} field={Input} />]} />;
  })
);

export default TargetPositionFormInner;
