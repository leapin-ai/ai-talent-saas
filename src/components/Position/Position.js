import { createWithRemoteLoader } from '@kne/remote-loader';
import { useIntl } from '@kne/react-intl';
import withLocale from './withLocale';
import getColumns from './getColumns';
import BaseFormInner, { createPaySalary } from './PositionForm';

const Position = createWithRemoteLoader({
  modules: ['components-admin:BizUnit', 'components-admin:Editor']
})(
  withLocale(({ remoteModules, baseUrl, apis, onDetail, ...props }) => {
    const [BizUnit] = remoteModules;
    const { formatMessage } = useIntl();
    return (
      <BizUnit
        {...props}
        apis={apis}
        getColumns={() =>
          getColumns({
            onDetail: colItem => onDetail(colItem),
            formatMessage
          })
        }
        getFormInner={() => <BaseFormInner />}
        name="position"
        options={{
          bizName: formatMessage({ id: 'position.bizName' }),
          formSize: 'default',
          keywordFilterLabel: formatMessage({ id: 'position.keywordFilterLabel' }),
          formProps: {
            rules: { PAY_SALARY: createPaySalary(formatMessage) }
          }
        }}
      />
    );
  })
);

export default Position;
