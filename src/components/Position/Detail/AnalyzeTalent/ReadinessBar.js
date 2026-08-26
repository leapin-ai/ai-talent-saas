import style from './style.module.scss';

const ReadinessBar = ({ value }) => {
  if (value == null || value === '') {
    return (
      <div className={style.readiness}>
        <div className={style['readiness-track']}>
          <div className={style['readiness-fill']} style={{ width: '0%' }} />
        </div>
        <span className={style['readiness-empty']}>—</span>
      </div>
    );
  }

  const pct = Math.min(100, Math.max(0, Number(value) || 0));
  const tone = pct < 55 ? 'low' : 'high';

  return (
    <div className={style.readiness}>
      <div className={style['readiness-track']}>
        <div className={`${style['readiness-fill']} ${style[`readiness-fill-${tone}`]}`} style={{ width: `${pct}%` }} />
      </div>
      <span className={`${style['readiness-value']} ${style[`readiness-value-${tone}`]}`}>{pct}%</span>
    </div>
  );
};

export default ReadinessBar;
