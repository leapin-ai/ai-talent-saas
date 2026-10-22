import { Flex, Spin } from 'antd';
import Fetch from '@kne/react-fetch';
import { useIntl } from '@kne/react-intl';
import QuestionnaireRecords from '@components/QuestionnaireRecords';

/** 列表行「问卷记录」：查看员工补充问卷发送记录与答卷 */
const useQuestionnaireRecords = ({ useModal, usePreset }) => {
  const modal = useModal();
  const { apis } = usePreset();
  const { formatMessage } = useIntl();
  const listApi = apis.talentSaas.tenant.employeeQuestionnaire.list;

  return item => {
    modal({
      title: formatMessage({ id: 'position.questionnaireRecordTitle' }, { name: item.name || item.nameEn || '' }),
      footer: null,
      children: (
        <Fetch
          {...listApi}
          params={{ employeeId: String(item.id) }}
          render={({ data, isComplete }) =>
            isComplete ? (
              <QuestionnaireRecords data={data} />
            ) : (
              <Flex justify="center" style={{ padding: 48 }}>
                <Spin />
              </Flex>
            )
          }
        />
      )
    });
  };
};

export default useQuestionnaireRecords;
