import { useCallback } from 'react';
import { message } from 'antd';
import { useIntl } from '@kne/react-intl';
import CreateFormInner, { buildJdFromPosition, pickCreateEmployees, pickCreateManagers } from '@components/TenantAdmin/ReadinessFlow/CreateFormInner';

/**
 * 岗位列表「启动 / 岗位重建」：复用就绪度新建表单（锁定当前岗位），提交走租户 startReadiness。
 */
const useStartReadiness = ({ formModal, ajax, apis, orgListApi, userListApi }) => {
  const { formatMessage, locale } = useIntl();

  return useCallback(
    ({ position, mode = 'start', onSuccess }) => {
      if (!position?.id) {
        return;
      }
      const isRebuild = mode === 'rebuild';
      const title = formatMessage({ id: isRebuild ? 'position.readinessRebuild' : 'position.readinessStart' });
      // 流程语言默认取当前系统语言（与邀请评估等一致），不跟岗位 language
      const systemLanguage = locale === 'zh-CN' ? 'zh-CN' : 'en-US';
      const modalApi = formModal({
        title,
        size: 'large',
        saveText: formatMessage({ id: isRebuild ? 'position.readinessRebuildSubmit' : 'position.readinessStartSubmit' }),
        formProps: {
          data: {
            positionId: String(position.id),
            language: systemLanguage,
            hasStaffQuestionnaire: true,
            roleName: position.name || '',
            jd: buildJdFromPosition(position),
            managers: null,
            manualManagers: [],
            employees: [],
            manualEmployees: []
          },
          onSubmit: async formData => {
            try {
              const { data: res } = await ajax(
                Object.assign({}, apis.startReadiness, {
                  data: {
                    positionId: String(position.id),
                    roleName: String(formData.roleName || '').trim(),
                    jd: String(formData.jd || '').trim(),
                    language: formData.language,
                    hasStaffQuestionnaire: !!formData.hasStaffQuestionnaire,
                    managers: pickCreateManagers(formData),
                    employees: formData.hasStaffQuestionnaire ? pickCreateEmployees(formData) : []
                  }
                })
              );
              if (res.code !== 0) {
                return false;
              }
              message.success(formatMessage({ id: isRebuild ? 'position.readinessRebuildSuccess' : 'position.readinessStartSuccess' }));
              modalApi.close();
              onSuccess?.(res.data);
            } catch (e) {
              if (!e?.handled) {
                message.error(e?.message || formatMessage({ id: 'position.readinessStartFailed' }));
              }
              return false;
            }
          }
        },
        children: <CreateFormInner fixedPosition={position} orgApi={orgListApi} userApi={userListApi} />
      });
    },
    [ajax, apis.startReadiness, formModal, formatMessage, locale, orgListApi, userListApi]
  );
};

export default useStartReadiness;
