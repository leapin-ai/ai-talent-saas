import { Fragment } from 'react';
import { Alert, message } from 'antd';
import { useIntl } from '@kne/react-intl';
import ConfirmFormInner, { buildConfirmBody, buildConfirmMailBody } from './ConfirmFormInner';
import { flowLanguage, notifyError } from './common';

/**
 * 确认问卷：管理员直接确认，或发邮件给有关人确认。useFormModal 由调用方从远程模块传入。
 * 邮件模式：多份问卷共用一封邮件与一个入口链接，页内再逐份确认。
 * params.targets：批量确认 [{ runId, kind, personId, language }]；不传则按单条 runId/kind/personId。
 */
const useConfirmReadiness = ({ useFormModal, call, api, onDone }) => {
  const formModal = useFormModal();
  const { formatMessage } = useIntl();
  const t = (id, values) => formatMessage({ id: `tenantAdmin.readiness.${id}` }, values);

  return async params => {
    const targets = params.targets?.length
      ? params.targets.map(item => ({ runId: String(item.runId), kind: item.kind, personId: item.personId, language: item.language }))
      : [{ runId: String(params.runId), kind: params.kind, personId: params.personId, language: params.language }];
    const first = targets[0];
    const defaultLanguage = flowLanguage(
      params.language,
      targets.map(item => item.language)
    );
    // 经理问卷：确认邮件收件人最多一人
    const singleRecipient = targets.length > 0 && targets.every(item => item.kind === 'manager');
    let digitals = [];
    try {
      const res = await call(api.confirmDigitals, { runId: first.runId });
      digitals = res?.pageData || [];
    } catch (e) {
      notifyError(e);
      return;
    }
    if (!digitals.length) {
      message.error(t('confirmNoDigital'));
      return;
    }
    const formApi = formModal({
      title: targets.length > 1 ? t('batchConfirmTitle', { count: targets.length }) : t('confirmQuestionnaire'),
      size: 'small',
      formProps: {
        data: { mode: 'direct', language: defaultLanguage, emails: [], email: '' },
        onSubmit: async formData => {
          const mail = formData.mode === 'mail';
          if (mail) {
            try {
              const result = await call(api.confirmMailSend, buildConfirmMailBody(targets, formData, { singleRecipient }));
              if (result.failed?.length) {
                message.warning(`${t('confirmMailPartial')}${[...new Set(result.failed.map(item => item.email))].join('、')}`);
              } else {
                message.success(targets.length > 1 ? t('confirmMailBatchSuccess', { count: targets.length }) : t('confirmMailSuccess'));
              }
              formApi.close();
              onDone?.();
            } catch (e) {
              notifyError(e);
              return false;
            }
            return;
          }

          let ok = 0;
          let fail = 0;
          for (const target of targets) {
            try {
              await call(api.confirm, Object.assign({ runId: target.runId }, buildConfirmBody(target, formData)));
              ok += 1;
            } catch (e) {
              fail += 1;
              notifyError(e);
            }
          }
          if (targets.length > 1) {
            message.success(t('batchResult', { ok, fail }));
          } else if (ok) {
            message.success(t('confirmSuccess'));
          }
          if (!ok) {
            return false;
          }
          formApi.close();
          onDone?.();
        }
      },
      children: (
        <Fragment>
          {targets.length > 1 ? <Alert type="info" showIcon style={{ marginBottom: 12 }} message={t('batchConfirmTip', { count: targets.length })} /> : null}
          <ConfirmFormInner digitals={digitals} batchCount={targets.length} singleRecipient={singleRecipient} />
        </Fragment>
      )
    });
  };
};

export default useConfirmReadiness;
