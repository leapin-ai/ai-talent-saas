import { useEffect, useState } from 'react';
import { Alert, Button, Flex, Spin, message } from 'antd';
import { createWithRemoteLoader } from '@kne/remote-loader';
import { useIntl } from '@kne/react-intl';
import withLocale from '../withLocale';
import { notifyError } from './common';

/**
 * 确认阶段编辑问卷：用 FormCreator 编辑 Schema，保存后写回问卷阶段新版本。
 * 若第三方已驳回，顶部展示修改意见。
 */
const EditQuestionnaireModal = createWithRemoteLoader({
  modules: ['components-thirdparty:FormCreator']
})(
  withLocale(({ remoteModules, call, api, runId, kind, personId, onSaved, onClose }) => {
    const [FormCreator] = remoteModules;
    const { formatMessage } = useIntl();
    const t = (id, values) => formatMessage({ id: `tenantAdmin.readiness.${id}` }, values);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [payload, setPayload] = useState(null);
    const [schema, setSchema] = useState(null);

    useEffect(() => {
      let cancelled = false;
      setLoading(true);
      call(api.questionnaireEdit, { runId, kind, personId })
        .then(data => {
          if (cancelled) {
            return;
          }
          setPayload(data);
          setSchema(data?.schema || { blocks: [] });
        })
        .catch(e => {
          if (!cancelled) {
            notifyError(e);
          }
        })
        .finally(() => {
          if (!cancelled) {
            setLoading(false);
          }
        });
      return () => {
        cancelled = true;
      };
    }, [call, api.questionnaireEdit, runId, kind, personId]);

    const save = async () => {
      if (!payload?.editable) {
        message.warning(t('editQuestionnaireNotEditable'));
        return;
      }
      if (!schema?.blocks?.length) {
        message.error(t('editQuestionnaireEmpty'));
        return;
      }
      setSaving(true);
      try {
        await call(api.questionnaireUpdate, { runId, kind, personId, schema });
        message.success(t('editQuestionnaireSuccess'));
        onSaved?.();
        onClose?.();
      } catch (e) {
        notifyError(e);
      } finally {
        setSaving(false);
      }
    };

    if (loading) {
      return <Spin style={{ display: 'block', margin: '48px auto' }} />;
    }

    return (
      <Flex vertical gap={16} style={{ minHeight: 420 }}>
        {payload?.rejected ? <Alert type="warning" showIcon message={t('rejectCommentTitle')} description={payload.rejectComment || t('rejectCommentEmpty')} /> : null}
        {!payload?.editable ? <Alert type="info" showIcon message={t('editQuestionnaireReadOnly')} /> : null}
        {schema ? <FormCreator value={schema} onChange={setSchema} showPreview /> : null}
        <Flex justify="flex-end" gap={8}>
          <Button onClick={onClose}>{t('cancel')}</Button>
          <Button type="primary" loading={saving} disabled={!payload?.editable} onClick={save}>
            {t('saveQuestionnaire')}
          </Button>
        </Flex>
      </Flex>
    );
  })
);

export default EditQuestionnaireModal;
