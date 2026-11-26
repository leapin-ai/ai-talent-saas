import { Alert, Flex } from 'antd';
import { createWithRemoteLoader } from '@kne/remote-loader';
import { useIntl } from '@kne/react-intl';
import withLocale from '../withLocale';

/**
 * 确认阶段编辑问卷表单体：须放在 useFormModal 的 Form 内。
 * 默认 FormCreator 是 FormInfo 字段（useDecorator），不可单独挂在普通 Modal 里。
 */
const EditQuestionnaireFormInner = createWithRemoteLoader({
  modules: ['components-core:FormInfo', 'components-thirdparty:FormCreator']
})(
  withLocale(({ remoteModules, rejected, rejectComment, rejectedByEmail, editable }) => {
    const [FormInfo, FormCreator] = remoteModules;
    const { formatMessage } = useIntl();
    const t = (id, values) => formatMessage({ id: `tenantAdmin.readiness.${id}` }, values);
    const rejectDesc = rejected ? [rejectedByEmail ? t('rejectCommentFrom', { email: rejectedByEmail }) : null, rejectComment || t('rejectCommentEmpty')].filter(Boolean).join('\n') : '';

    return (
      <Flex vertical gap={12} style={{ minHeight: 420 }}>
        {rejected ? <Alert type="warning" showIcon message={t('rejectCommentTitle')} description={<span style={{ whiteSpace: 'pre-wrap' }}>{rejectDesc}</span>} /> : null}
        {!editable ? <Alert type="info" showIcon message={t('editQuestionnaireReadOnly')} /> : null}
        <FormInfo column={1} list={[<FormCreator name="schema" label={t('editQuestionnaire')} block showPreview />]} />
      </Flex>
    );
  })
);

export default EditQuestionnaireFormInner;
