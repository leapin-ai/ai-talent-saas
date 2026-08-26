import { Button, message } from 'antd';
import { createWithRemoteLoader } from '@kne/remote-loader';
import CompleteAssessmentGenerateTask from './CompleteAssessmentGenerateTask';
import CompletePositionAnalysisTask from '@components/PositionAnalysisTask';

const DefaultManualCompleteTask = createWithRemoteLoader({
  modules: ['components-core:Global@usePreset']
})(({ remoteModules, data, onSuccess, children, ...props }) => {
  const [usePreset] = remoteModules;
  const { apis, ajax } = usePreset();

  return (
    <Button
      {...props}
      onClick={async () => {
        try {
          const { data: resData } = await ajax(
            Object.assign({}, apis.task.complete, {
              data: {
                id: data.id,
                status: 'success',
                output: {}
              }
            })
          );
          if (resData.code !== 0) {
            throw new Error(resData.msg || '完成任务失败');
          }
          message.success('任务已完成');
          onSuccess && onSuccess();
        } catch (e) {
          message.error(e.message || '完成任务失败');
        }
      }}
    >
      {children || '完成'}
    </Button>
  );
});

export const getManualTaskAction = data => {
  if (data?.type === 'assessment-profile-review') {
    return CompleteAssessmentGenerateTask;
  }
  if (data?.type === 'position-ai-analysis') {
    return CompletePositionAnalysisTask;
  }
  return DefaultManualCompleteTask;
};

export { CompleteAssessmentGenerateTask, CompletePositionAnalysisTask, DefaultManualCompleteTask };
