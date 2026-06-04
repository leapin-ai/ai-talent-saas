import { createWithRemoteLoader } from '@kne/remote-loader';
import { useMemo } from 'react';
import { Button, Flex } from 'antd';
import merge from 'lodash/merge';
import { Actions } from '@components/Employee';
import PositionFormInner, { createPaySalary } from '@components/Position/PositionForm';
import withLocale, { FormatMessage } from './withLocale';
import { useIntl } from '@kne/react-intl';

const resolvePositionDisplayName = (item, positionList) => {
  const raw = item?.options?.position ?? item?.position;
  if (raw == null || raw === '') {
    return '';
  }
  if (typeof raw === 'object' && raw.name) {
    return String(raw.name).trim();
  }
  if (typeof raw === 'string' && Number.isNaN(Number(raw))) {
    return raw.trim();
  }
  const id = String(typeof raw === 'object' ? raw.id : raw);
  const hit = (positionList || []).find(p => String(p.id) === id);
  return hit?.name ? String(hit.name) : '';
};

const insertAfterKey = (items, key, entry) => {
  const index = items.findIndex(item => item.key === key);
  const next = items.slice();
  next.splice(index >= 0 ? index + 1 : 0, 0, entry);
  return next;
};

/** 邀请 / 加入确认卡片：在角色行后插入岗位等信息 */
export const personalCard = ({ moreInfo, data, positionList }) => {
  if (moreInfo.some(item => item.key === 'position')) {
    return moreInfo;
  }
  const positionName = resolvePositionDisplayName(data, positionList);
  if (!positionName) {
    return moreInfo;
  }
  return insertAfterKey(moreInfo, 'roles', {
    key: 'position',
    label: <FormatMessage id="tenantUser.position" />,
    content: positionName
  });
};

/** 增强用户行数据，将 options.position 从 id 还原为 {id, name} 对象，以便编辑表单回显 */
export const enhanceUserData = async (item, { apis, ajax }) => {
  if (!item) {
    return item;
  }
  const raw = item?.options?.position ?? item?.position;
  // 已经是完整对象，无需处理
  if (raw == null || raw === '' || (typeof raw === 'object' && raw.name)) {
    return item;
  }
  if (!apis?.positionList) {
    return item;
  }
  // 通过 positionList API 获取岗位列表
  const { data: resData } = await ajax(
    merge({}, apis.positionList, {
      params: Object.assign({ perPage: 500, currentPage: 1 }, apis.positionList?.params || {})
    })
  );
  const positionList = resData?.data?.pageData || resData?.data || [];
  const id = String(typeof raw === 'object' ? raw.id : raw);
  const hit = positionList.find(p => String(p.id) === id);
  if (!hit) {
    return item;
  }
  return Object.assign({}, item, {
    options: Object.assign({}, item.options, {
      position: { id: hit.id, name: hit.name }
    })
  });
};

const TenantUserPlugin = createWithRemoteLoader({
  modules: ['components-core:FormInfo', 'components-core:FormInfo@useFormModal', 'components-core:Global@usePreset']
})(
  withLocale(({ remoteModules, list, apis, ...props }) => {
    const { formatMessage } = useIntl();
    const [FormInfo, useFormModal, usePreset] = remoteModules;
    const { SuperSelect, DatePicker } = FormInfo.fields;
    const { ajax } = usePreset();
    const formModal = useFormModal();

    const positionApi = Object.assign({}, apis.positionList, { params: Object.assign({}, apis.positionList?.params || {}, { filter: { status: 'published' } }) });

    const formInnerList = useMemo(() => {
      const newList = list.slice(0);
      newList.splice(
        2,
        0,
        <SuperSelect
          name="options.position"
          label={formatMessage({ id: 'tenantUser.position' })}
          labelKey="name"
          valueKey="id"
          interceptor="object-output-value"
          single
          api={positionApi}
          footer={({ close, reload }) => (
            <Flex justify="center" style={{ padding: '4px 0' }}>
              <Button
                type="link"
                size="small"
                onClick={() => {
                  close();
                  formModal({
                    title: formatMessage({ id: 'tenantUser.addPosition' }),
                    size: 'small',
                    formProps: {
                      rules: { PAY_SALARY: createPaySalary(formatMessage) },
                      onSubmit: async formData => {
                        const { data: resData } = await ajax(
                          Object.assign({}, apis.positionCreate, {
                            data: Object.assign({ status: 'published' }, apis.positionCreate?.data || {}, formData)
                          })
                        );
                        if (resData.code !== 0) {
                          throw new Error(resData.msg || formatMessage({ id: 'tenantUser.addPositionFailed' }));
                        }
                        await reload();
                        return resData.data;
                      }
                    },
                    children: <PositionFormInner />
                  });
                }}
              >
                {formatMessage({ id: 'tenantUser.addPosition' })}
              </Button>
            </Flex>
          )}
        />
      );
      newList.splice(7, 0, <DatePicker name="options.joinDate" label={formatMessage({ id: 'tenantUser.joinDate' })} />, <DatePicker name="options.workStartDate" label={formatMessage({ id: 'tenantUser.workStartDate' })} />);
      return newList;
    }, [ajax, list, formatMessage, apis.positionCreate, positionApi, formModal]);
    return <FormInfo {...props} list={formInnerList} />;
  })
);

export const getUserListColumns = ({ columns }) => {
  const newColumns = columns.slice(0);
  newColumns.splice(
    7,
    0,
    {
      title: <FormatMessage id="tenantUser.position" />,
      name: 'options.position',
      type: 'other',
      valueOf: (item, { data }) => resolvePositionDisplayName(item, data?.positionList)
    },
    {
      title: <FormatMessage id="tenantUser.joinDate" />,
      name: 'options.joinDate',
      type: 'date'
    },
    {
      title: <FormatMessage id="tenantUser.workStartDate" />,
      name: 'options.workStartDate',
      type: 'date'
    }
  );
  return newColumns;
};

const UserListAction = createWithRemoteLoader({
  modules: ['components-core:ButtonGroup']
})(
  withLocale(({ remoteModules, itemClassName, list, moreType, ...props }) => {
    const [ButtonGroup] = remoteModules;
    const actionList = list.slice(0);
    if (props?.data.employee) {
      actionList.splice(
        0,
        0,
        {
          ...props,
          baseUrl: '/tenant',
          buttonComponent: Actions.ViewEmployeeAction
        },
        {
          ...props,
          buttonComponent: Actions.UnlinkEmployeeAction
        }
      );
    } else {
      actionList.splice(0, 0, {
        ...props,
        buttonComponent: Actions.LinkEmployeeAction
      });
    }
    return <ButtonGroup itemClassName={itemClassName} list={actionList} moreType={moreType} />;
  })
);

export const getUserListActions = props => {
  return <UserListAction {...props} />;
};

export default TenantUserPlugin;
