import { useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Empty, Spin } from 'antd';
import get from 'lodash/get';
import { createWithRemoteLoader } from '@kne/remote-loader';
import { useIntl } from '@kne/react-intl';
import { useFetch } from '@kne/react-fetch';
import { Page } from '@kne/system-layout';
import { applyAiInterviewRemote } from '../../preset';
import withLocale from './withLocale';

/** 与 AI 面试分享页（Project/ShareReport）一致的报告数据组装 */
const buildReportData = interview => {
  const setting = get(interview, 'project.setting') || {};
  const skillMapping = new Map((setting.mappingGroups || []).map(item => [get(item, 'origin.code'), item.target]));
  return Object.assign({}, interview.report, {
    not_display_list: (setting.hiddenGroups || []).map(item => ({ id: item.code, name: skillMapping.get(item.code) || item.name })),
    skillRange: setting.skillRange || {},
    oralRange: setting.oralRange || {},
    clientUser: {
      name: interview.name,
      phone: interview.phone,
      email: interview.email,
      invitedTime: get(interview, 'invite.createdAt'),
      startTime: interview.startTime,
      completedTime: interview.endTime,
      questionList: interview.questionList,
      answers: interview.answers
    }
  });
};

const InventoryReportView = createWithRemoteLoader({
  modules: ['ai-interview-flowup:ComponentPreset', 'ai-interview-flowup:InventoryReport', 'components-core:Global@useGlobalValue']
})(({ remoteModules, interview, apiHost }) => {
  const [ComponentPreset, InventoryReport, useGlobalValue] = remoteModules;
  const hostThemeToken = useGlobalValue('themeToken');
  const [active, setActive] = useState('summary');
  const reportData = useMemo(() => buildReportData(interview), [interview]);
  const language = get(interview, 'project.language');
  return (
    <ComponentPreset apiHost={apiHost} themeToken={hostThemeToken}>
      <InventoryReport active={active} onActiveChange={setActive} language={language} locale={language} scene="talentReview" data={reportData} />
    </ComponentPreset>
  );
});

const PersonalReport = createWithRemoteLoader({
  modules: ['components-core:Global@usePreset']
})(
  withLocale(({ remoteModules, guard }) => {
    const [usePreset] = remoteModules;
    const { apis } = usePreset();
    const { id } = useParams();
    const { formatMessage } = useIntl();
    const { data, isComplete } = useFetch(Object.assign({}, apis.talentSaas.tenant.talentReview.interviewReport, { params: { id } }));
    const remoteApplied = useMemo(() => !!data?.remote && applyAiInterviewRemote({ cdnUrl: data.remote.url, version: data.remote.version }), [data]);

    const renderBody = () => {
      if (!isComplete) {
        return <Spin style={{ display: 'block', padding: 80 }} />;
      }
      if (!data?.interview?.report) {
        return <Empty description={formatMessage({ id: 'reportNotReady' })} />;
      }
      if (!remoteApplied) {
        return <Empty description={formatMessage({ id: 'reportRemoteNotReady' })} />;
      }
      return <InventoryReportView key={`${data.remote.url}|${data.remote.version}`} interview={data.interview} apiHost={data.apiHost} />;
    };

    return guard(
      <Page title={data?.interview?.name ? `${data.interview.name} - ${formatMessage({ id: 'personalReport' })}` : formatMessage({ id: 'personalReport' })} back>
        {renderBody()}
      </Page>
    );
  })
);

export default PersonalReport;
