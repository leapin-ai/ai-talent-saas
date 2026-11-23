import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { message } from 'antd';
import dayjs from 'dayjs';
import { createWithRemoteLoader } from '@kne/remote-loader';
import { useIntl } from '@kne/react-intl';
import withLocale from '../withLocale';
import CreateFormInner, { pickCreateEmployees, pickCreateManagers } from './CreateFormInner';
import EnterAnswersForm, { DEFAULT_ANSWERS_JSON, loadAnswersDefaultJson, normalizeAnswersPayload } from './EnterAnswersForm';
import useSendReadiness from './useSendReadiness';
import useConfirmReadiness from './useConfirmReadiness';
import FlowCard from './FlowCard';
import flowsStyle from './flows.module.scss';
import { batchOpLabel, collectBatchOps } from './batchOps';
import { LANGUAGE_LABEL, ROLE_STAGE_FILTER_OPTIONS, STATUS_COLOR, notifyError, useReadinessCall } from './common';

const POLL_INTERVAL = 8000;

/** 平台 Admin → 租户管理 → 某租户 →「就绪度流程」tab 的列表：走 tenantAdmin 接口并带上 tenantId，详情通过 onOpenDetail 在 tab 内切换 */
const ReadinessFlows = createWithRemoteLoader({
  modules: ['components-core:Global@usePreset', 'components-core:TablePage', 'components-core:TablePage@Table', 'components-core:Filter', 'components-core:FormInfo@useFormModal', 'components-core:Modal@useModal']
})(
  withLocale(({ remoteModules, adminTenantId, onOpenDetail }) => {
    const [usePreset, TablePage, Table, Filter, useFormModal, useModal] = remoteModules;
    const { SuperSelectFilterItem } = Filter.fields;
    const { apis, ajax } = usePreset();
    const { formatMessage } = useIntl();
    const call = useReadinessCall(ajax, { tenantId: adminTenantId });
    const api = apis.talentSaas.tenantAdmin.readiness;
    const formModal = useFormModal();
    const tableRef = useRef(null);
    const [pageList, setPageList] = useState([]);
    const [busyKey, setBusyKey] = useState('');
    const { selectedRows, getRowSelection, clearSelectedRows } = Table.useSelectedRow({ rowKey: 'id' });

    const t = (id, values) => formatMessage({ id: `tenantAdmin.readiness.${id}`, defaultMessage: id }, values);
    const reload = () => tableRef.current?.reload();

    const finishSelection = useCallback(() => {
      clearSelectedRows();
      reload();
    }, [clearSelectedRows]);

    const openSend = useSendReadiness({
      useFormModal,
      useModal,
      call,
      api,
      onDone: finishSelection
    });
    const openConfirm = useConfirmReadiness({ useFormModal, call, api, onDone: finishSelection });

    // 有运行中的流程时定时刷新（任务是异步回调的）
    const hasRunning = pageList.some(item => item.status === 'running');
    useEffect(() => {
      if (!hasRunning) {
        return undefined;
      }
      const timer = setInterval(() => tableRef.current?.reload(), POLL_INTERVAL);
      return () => clearInterval(timer);
    }, [hasRunning]);

    const act = useCallback(
      async (runId, apiItem, data, successKey, { reload: shouldReload = true } = {}) => {
        setBusyKey(String(runId));
        try {
          const result = await call(apiItem, Object.assign({ runId: String(runId) }, data || {}));
          if (successKey) {
            message.success(t(successKey));
          }
          if (shouldReload) {
            reload();
          }
          return result;
        } catch (e) {
          notifyError(e);
          return null;
        } finally {
          setBusyKey('');
        }
      },
      // eslint-disable-next-line react-hooks/exhaustive-deps
      [api, call]
    );

    /** 批量串行执行 targets，只对传入的可执行条目触发 */
    const runBatchTargets = useCallback(
      async (targets, runner) => {
        setBusyKey('batch');
        let ok = 0;
        let fail = 0;
        for (const target of targets) {
          try {
            await runner(target);
            ok += 1;
          } catch (e) {
            fail += 1;
            notifyError(e);
          }
        }
        setBusyKey('');
        message.success(t('batchResult', { ok, fail }));
        finishSelection();
        return { ok, fail };
      },
      // eslint-disable-next-line react-hooks/exhaustive-deps
      [finishSelection]
    );

    const openEnterAnswers = useCallback(
      async ({ runId, kind, personId }) => {
        const answersJson = await loadAnswersDefaultJson({ call, api, runId, kind, personId });
        const formApi = formModal({
          title: t('enterAnswers'),
          size: 'default',
          formProps: {
            data: { answers: answersJson || DEFAULT_ANSWERS_JSON },
            onSubmit: async formData => {
              const payload = normalizeAnswersPayload(formData.answers);
              if (!payload) {
                message.error(t('answersJsonInvalid'));
                return false;
              }
              const result = await act(runId, api.submitAnswers, { kind, personId, ...payload }, 'answersSuccess');
              if (!result) {
                return false;
              }
              formApi.close();
            }
          },
          children: <EnterAnswersForm />
        });
      },
      // eslint-disable-next-line react-hooks/exhaustive-deps
      [act, api, call, formModal]
    );

    const onTodoAction = useCallback(
      async ({ type, item, todo, kind }) => {
        const runId = String(item.id);
        const personId = todo.personId || undefined;
        if (type === 'confirm') {
          await openConfirm({ runId, kind, personId, language: item.language });
          return;
        }
        if (type === 'send') {
          await openSend([item], kind);
          return;
        }
        if (type === 'trigger') {
          await act(runId, api.triggerReport, {}, 'triggerSuccess');
          return;
        }
        if (type === 'retry') {
          await act(runId, api.retry, { scope: todo.scope, personId, stage: todo.stage }, 'retrySuccess');
          return;
        }
        if (type === 'advance') {
          await act(runId, api.advanceAnswers, { kind, personId }, 'advanceSuccess');
          return;
        }
        if (type === 'enter') {
          openEnterAnswers({ runId, kind, personId });
          return;
        }
        if (type === 'fetch') {
          const result = await act(runId, api.syncAnswers, {});
          if (!result) {
            return;
          }
          if (result.saved) {
            message.success(t('fetchResultSaved', { count: result.saved, video: result.video || 0 }));
          } else if (result.video) {
            message.success(t('fetchResultVideoAttached', { video: result.video }));
          } else if (result.transcribing) {
            message.info(t('fetchResultTranscribing', { count: result.transcribing }));
          } else {
            message.info(t('fetchResultNone', { checked: result.checked || 0 }));
          }
          if (result.failed?.length) {
            message.warning(t('fetchResultSkipped', { count: result.failed.length }));
          }
        }
      },
      // eslint-disable-next-line react-hooks/exhaustive-deps
      [act, api, openConfirm, openEnterAnswers, openSend]
    );

    const selectedItems = useMemo(() => {
      const map = new Map(pageList.map(item => [String(item.id), item]));
      return selectedRows.map(row => map.get(String(row.id))).filter(Boolean);
    }, [pageList, selectedRows]);

    const onBatchAction = useCallback(
      async op => {
        const { type, kind, targets } = op;
        if (type === 'confirm') {
          await openConfirm({
            targets: targets.map(({ item, todo }) => ({
              runId: item.id,
              kind,
              personId: todo.personId || undefined,
              language: item.language
            }))
          });
          return;
        }
        if (type === 'send') {
          await openSend(
            targets.map(({ item }) => item),
            kind
          );
          return;
        }
        if (type === 'fetch') {
          await runBatchTargets(targets, async ({ item }) => {
            await call(api.syncAnswers, { runId: String(item.id) });
          });
          return;
        }
        if (type === 'advance') {
          await runBatchTargets(targets, async ({ item, todo }) => {
            await call(api.advanceAnswers, { runId: String(item.id), kind, personId: todo.personId || undefined });
          });
          return;
        }
        if (type === 'trigger') {
          await runBatchTargets(targets, async ({ item }) => {
            await call(api.triggerReport, { runId: String(item.id) });
          });
          return;
        }
        if (type === 'retry') {
          await runBatchTargets(targets, async ({ item, todo }) => {
            await call(api.retry, { runId: String(item.id), scope: todo.scope, personId: todo.personId || undefined, stage: todo.stage });
          });
        }
      },
      // eslint-disable-next-line react-hooks/exhaustive-deps
      [api, call, openConfirm, openSend, runBatchTargets]
    );

    const batchActions = useMemo(
      () =>
        collectBatchOps(selectedItems).map(op => ({
          key: op.key,
          label: batchOpLabel(t, op),
          onClick: () => onBatchAction(op)
        })),
      // eslint-disable-next-line react-hooks/exhaustive-deps
      [onBatchAction, selectedItems]
    );

    const openCreate = async () => {
      try {
        const { pageData } = await call(apis.talentSaas.tenantAdmin.position.list, { perPage: 100, currentPage: 1 });
        const positions = pageData || [];
        const modalApi = formModal({
          title: t('create'),
          size: 'large',
          formProps: {
            data: {
              sourceType: 'existing',
              language: 'zh-CN',
              hasStaffQuestionnaire: true,
              roleName: '',
              jd: '',
              managers: null,
              manualManagers: [],
              employees: [],
              manualEmployees: []
            },
            onSubmit: async formData => {
              try {
                const isNewRole = formData.sourceType === 'new';
                const created = await call(api.create, {
                  positionId: isNewRole ? undefined : formData.positionId,
                  roleName: String(formData.roleName || '').trim(),
                  jd: String(formData.jd || '').trim(),
                  language: formData.language,
                  hasStaffQuestionnaire: !!formData.hasStaffQuestionnaire,
                  managers: pickCreateManagers(formData),
                  employees: formData.hasStaffQuestionnaire ? pickCreateEmployees(formData) : []
                });
                message.success(t('createSuccess'));
                modalApi.close();
                onOpenDetail?.(String(created.id));
              } catch (e) {
                notifyError(e);
                return false;
              }
            }
          },
          children: <CreateFormInner positions={positions} tenantId={adminTenantId} />
        });
      } catch (e) {
        notifyError(e);
      }
    };

    const columns = [
      { name: 'roleName', title: t('role'), width: 260, renderType: 'main', onClick: ({ colItem }) => onOpenDetail?.(String(colItem.id)) },
      { name: 'status', title: t('statusLabel'), width: 120, renderType: 'status', getValueOf: item => ({ type: STATUS_COLOR[item.status] || 'default', text: t(`status.${item.status}`) }) },
      { name: 'stage', title: t('currentStage'), width: 180, getValueOf: item => t(`stage.${item.stage}`) },
      { name: 'participants', title: t('participantsDone'), width: 120, getValueOf: item => (item.personCount ? `${item.personDoneCount}/${item.personCount}` : null) },
      { name: 'language', title: t('language'), width: 100, getValueOf: item => LANGUAGE_LABEL[item.language] || item.language },
      { name: 'createdAt', title: t('createdAt'), width: 160, getValueOf: item => (item.createdAt ? dayjs(item.createdAt).format('YYYY-MM-DD HH:mm') : null) },
      {
        name: 'options',
        title: t('actions'),
        width: 100,
        fixed: 'right',
        renderType: 'options',
        getValueOf: item => [{ children: t('view'), onClick: () => onOpenDetail?.(String(item.id)) }]
      }
    ];

    const renderCards = ({ dataSource = [], renderToolbar, getSelectionProps, getRowKey }) => (
      <div>
        {renderToolbar?.()}
        <div className={flowsStyle.grid}>
          {dataSource.map(item => (
            <FlowCard key={getRowKey(item)} t={t} item={item} selection={getSelectionProps?.(item)} busy={busyKey === String(item.id) || busyKey === 'batch'} onOpen={row => onOpenDetail?.(String(row.id))} onTodoAction={onTodoAction} />
          ))}
        </div>
      </div>
    );

    if (!adminTenantId) {
      return null;
    }

    return (
      <TablePage
        {...api.list}
        key={adminTenantId}
        ref={tableRef}
        data={{ tenantId: adminTenantId }}
        name="admin-readiness-flows"
        rowKey="id"
        columns={columns}
        renderCard={renderCards}
        renderMobile={renderCards}
        forceCard
        search={{ name: 'keyword', label: t('keyword'), placeholder: t('keyword') }}
        filter={{
          list: [
            {
              type: SuperSelectFilterItem,
              props: {
                name: 'status',
                label: t('statusLabel'),
                single: true,
                options: ['running', 'blocked', 'failed', 'done', 'canceled'].map(value => ({ label: t(`status.${value}`), value }))
              }
            },
            {
              type: SuperSelectFilterItem,
              props: {
                name: 'stage',
                label: t('currentStage'),
                single: true,
                options: ROLE_STAGE_FILTER_OPTIONS.map(value => ({ label: t(`stage.${value}`), value }))
              }
            },
            {
              type: SuperSelectFilterItem,
              props: {
                name: 'language',
                label: t('language'),
                single: true,
                options: Object.entries(LANGUAGE_LABEL).map(([value, label]) => ({ label, value }))
              }
            }
          ],
          mapFilterValue: value => ({ filter: Filter.getFilterValue(value) })
        }}
        buttonGroup={{ list: [{ type: 'primary', children: t('create'), onClick: openCreate }] }}
        rowSelection={getRowSelection(pageList)}
        selectedRows={selectedRows}
        batchActions={batchActions}
        dataFormat={data => {
          const list = Array.isArray(data?.pageData) ? data.pageData : [];
          queueMicrotask(() => setPageList(list));
          return { list, total: data?.totalCount || 0 };
        }}
      />
    );
  })
);

export default ReadinessFlows;
