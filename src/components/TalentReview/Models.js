import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Flex } from 'antd';
import { createWithRemoteLoader } from '@kne/remote-loader';
import { useIntl } from '@kne/react-intl';
import Fetch from '@kne/react-fetch';
import { Page } from '@kne/system-layout';
import withLocale from './withLocale';
import { StatusTag } from './common';
import { BIZ_UNIT_FILTER, filterValueOf, formatDateTime, localPage } from './constants';
import style from './style.module.scss';

const AiBadge = () => (
  <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 14, height: 14, border: '1px solid var(--primary-color)', borderRadius: 3, fontSize: 8, fontWeight: 600, color: 'var(--primary-color)' }}>
    AI
  </span>
);

const categoryOf = item => (item.clientId ? 'customized' : 'industry');

const ModelTable = ({ remoteModules, data, baseUrl }) => {
  const [BizUnit, TablePageRender, Filter] = remoteModules;
  const { SuperSelectFilterItem } = Filter.fields;
  const { formatMessage } = useIntl();
  const navigate = useNavigate();
  const readonlyTip = formatMessage({ id: 'modelReadonlyTip' });

  const apis = useMemo(
    () => ({
      list: {
        loader: ({ params }) =>
          localPage(data?.pageData, params, (item, filter, keyword) => {
            const category = filterValueOf(filter.category);
            const status = filterValueOf(filter.status);
            if (category && categoryOf(item) !== category) return false;
            if (status && (item.status === 'closed' ? 'closed' : 'open') !== status) return false;
            return (
              !keyword ||
              String(item.name || '')
                .toLowerCase()
                .includes(keyword)
            );
          })
      }
    }),
    [data]
  );

  const getColumns = () => [
    {
      name: 'name',
      title: formatMessage({ id: 'model' }),
      type: 'other',
      width: 320,
      getValueOf: item => (
        <Flex align="center" gap={6} style={{ color: 'var(--primary-color)', cursor: 'pointer' }} onClick={() => navigate(`${baseUrl}/models/${item.id}`)}>
          <AiBadge />
          {item.name}
        </Flex>
      )
    },
    { name: 'category', title: formatMessage({ id: 'category' }), width: 140, getValueOf: item => formatMessage({ id: categoryOf(item) === 'customized' ? 'categoryCustomized' : 'categoryIndustry' }) },
    {
      name: 'status',
      title: formatMessage({ id: 'status' }),
      type: 'other',
      width: 120,
      getValueOf: item => <StatusTag tone={item.status === 'closed' ? 'draft' : 'info'}>{formatMessage({ id: item.status === 'closed' ? 'modelClosed' : 'modelOpen' })}</StatusTag>
    },
    { name: 'creator', title: formatMessage({ id: 'creator' }), width: 140, getValueOf: item => item.options?.creatorName || '-' },
    { name: 'createdAt', title: formatMessage({ id: 'createdDate' }), width: 180, getValueOf: item => formatDateTime(item.createdAt) }
  ];

  const getActionList = ({ data: item, ...actionProps }) => [
    { ...actionProps, data: item, children: formatMessage({ id: 'viewDetail' }), onClick: () => navigate(`${baseUrl}/models/${item.id}`) },
    { ...actionProps, data: item, children: formatMessage({ id: item.status === 'closed' ? 'modelEnable' : 'modelDisable' }), disabled: true, title: readonlyTip },
    { ...actionProps, data: item, children: formatMessage({ id: 'delete' }), disabled: true, title: readonlyTip }
  ];

  return (
    <BizUnit
      isNext
      name="talent-review-model"
      apis={apis}
      getColumns={getColumns}
      getActionList={getActionList}
      filter={{
        list: [
          {
            type: SuperSelectFilterItem,
            props: {
              name: 'category',
              label: formatMessage({ id: 'category' }),
              single: true,
              options: [
                { value: 'industry', label: formatMessage({ id: 'categoryIndustry' }) },
                { value: 'customized', label: formatMessage({ id: 'categoryCustomized' }) }
              ]
            }
          },
          {
            type: SuperSelectFilterItem,
            props: {
              name: 'status',
              label: formatMessage({ id: 'status' }),
              single: true,
              options: [
                { value: 'open', label: formatMessage({ id: 'modelOpen' }) },
                { value: 'closed', label: formatMessage({ id: 'modelClosed' }) }
              ]
            }
          }
        ]
      }}
      options={{
        bizName: formatMessage({ id: 'model' }),
        keywordFilterLabel: formatMessage({ id: 'searchModel' }),
        mapFilterValue: BIZ_UNIT_FILTER,
        tableProps: {
          rowKey: 'id',
          pagination: { pageSize: 20 },
          buttonGroup: { list: [{ type: 'primary', disabled: true, title: readonlyTip, children: formatMessage({ id: 'createModel' }) }] }
        }
      }}
    >
      {renderProps => (
        <Page title={formatMessage({ id: 'aiModels' })}>
          <div className={style['page']}>
            <TablePageRender {...renderProps} withPage={false} />
          </div>
        </Page>
      )}
    </BizUnit>
  );
};

const Models = createWithRemoteLoader({
  modules: ['components-core:Global@usePreset', 'components-admin:BizUnit', 'components-admin:BizUnit@TablePageRender', 'components-core:Filter']
})(
  withLocale(({ remoteModules, baseUrl, guard }) => {
    const [usePreset, ...tableModules] = remoteModules;
    const { apis } = usePreset();
    return guard(<Fetch {...apis.talentSaas.tenant.talentReview.modelList} params={{ perPage: 100, currentPage: 1 }} render={({ data }) => <ModelTable remoteModules={tableModules} data={data} baseUrl={baseUrl} />} />);
  })
);

export default Models;
