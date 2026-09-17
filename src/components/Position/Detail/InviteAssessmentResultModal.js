import { createWithRemoteLoader } from '@kne/remote-loader';
import { Empty, Splitter } from 'antd';
import { useIntl } from '@kne/react-intl';
import withLocale from '../withLocale';
import InviteProfileFilledPane from './InviteProfileFilledPane';
import style from './inviteAssessmentResult.module.scss';

const InterviewResultBody = createWithRemoteLoader({
  modules: ['ai-interview-flowup:InterviewResultSession']
})(({ remoteModules, interview }) => {
  const [InterviewResultSession] = remoteModules;
  const { formatMessage } = useIntl();

  if (!InterviewResultSession) {
    return (
      <div className={style['empty-wrap']}>
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={formatMessage({ id: 'position.talentInviteResultLoading' })} />
      </div>
    );
  }

  return (
    <div className={style['result-wrap']}>
      <InterviewResultSession data={interview} />
    </div>
  );
});

const InviteAssessmentResultContent = withLocale(({ invite, interview }) => {
  const { formatMessage } = useIntl();
  const isEmployee = invite?.inviteType === 'employee';

  if (!isEmployee) {
    return (
      <div className={style['pane-solo']}>
        <div className={style['pane-head']}>
          <p className={style['pane-title']}>{formatMessage({ id: 'position.talentInviteResultPaneTitle' })}</p>
          <p className={style['pane-desc']}>{formatMessage({ id: 'position.talentInviteResultPaneDesc' })}</p>
        </div>
        <InterviewResultBody interview={interview} />
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
          <InterviewResultBody interview={interview} />
        </div>
      </Splitter.Panel>
    </Splitter>
  );
});

const InviteAssessmentResultModal = createWithRemoteLoader({
  modules: ['components-core:Modal']
})(
  withLocale(({ remoteModules, open, onClose, invite, interview }) => {
    const [Modal] = remoteModules;
    const { formatMessage } = useIntl();
    const name = invite?.name || '';

    return (
      <Modal open={open} title={formatMessage({ id: 'position.talentInviteResultTitle' }, { name })} size="large" destroyOnHidden disabledScroller onCancel={onClose} onClose={onClose} footer={null}>
        {open ? <InviteAssessmentResultContent invite={invite} interview={interview} /> : null}
      </Modal>
    );
  })
);

export default InviteAssessmentResultModal;
