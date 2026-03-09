import { createWithRemoteLoader } from '@kne/remote-loader';
import { useIntl } from '@kne/react-intl';
import withLocale from './withLocale';
import getColumns from './getColumns';
import BaseFormInner from './PositionForm/BaseFormInner';

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
          bizName: '岗位',
          formSize: 'default',
          keywordFilterLabel: '岗位关键字'
        }}
      />
    );
  })
);

export default Position;
