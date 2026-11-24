import { useEffect, useMemo, useState } from 'react';
import { Empty, Spin } from 'antd';
import { createWithRemoteLoader } from '@kne/remote-loader';
import { useIntl } from '@kne/react-intl';
import withLocale from '../withLocale';
import { applyAiInterviewRemote } from '../../../preset';
import { notifyError } from './common';
import style from './ProjectPreviewView.module.scss';

/** AI 面试远程组件 ProjectPreview：只读展示项目的问卷与数字人面试题目 */
const PreviewBody = createWithRemoteLoader({
  modules: ['ai-interview-flowup:ComponentPreset', 'ai-interview-flowup:ProjectPreview', 'components-core:Global@useGlobalValue']
})(({ remoteModules, project, apiHost }) => {
  const [ComponentPreset, ProjectPreview, useGlobalValue] = remoteModules;
  const themeToken = useGlobalValue('themeToken');
  return (
    <ComponentPreset apiHost={apiHost} themeToken={themeToken}>
      <div className={style.body}>
        <ProjectPreview className={style.preview} project={project} />
      </div>
    </ComponentPreset>
  );
});

/** 预览已发布的 AI 面试项目：服务端取 open-api project/detail 与远程组件地址，这里先应用远程地址再渲染 */
const ProjectPreviewView = withLocale(({ call, api, params }) => {
  const { formatMessage } = useIntl();
  const t = id => formatMessage({ id: `tenantAdmin.readiness.${id}` });
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    call(api.projectPreview, params)
      .then(setData)
      .catch(notifyError)
      .finally(() => setLoading(false));
    // 弹窗内只加载一次
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const remoteApplied = useMemo(() => !!data?.remote && applyAiInterviewRemote({ cdnUrl: data.remote.url, version: data.remote.version }), [data]);

  if (loading) {
    return <Spin style={{ display: 'block', padding: 80 }} />;
  }
  if (!data?.project) {
    return <Empty description={t('previewEmpty')} />;
  }
  if (!remoteApplied) {
    return <Empty description={t('previewRemoteNotReady')} />;
  }
  return <PreviewBody key={`${data.remote.url}|${data.remote.version}`} project={data.project} apiHost={data.apiHost} />;
});

export default ProjectPreviewView;
