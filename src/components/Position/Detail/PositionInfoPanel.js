import { useIntl } from '@kne/react-intl';
import { createWithRemoteLoader } from '@kne/remote-loader';
import withLocale from '../withLocale';
import iconRoleOverview from './assets/icon-role-overview.svg';
import iconKeyResponsibilities from './assets/icon-key-responsibilities.svg';
import iconRoleRequirements from './assets/icon-role-requirements.svg';
import style from './style.module.scss';

const text = value => {
  if (value == null || value === '') {
    return '-';
  }
  return String(value);
};

/** FunctionSelect 存的是职能编码；兼容对象 { id / value / code } */
export const resolveCapacityCode = value => {
  if (value == null || value === '') {
    return null;
  }
  if (typeof value === 'object') {
    const code = value.id ?? value.value ?? value.code ?? value.name;
    return code == null || code === '' ? null : String(code);
  }
  return String(value);
};

export const CapacityLabel = createWithRemoteLoader({
  modules: ['components-core:Common@FunctionEnum']
})(({ remoteModules, value }) => {
  const [FunctionEnum] = remoteModules;
  const code = resolveCapacityCode(value);
  if (!code) {
    return '-';
  }
  if (!FunctionEnum) {
    return text(code);
  }
  return <FunctionEnum name={code} />;
});

const MetaGrid = ({ items }) => (
  <div className={style['meta-grid']}>
    {items.map(item => (
      <div key={item.label} className={style['meta-item']}>
        <div className={style['meta-label']}>{item.label}</div>
        <div className={style['meta-value']}>{item.value}</div>
      </div>
    ))}
  </div>
);

const DetailPanel = ({ title, extra, children, className }) => (
  <section className={className ? `${style.panel} ${className}` : style.panel}>
    {title || extra ? (
      <div className={style['panel-header']}>
        {title ? <h2 className={style['panel-title']}>{title}</h2> : null}
        {extra}
      </div>
    ) : null}
    <div className={style['panel-body']}>{children}</div>
  </section>
);

/** 岗位描述/要求：表单为纯文本；历史数据可能含 HTML */
const RichContent = ({ html }) => {
  const content = html == null || html === '' ? '' : String(html);
  if (!content) {
    return '-';
  }
  return <div className={style['rich-html']} dangerouslySetInnerHTML={{ __html: content }} />;
};

/**
 * 岗位详情「Role Details」只读面板。详情页与分析任务预览共用。
 */
const PositionInfoPanel = withLocale(({ data, extra = null }) => {
  const { formatMessage } = useIntl();
  const enumLabel = (prefix, value) => {
    if (!value) {
      return '-';
    }
    return formatMessage({ id: `${prefix}.${value}`, defaultMessage: String(value) });
  };

  const requirementLines = String(data?.requirement || '')
    .replace(/<[^>]+>/g, '\n')
    .split(/\n+/)
    .map(line => line.replace(/^[-•·]\s*/, '').trim())
    .filter(Boolean);

  return (
    <DetailPanel className={style['position-info']} extra={extra}>
      <div className={style.sections}>
        <section className={style.section}>
          <h3 className={`${style['section-title']} ${style['section-title-overview']}`}>
            <img className={style['section-icon']} src={iconRoleOverview} alt="" />
            {formatMessage({ id: 'position.roleOverview' })}
          </h3>
          <MetaGrid
            items={[
              { label: formatMessage({ id: 'position.name' }), value: text(data?.name) },
              { label: formatMessage({ id: 'position.roleFunction' }), value: <CapacityLabel value={data?.capacity} /> },
              { label: formatMessage({ id: 'position.status' }), value: enumLabel('positionStatus', data?.status) },
              { label: formatMessage({ id: 'position.language' }), value: enumLabel('language', data?.language) }
            ]}
          />
        </section>
        <section className={style.section}>
          <h3 className={`${style['section-title']} ${style['section-title-duty']}`}>
            <img className={style['section-icon']} src={iconKeyResponsibilities} alt="" />
            {formatMessage({ id: 'position.keyResponsibilities' })}
          </h3>
          <div className={style['rich-content']}>
            <RichContent html={data?.description} />
          </div>
        </section>
        <section className={style.section}>
          <h3 className={`${style['section-title']} ${style['section-title-req']}`}>
            <img className={style['section-icon']} src={iconRoleRequirements} alt="" />
            {formatMessage({ id: 'position.roleRequirements' })}
          </h3>
          {requirementLines.length > 1 ? (
            <ul className={style.bullets}>
              {requirementLines.map(line => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          ) : (
            <div className={style['rich-content']}>
              <RichContent html={data?.requirement} />
            </div>
          )}
        </section>
      </div>
    </DetailPanel>
  );
});

export default PositionInfoPanel;
