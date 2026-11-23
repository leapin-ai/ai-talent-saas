import dayjs from 'dayjs';
import { useIntl } from '@kne/react-intl';
import SendFormInner, { buildSendBody } from './SendFormInner';
import SendResult from './SendResult';
import { flowLanguage, notifyError } from './common';

/**
 * 批量发送问卷邮件。
 * 经理/员工多 Role：各选各的收件人（items）；补充问卷仍可共用勾选。
 * 传入 fixedKind（阶段里的「去发送」）时问卷类型由阶段决定；不传（列表批量发送）才可选类型。
 */
const useSendReadiness = ({ useFormModal, useModal, call, api, onDone }) => {
  const formModal = useFormModal();
  const modal = useModal();
  const { formatMessage } = useIntl();
  const t = id => formatMessage({ id: `tenantAdmin.readiness.${id}` });

  return async (runs, fixedKind) => {
    const kind = fixedKind || 'manager';
    let defaultDeadline;
    try {
      const res = await call(api.sendDefaults, { kind, runIds: runs.map(run => String(run.id)) });
      defaultDeadline = res?.deadline ? dayjs(res.deadline) : undefined;
    } catch (e) {
      notifyError(e);
    }

    const data = {
      kind,
      language: flowLanguage(runs.map(run => run.language)),
      deadline: defaultDeadline,
      participants: [],
      members: kind === 'manager' ? null : []
    };

    const perRun = runs.length > 1 && (kind === 'manager' || kind === 'staff');
    if (perRun) {
      runs.forEach(run => {
        const id = String(run.id);
        if (kind === 'manager') {
          const planned = (run.managerRecipients || []).filter(item => item?.tenantUserId).map(item => ({ id: String(item.tenantUserId), name: item.name || '' }))[0] || null;
          data[`run_${id}_members`] = planned;
          data[`run_${id}_participants`] = [];
        } else {
          data[`run_${id}_members`] = [];
          data[`run_${id}_participants`] = [];
          data[`run_${id}_personIds`] = [];
        }
      });
    } else if (kind === 'manager' && runs.length === 1) {
      data.members = (runs[0].managerRecipients || []).filter(item => item?.tenantUserId).map(item => ({ id: String(item.tenantUserId), name: item.name || '' }))[0] || null;
    }

    const formApi = formModal({
      title: fixedKind ? `${t('send')} · ${t(`kind.${fixedKind}`)}` : t('batchSend'),
      size: perRun ? 'large' : 'default',
      saveText: t('send'),
      formProps: {
        data,
        onSubmit: async formData => {
          try {
            const result = await call(api.sendBatch, buildSendBody(runs, formData, fixedKind));
            formApi.close();
            onDone?.();
            modal({ title: t('sendResult'), footer: null, children: <SendResult result={result} /> });
          } catch (e) {
            notifyError(e);
            return false;
          }
        }
      },
      children: <SendFormInner runs={runs} call={call} api={api} fixedKind={fixedKind} />
    });
  };
};

export default useSendReadiness;
