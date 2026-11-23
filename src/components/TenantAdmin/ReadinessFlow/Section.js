import classnames from 'classnames';
import style from './style.module.scss';

/** 详情页统一分区：同样的边框、标题栏与内边距，保证各区左右对齐 */
const Section = ({ title, subtitle, extra, flush, className, children }) => (
  <section className={classnames(style.section, className)}>
    {title || extra ? (
      <header className={style.sectionHeader}>
        <div className={style.sectionHeading}>
          {title ? <span className={style.sectionTitle}>{title}</span> : null}
          {subtitle ? <span className={style.sectionSubtitle}>{subtitle}</span> : null}
        </div>
        {extra ? <div className={style.sectionExtra}>{extra}</div> : null}
      </header>
    ) : null}
    <div className={classnames(style.sectionBody, { [style.sectionBodyFlush]: flush })}>{children}</div>
  </section>
);

export default Section;
