import { createWithRemoteLoader } from '@kne/remote-loader';
import { Empty, Splitter } from 'antd';
import { useIntl } from '@kne/react-intl';
import withLocale from '../withLocale';
import InviteProfileFilledPane from './InviteProfileFilledPane';
import style from './inviteAssessmentResult.module.scss';

/**
 * 与 AIInterviewRoom 一致：ComponentPreset 注入 AI 面试域 apis.file，录像预览才打对接口。
 */
const InterviewResultBody = createWithRemoteLoader({
  modules: ['ai-interview-flowup:ComponentPreset', 'ai-interview-flowup:InterviewResultSession', 'components-core:Global@useGlobalValue']
})(({ remoteModules, interview, apiHost }) => {
  const [ComponentPreset, InterviewResultSession, useGlobalValue] = remoteModules;
  const { formatMessage } = useIntl();
  const hostThemeToken = useGlobalValue('themeToken');

  if (!ComponentPreset || !InterviewResultSession) {
    return (
      <div className={style['empty-wrap']}>
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={formatMessage({ id: 'position.talentInviteResultLoading' })} />
      </div>
    );
  }

  if (!apiHost) {
    return (
      <div className={style['empty-wrap']}>
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={formatMessage({ id: 'position.talentInviteResultRemoteFailed' })} />
      </div>
    );
  }

  return (
    <div className={style['result-wrap']}>
      <ComponentPreset apiHost={apiHost} themeToken={hostThemeToken}>
        <InterviewResultSession data={interview} />
      </ComponentPreset>
    </div>
  );
});

const InviteAssessmentResultContent = withLocale(({ invite, interview, remoteKey, apiHost }) => {
  const { formatMessage } = useIntl();
  const isEmployee = invite?.inviteType === 'employee';
  const resultBody = <InterviewResultBody key={remoteKey || interview?.id || 'result'} interview={interview} apiHost={apiHost} />;

  if (!isEmployee) {
    return (
      <div className={style['pane-solo']}>
        <div className={style['pane-head']}>
          <p className={style['pane-title']}>{formatMessage({ id: 'position.talentInviteResultPaneTitle' })}</p>
          <p className={style['pane-desc']}>{formatMessage({ id: 'position.talentInviteResultPaneDesc' })}</p>
        </div>
        {resultBody}
      </div>
    );
  }

  return (
    <Splitter className={style['split-layout']}>
      <Splitter.Panel defaultSize="40%" min="280" max="55%" className={style['split-left']}>
        <div className={style['pane-scroll']}>
          <InviteProfileFilledPane invite={invite} />
        </div>
      </Splitter.Panel>
      <Splitter.Panel className={style['split-right']}>
        <div className={style['pane-scroll']}>
          <div className={style['pane-head']}>
            <p className={style['pane-title']}>{formatMessage({ id: 'position.talentInviteResultPaneTitle' })}</p>
            <p className={style['pane-desc']}>{formatMessage({ id: 'position.talentInviteResultPaneDesc' })}</p>
          </div>
          {resultBody}
        </div>
      </Splitter.Panel>
    </Splitter>
  );
});

const InviteAssessmentResultModal = createWithRemoteLoader({
  modules: ['components-core:Modal']
})(
  withLocale(({ remoteModules, open, onClose, invite, interview, remoteKey, apiHost }) => {
    const [Modal] = remoteModules;
    const { formatMessage } = useIntl();
    const name = invite?.name || '';

    return (
      <Modal open={open} title={formatMessage({ id: 'position.talentInviteResultTitle' }, { name })} size="large" destroyOnHidden disabledScroller onCancel={onClose} onClose={onClose} footer={null}>
        {open ? <InviteAssessmentResultContent invite={invite} interview={interview} remoteKey={remoteKey} apiHost={apiHost} /> : null}
      </Modal>
    );
  })
);

export default InviteAssessmentResultModal;
