import { useEffect, useState } from 'react';
import { Alert, Badge, Button, Flex, Spin, Tabs, Tag, Typography, message } from 'antd';
import { DiffOutlined, EditOutlined, RollbackOutlined } from '@ant-design/icons';
import { createWithRemoteLoader } from '@kne/remote-loader';
import JsonView from '@kne/json-view';
import '@kne/json-view/dist/index.css';
import { useIntl } from '@kne/react-intl';
import classnames from 'classnames';
import dayjs from 'dayjs';
import withLocale from '../withLocale';
import { STATUS_COLOR, notifyError } from './common';
import StageResult, { hasStageResult } from './StageResult';
import style from './StageDataView.module.scss';

const JsonBlock = ({ value }) => (value === undefined || value === null ? '-' : <JsonView data={value} theme="light" collapsedFrom={3} />);

const Loading = () => (
  <Flex justify="center" style={{ padding: 48 }}>
    <Spin />
  </Flex>
);

/** 修改输出弹窗：JSONEditor 编辑当前版本输出 */
const EditOutputForm = createWithRemoteLoader({
  modules: ['components-core:FormInfo', 'components-thirdparty:JSONEditor']
})(({ remoteModules, tip }) => {
  const [FormInfo, JSONEditor] = remoteModules;
  return (
    <Flex vertical gap={8}>
      <Alert type="warning" showIcon message={tip} />
      <FormInfo column={1} list={[<JSONEditor name="output" rule="REQ" height={480} />]} />
    </Flex>
  );
});

/** 两个版本的输出对比：左侧 from，右侧 to */
const VersionDiff = createWithRemoteLoader({
  modules: ['components-thirdparty:DiffEditor']
})(({ remoteModules, call, api, from, to }) => {
  const [DiffEditor] = remoteModules;
  const [outputs, setOutputs] = useState(null);
  useEffect(() => {
    Promise.all([from, to].map(item => call(api.stageDetail, { id: String(item.id) })))
      .then(([a, b]) => setOutputs({ original: a?.output ?? {}, modified: b?.output ?? {} }))
      .catch(notifyError);
  }, [call, api.stageDetail, from, to]);
  if (!outputs) {
    return <Loading />;
  }
  return (
    <Flex vertical gap={8}>
      <div className={style.diffLabels}>
        <span>{`v${from.version}`}</span>
        <span>{`v${to.version}`}</span>
      </div>
      <DiffEditor height={560} original={outputs.original} modified={outputs.modified} />
    </Flex>
  );
});

