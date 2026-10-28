import { createWithRemoteLoader } from '@kne/remote-loader';
import style from './style.module.scss';

export const hasQuestionnaire = config => !!(config?.enabled && Array.isArray(config.schema?.blocks) && config.schema.blocks.length);

/** 与 AI 面试问卷页一致：标题 + 说明 + FormCreator SchemaRenderer */
const QuestionnaireView = createWithRemoteLoader({
  modules: ['components-thirdparty:FormCreator@SchemaRenderer']
})(({ remoteModules, config, preview = true }) => {
  const [SchemaRenderer] = remoteModules;
  if (!hasQuestionnaire(config)) return null;
  return (
    <div className={style['questionnaire-page']}>
      {config.title || (config.description || '').trim() ? (
        <section className={style['questionnaire-hero']}>
          {config.title ? <h1 className={style['questionnaire-title']}>{config.title}</h1> : null}
          {(config.description || '').trim() ? <p className={style['questionnaire-desc']}>{config.description}</p> : null}
        </section>
      ) : null}
      <SchemaRenderer schema={config.schema} preview={preview} showActions={false} />
    </div>
  );
});

export default QuestionnaireView;
