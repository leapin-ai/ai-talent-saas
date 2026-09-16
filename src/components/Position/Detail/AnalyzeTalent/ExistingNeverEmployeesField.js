import { createWithRemoteLoader } from '@kne/remote-loader';
import { useIntl } from '@kne/react-intl';
import { useEffect, useMemo, useRef, useState } from 'react';
import style from './style.module.scss';

const mapEmployeeToParticipant = item => {
  if (!item || typeof item !== 'object') {
    return null;
  }
  const name = String(item.name || item.nameEn || '').trim();
  const email = String(item.email || '').trim();
  const phone = String(item.phone || '').trim();
  if (!name && !email && !phone) {
    return null;
  }
  return {
    name,
    email,
    phone,
    employeeId: item.id != null ? String(item.id) : undefined
  };
};

const ExistingNeverEmployeesTable = ({ value, onChange, positionId, TablePage, Table, Filter, apis }) => {
  const { formatMessage } = useIntl();
  const [pageList, setPageList] = useState([]);
  const { selectedRows, getRowSelection } = Table.useSelectedRow({ rowKey: 'id' });
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const listApi = useMemo(() => {
    if (!positionId || !apis?.talentSaas?.tenant?.employee?.list) {
      return null;
    }
    const employeeListApi = apis.talentSaas.tenant.employee.list;
    return Object.assign({}, employeeListApi, {
      params: Object.assign({}, employeeListApi.params || {}, {
        positionId: String(positionId),
        filter: Object.assign({}, employeeListApi.params?.filter || {}, {
          withTalentAnalysis: true,
          lastAssessment: 'never'
        }),
        perPage: 10
      })
    });
  }, [apis, positionId]);

  useEffect(() => {
    const next = (selectedRows || []).map(mapEmployeeToParticipant).filter(Boolean);
    const prev = Array.isArray(value) ? value : [];
    const sameLength = next.length === prev.length;
    const sameIds =
      sameLength &&
      next.every((item, index) => {
        const other = prev[index];
        return (item.employeeId || item.email || item.phone) === (other?.employeeId || other?.email || other?.phone);
      });
    if (!sameIds) {
      onChangeRef.current?.(next);
    }
  }, [selectedRows, value]);

  const columns = useMemo(
    () => [
      {
        name: 'name',
        title: formatMessage({ id: 'position.talentInviteName' }),
        getValueOf: item => item.name || item.nameEn || '—'
      },
      {
        name: 'email',
        title: formatMessage({ id: 'position.talentInviteEmail' }),
        getValueOf: item => item.email || '—'
      },
      {
        name: 'phone',
        title: formatMessage({ id: 'position.talentInvitePhone' }),
        getValueOf: item => item.phone || '—'
      }
    ],
    [formatMessage]
  );

  if (!listApi) {
    return null;
  }

  return (
    <div className={style['invite-existing']}>
      <TablePage
        {...listApi}
        key={`invite-existing-${positionId}`}
        name="invite-existing-never-employees"
        rowKey="id"
        sticky={false}
        horizontalScroller={false}
        scroll={{ x: undefined }}
        columns={columns}
        size="small"
        pagination={{
          paramsType: 'params',
          pageSize: 10,
          forceLoadMore: true,
          loadMore: {
            completeTips: null
          }
        }}
        search={{
          name: 'keyword',
          label: formatMessage({ id: 'position.talentSearchLabel' }),
          placeholder: formatMessage({ id: 'position.talentSearchPlaceholder' })
        }}
        filter={{
          mapFilterValue: nextValue => ({
            positionId: String(positionId),
            filter: Object.assign({}, Filter.getFilterValue(nextValue), {
              withTalentAnalysis: true,
              lastAssessment: 'never'
            })
          })
        }}
        rowSelection={getRowSelection(pageList)}
        selectedRows={selectedRows}
        dataFormat={data => {
          const list = data?.pageData || [];
          queueMicrotask(() => {
            setPageList(list);
          });
          return {
            list,
            total: data?.totalCount || 0
          };
        }}
      />
    </div>
  );
};

const ExistingNeverEmployeesField = createWithRemoteLoader({
  modules: ['components-core:FormInfo', 'components-core:TablePage', 'components-core:TablePage@Table', 'components-core:Filter', 'components-core:Global@usePreset']
})(({ remoteModules, positionId, ...props }) => {
  const [FormInfo, TablePage, Table, Filter, usePreset] = remoteModules;
  const { apis } = usePreset();
  const { useOnChange } = FormInfo.hooks;
  const extrasRef = useRef({ TablePage, Table, Filter, apis, positionId });
  extrasRef.current = { TablePage, Table, Filter, apis, positionId };

  const StableField = useMemo(
    () =>
      function ExistingNeverEmployeesStableField(fieldProps) {
        const extras = extrasRef.current;
        return <ExistingNeverEmployeesTable {...fieldProps} {...extras} />;
      },
    []
  );

  const render = useOnChange(Object.assign({ name: 'existingEmployees' }, props));
  return render(StableField);
});

ExistingNeverEmployeesField.Field = ExistingNeverEmployeesTable;

export default ExistingNeverEmployeesField;
