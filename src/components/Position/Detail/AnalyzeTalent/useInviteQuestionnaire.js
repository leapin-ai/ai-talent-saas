import { useMemo } from 'react';
import { message } from 'antd';
import { useIntl } from '@kne/react-intl';

/** 列表行「邀请补充问卷」：选应用中心问卷项目，邮件/短信发给员工 */
const useInviteQuestionnaire = ({ useFormModal, FormInfo, usePreset, positionId }) => {
  const formModal = useFormModal();
  const { apis, ajax } = usePreset();
  const { formatMessage, locale } = useIntl();
  const { SuperSelect, DatePicker } = FormInfo.fields;
  const questionnaireApis = apis.talentSaas.tenant.employeeQuestionnaire;

  const projectApi = useMemo(() => Object.assign({}, questionnaireApis.projectList, { params: { perPage: 20 } }), [questionnaireApis]);

  return item => {
    const api = formModal({
      size: 'small',
      title: formatMessage({ id: 'position.questionnaireInviteTitle' }, { name: item.name || item.nameEn || '' }),
      saveText: formatMessage({ id: 'position.talentInviteSend' }),
      formProps: {
        data: { project: undefined, deadline: undefined },
        onSubmit: async formData => {
          const project = formData.project || {};
          const { data: res } = await ajax(
            Object.assign({}, questionnaireApis.send, {
              data: {
                employeeId: String(item.id),
                positionId: positionId ? String(positionId) : undefined,
                project: { id: project.id || project.value, name: project.name || project.label || '' },
                deadline: formData.deadline,
                language: locale === 'zh-CN' ? 'zh-CN' : 'en-US'
              }
            })
          );
          if (res.code !== 0) {
            return false;
          }
          message.success(formatMessage({ id: 'position.questionnaireInviteSuccess' }));
          api.close();
        }
      },
      children: (
        <FormInfo
          column={1}
          list={[
            <SuperSelect
              name="project"
              label={formatMessage({ id: 'position.questionnaireInviteProject' })}
              rule="REQ"
              single
              labelKey="name"
              valueKey="id"
              api={projectApi}
              placeholder={formatMessage({ id: 'position.talentInviteSelect' })}
              getSearchProps={({ searchText }) => ({ keyword: searchText })}
              dataFormat={data => ({
                list: data.pageData || [],
                total: data.totalCount || 0
              })}
              pagination={{
                paramsType: 'params'
              }}
            />,
            <DatePicker name="deadline" label={formatMessage({ id: 'position.talentInviteDeadline' })} placeholder={formatMessage({ id: 'position.talentInviteSelect' })} />
          ]}
        />
      )
    });
  };
};

export default useInviteQuestionnaire;
