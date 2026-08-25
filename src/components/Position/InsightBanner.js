import { Card } from '@kne/react-box';
import { useIntl } from '@kne/react-intl';
import withLocale from './withLocale';
import sparkleIcon from './assets/sparkle.svg';
import style from './insightBanner.module.scss';

const BAR_HEIGHTS = [9.88, 15.08, 11.44, 19.75, 26.01];
const BAR_OPACITIES = [0.3, 0.42, 0.34, 0.6, 1];

const InsightBannerIcon = () => (
  <span className={style.icon} aria-hidden="true">
    <img src={sparkleIcon} alt="" width={18} height={18} />
  </span>
);

const InsightBannerBars = () => (
  <span className={style.bars} aria-hidden="true">
    {BAR_HEIGHTS.map((height, index) => (
      <span
        key={index}
        className={index === BAR_HEIGHTS.length - 1 ? style['bar-active'] : style.bar}
        style={{
          height,
          opacity: index === BAR_HEIGHTS.length - 1 ? undefined : BAR_OPACITIES[index]
        }}
      />
    ))}
  </span>
);

const InsightBanner = withLocale(({ onReview }) => {
  const { formatMessage } = useIntl();

  return (
    <Card
      className={style.banner}
      theme="banner"
      hover={false}
      prefix={<InsightBannerIcon />}
      title={formatMessage({ id: 'position.insightBannerTitle' })}
      description={formatMessage({ id: 'position.insightBannerDescription' })}
      extra={
        <>
          <InsightBannerBars />
          <button type="button" className={style.review} onClick={onReview}>
            {formatMessage({ id: 'position.insightBannerReview' })}
          </button>
        </>
      }
    />
  );
});

export default InsightBanner;