/** 某个阶段的全部版本：左侧版本列表，右侧选中版本的结果、输出、输入与任务日志；可对比版本、退回并应用历史版本、修改当前输出 */
const StageDataView = createWithRemoteLoader({
  modules: ['components-core:StateTag@StateTagEnum', 'components-core:InfoPage@Flow', 'components-core:Modal@useConfirmModal', 'components-core:FormInfo@useFormModal', 'components-core:Modal@useModal']
})(
  withLocale(({ remoteModules, versions, call, api, restorable, resetsAll, onApply }) => {
    const [StateTagEnum, Flow, useConfirmModal, useFormModal, useModal] = remoteModules;
    const confirmModal = useConfirmModal();
    const formModal = useFormModal();
    const modal = useModal();
    const { formatMessage } = useIntl();
    const t = (id, values) => formatMessage({ id: `tenantAdmin.readiness.${id}`, defaultMessage: id }, values);
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

    const currentVersion = versions.find(item => item.isCurrent && item.status === 'succeeded');
    const versionOf = id => versions.find(item => String(item.id) === String(id));

    const applyVersion = item =>
      confirmModal({
        title: `${t('applyVersion')} · v${item.version}`,
        message: t(resetsAll ? 'applyVersionRoleConfirm' : 'applyVersionConfirm', { version: item.version }),
        danger: true,
        onConfirm: () => onApply({ id: String(item.id) }, 'applyVersionSuccess')
      });

    const openDiff = (from, to) =>
      modal({
        title: `${t('compareVersions')} · v${from.version} → v${to.version}`,
        size: 'large',
        footer: null,
        children: <VersionDiff call={call} api={api} from={from} to={to} />
      });

    const editOutput = () => {
      const formApi = formModal({
        title: `${t('editOutput')} · v${detail.version}`,
        size: 'large',
        saveText: t('editOutputSave'),
        formProps: {
          data: { output: JSON.stringify(detail.output ?? {}, null, 2) },
          onSubmit: async formData => {
            let output;
            try {
              output = JSON.parse(formData.output);
            } catch (e) {
              message.error(t('editOutputInvalid'));
              return false;
            }
            if (output === null || typeof output !== 'object') {
              message.error(t('editOutputInvalid'));
              return false;
            }
            if (JSON.stringify(output) === JSON.stringify(detail.output ?? {})) {
              message.warning(t('editOutputUnchanged'));
              return false;
            }
            const result = await onApply({ id: String(detail.id), output }, 'editOutputSuccess');
            if (!result) {
              return false;
            }
            formApi.close();
          }
        },
        children: <EditOutputForm tip={t(resetsAll ? 'editOutputRoleTip' : 'editOutputTip')} />
      });
    };

    const tagsOf = item => (
      <>
        {item.isCurrent ? (
          <Tag bordered={false} color="processing" className={style.tag}>
            {t('currentVersion')}
          </Tag>
        ) : null}
        {item.origin ? (
          <Tag bordered={false} color={item.origin.type === 'edit' ? 'orange' : 'purple'} className={style.tag}>
            {t(`origin.${item.origin.type}`)}
          </Tag>
        ) : null}
      </>
    );

    const renderDetail = () => {
      if (!detail) {
        return <Loading />;
      }
      const withResult = hasStageResult(detail.stage, detail.output);
      const fromVersion = detail.origin ? versionOf(detail.origin.fromId) : null;
      const succeeded = detail.status === 'succeeded';
      // 任务日志按时间倒序存储，步骤条按发生顺序展示
      const logSteps = [...(detail.task?.logs || [])].reverse().map(item => ({
        title: item.message,
        time: item.time ? dayjs(item.time).format('HH:mm:ss') : '',
        data: item.data,
        status: item.data?.error ? 'error' : 'finish'
      }));
      const tabs = [
        withResult ? { key: 'result', label: t('result.tab'), children: <StageResult stage={detail.stage} output={detail.output} input={detail.input} questionnaire={detail.questionnaire} /> } : null,
        { key: 'output', label: withResult ? t('result.raw') : t('output'), children: <JsonBlock value={detail.output} /> },
        { key: 'input', label: t('input'), children: <JsonBlock value={detail.input} /> },
        {
          key: 'logs',
          label: `${t('taskLogs')}${logSteps.length ? ` (${logSteps.length})` : ''}`,
          children: <Flow dataSource={logSteps} empty="-" columns={[{ name: 'title' }, { type: 'subTitle', name: 'time' }, { type: 'content', name: 'data', render: value => <JsonBlock value={value} /> }]} />
        }
      ].filter(Boolean);
      const facts = [
        detail.input?.path ? { key: 'path', label: t('apiPath'), content: <span className={style.factCode}>{detail.input.path}</span> } : null,
        detail.task
          ? {
              key: 'task',
              label: t('task'),
              content: (
                <Flex gap={6} align="center">
                  <Typography.Link href={`/admin/task/all?id=${detail.task.id}`} target="_blank">
                    {detail.task.id}
                  </Typography.Link>
                  <StateTagEnum moduleName="taskStatus" name={detail.task.status} />
                </Flex>
              )
            }
          : null
      ].filter(Boolean);
      const actions = [
        detail.origin?.type === 'edit' && fromVersion ? (
          <Button key="changes" icon={<DiffOutlined />} onClick={() => openDiff(fromVersion, detail)}>
            {t('origin.viewChanges')}
          </Button>
        ) : null,
        !detail.isCurrent && succeeded && currentVersion ? (
          <Button key="compare" icon={<DiffOutlined />} onClick={() => openDiff(detail, currentVersion)}>
            {t('compareWithCurrent')}
          </Button>
        ) : null,
        restorable && !detail.isCurrent && succeeded ? (
          <Button key="apply" danger icon={<RollbackOutlined />} onClick={() => applyVersion(detail)}>
            {t('applyVersion')}
          </Button>
        ) : null,
        restorable && detail.isCurrent && succeeded ? (
          <Button key="edit" type="primary" icon={<EditOutlined />} onClick={editOutput}>
            {t('editOutput')}
          </Button>
        ) : null
      ].filter(Boolean);

      return (
        <Spin spinning={loading}>
          <section className={style.detail}>
            <div className={style.summary}>
              <div className={style.detailHead}>
                <div className={style.detailHeadline}>
                  <div className={style.detailTitleRow}>
                    <span className={style.detailTitle}>{`v${detail.version}`}</span>
                    {tagsOf(detail)}
                  </div>
                  <div className={style.detailMeta}>
                    <Badge status={STATUS_COLOR[detail.status] || 'default'} text={t(`status.${detail.status}`)} />
                    <span>{dayjs(detail.createdAt).format('YYYY-MM-DD HH:mm:ss')}</span>
                    <span>{t(`sourceLabel.${detail.source}`)}</span>
                    {detail.origin ? (
                      fromVersion ? (
                        <Typography.Link onClick={() => setSelectedId(String(fromVersion.id))}>{t('origin.from', { version: detail.origin.fromVersion })}</Typography.Link>
                      ) : (
                        <span>{t('origin.from', { version: detail.origin.fromVersion })}</span>
                      )
                    ) : null}
                  </div>
                </div>
                {actions.length ? <div className={style.detailActions}>{actions}</div> : null}
              </div>
              {facts.length ? (
                <dl className={style.facts}>
                  {facts.map(item => (
                    <div key={item.key} className={style.fact}>
                      <dt>{item.label}</dt>
                      <dd>{item.content}</dd>
                    </div>
                  ))}
                </dl>
              ) : null}
            </div>
            {detail.error ? <Alert type="error" showIcon message={detail.error} /> : null}
            <Tabs key={detail.id} defaultActiveKey={detail.status === 'failed' ? 'logs' : withResult ? 'result' : 'output'} items={tabs} />
          </section>
        </Spin>
      );
    };

    if (versions.length <= 1) {
      return <div className={style.single}>{renderDetail()}</div>;
    }

    return (
      <div className={style.view}>
        <aside className={style.versions}>
          <div className={style.versionsTitle}>{`${t('versions')} (${versions.length})`}</div>
          <ul className={style.versionList} role="tablist" aria-orientation="vertical">
            {versions.map(item => {
              const selected = String(item.id) === selectedId;
              return (
                <li key={item.id}>
                  <button type="button" role="tab" aria-selected={selected} className={classnames(style.versionItem, { [style.versionSelected]: selected })} onClick={() => setSelectedId(String(item.id))}>
                    <span className={style.versionHead}>
                      <span className={style.versionNo}>{`v${item.version}`}</span>
                      {tagsOf(item)}
                    </span>
                    <span className={style.versionNote}>
                      <Badge status={STATUS_COLOR[item.status] || 'default'} text={t(`status.${item.status}`)} />
                      <span>{dayjs(item.createdAt).format('MM-DD HH:mm')}</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </aside>
        {renderDetail()}
      </div>
    );
  })
);

export default StageDataView;
