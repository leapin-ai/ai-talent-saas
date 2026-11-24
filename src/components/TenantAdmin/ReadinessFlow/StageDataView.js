import { useEffect, useState } from 'react';
import { Alert, Space, Spin, Tabs, Typography } from 'antd';
import { createWithRemoteLoader } from '@kne/remote-loader';
import JsonView from '@kne/json-view';
import '@kne/json-view/dist/index.css';
import { useIntl } from '@kne/react-intl';
import dayjs from 'dayjs';
import withLocale from '../withLocale';
import { STATUS_COLOR, notifyError } from './common';
import StageResult, { hasStageResult } from './StageResult';

const JsonBlock = ({ value }) => (value === undefined || value === null ? '-' : <JsonView data={value} theme="light" collapsedFrom={3} />);

/** 某个阶段的全部版本：版本列表 + 选中版本的输入、输出、任务日志 */
const StageDataView = createWithRemoteLoader({
  modules: ['components-core:InfoPage', 'components-core:InfoPage@Content', 'components-core:TablePage@Table', 'components-core:StateTag@StateTagEnum', 'components-core:InfoPage@Flow']
})(
  withLocale(({ remoteModules, versions, call, api }) => {
    const [InfoPage, Content, Table, StateTagEnum, Flow] = remoteModules;
    const { formatMessage } = useIntl();
    const t = id => formatMessage({ id: `tenantAdmin.readiness.${id}`, defaultMessage: id });
    const [selectedId, setSelectedId] = useState(String((versions.find(item => item.isCurrent) || versions[0])?.id || ''));
    const [detail, setDetail] = useState(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
      if (!selectedId) {
        return;
      }
      setLoading(true);
      call(api.stageDetail, { id: selectedId })
        .then(setDetail)
        .catch(notifyError)
        .finally(() => setLoading(false));
    }, [selectedId, call, api.stageDetail]);

    // 任务日志按时间倒序存储，步骤条按发生顺序展示
    const logSteps = [...(detail?.task?.logs || [])].reverse().map(item => ({
      title: item.message,
      time: item.time ? dayjs(item.time).format('HH:mm:ss') : '',
      data: item.data,
      status: item.data?.error ? 'error' : 'finish'
    }));

    const withResult = detail ? hasStageResult(detail.stage, detail.output) : false;
    const tabs = detail
      ? [
          withResult ? { key: 'result', label: t('result.tab'), children: <StageResult stage={detail.stage} output={detail.output} input={detail.input} questionnaire={detail.questionnaire} /> } : null,
          { key: 'output', label: withResult ? t('result.raw') : t('output'), children: <JsonBlock value={detail.output} /> },
          { key: 'input', label: t('input'), children: <JsonBlock value={detail.input} /> },
          {
            key: 'logs',
            label: `${t('taskLogs')}${logSteps.length ? ` (${logSteps.length})` : ''}`,
            children: <Flow dataSource={logSteps} empty="-" columns={[{ name: 'title' }, { type: 'subTitle', name: 'time' }, { type: 'content', name: 'data', render: value => <JsonBlock value={value} /> }]} />
          }
        ].filter(Boolean)
      : [];

    return (
      <InfoPage>
        <Space orientation="vertical" size={24} style={{ display: 'flex' }}>
          {versions.length > 1 ? (
            <InfoPage.Part title={`${t('versions')} (${versions.length})`}>
              <Table
                rowKey="id"
                controllerOpen={false}
                dataSource={versions}
                columns={[
                  { name: 'version', title: t('version'), getValueOf: item => `v${item.version}${item.isCurrent ? ` (${t('currentVersion')})` : ''}` },
                  { name: 'status', title: t('statusLabel'), renderType: 'status', getValueOf: item => ({ type: STATUS_COLOR[item.status] || 'default', text: t(`status.${item.status}`) }) },
                  { name: 'createdAt', title: t('createdAt'), getValueOf: item => dayjs(item.createdAt).format('YYYY-MM-DD HH:mm:ss') },
                  {
                    name: 'options',
                    title: t('actions'),
                    renderType: 'options',
                    getValueOf: item => [{ children: String(item.id) === selectedId ? t('viewing') : t('view'), disabled: String(item.id) === selectedId, onClick: () => setSelectedId(String(item.id)) }]
                  }
                ]}
              />
            </InfoPage.Part>
          ) : null}
          <Spin spinning={loading}>
            {detail ? (
              <InfoPage.Part title={`${t('stageDetail')} · v${detail.version}`}>
                <Space orientation="vertical" size={16} style={{ display: 'flex' }}>
                  {detail.error ? <Alert type="error" showIcon message={detail.error} /> : null}
                  <Content
                    col={2}
                    list={[
                      { label: t('statusLabel'), content: t(`status.${detail.status}`) },
                      { label: t('source'), content: detail.source },
                      { label: t('createdAt'), content: dayjs(detail.createdAt).format('YYYY-MM-DD HH:mm:ss') },
                      {
                        label: t('task'),
                        content: detail.task ? (
                          <Space size={8}>
                            <Typography.Link href={`/admin/task/all?id=${detail.task.id}`} target="_blank">
                              {detail.task.id}
                            </Typography.Link>
                            <StateTagEnum moduleName="taskStatus" name={detail.task.status} />
                          </Space>
                        ) : (
                          '-'
                        )
                      },
                      detail.input?.path ? { label: t('apiPath'), content: detail.input.path } : null
                    ].filter(Boolean)}
                  />
                  <Tabs key={detail.id} defaultActiveKey={detail.status === 'failed' ? 'logs' : withResult ? 'result' : 'output'} items={tabs} />
                </Space>
              </InfoPage.Part>
            ) : null}
          </Spin>
        </Space>
      </InfoPage>
    );
  })
);

export default StageDataView;
