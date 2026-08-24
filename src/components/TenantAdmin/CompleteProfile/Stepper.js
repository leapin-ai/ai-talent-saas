import style from './style.module.scss';

const Stepper = ({ items, current = 0 }) => {
  const list = Array.isArray(items) ? items : [];
  return (
    <div className={style.steps}>
      {list.map((title, index) => (
        <span key={`${title}-${index}`} style={{ display: 'inline-flex', alignItems: 'center' }}>
          {index > 0 ? (
            <span className={style['step-connector']}>
              <span className={style['step-dot']} />
              <span className={style['step-dot']} />
              <span className={style['step-dot']} />
            </span>
          ) : null}
          <span className={`${style['step-item']}${index === current ? ` ${style['step-active']}` : ''}${index < current ? ` ${style['step-done']}` : ''}`}>
            <span className={style['step-index']}>{index + 1}</span>
            {title}
          </span>
        </span>
      ))}
    </div>
  );
};

export default Stepper;
