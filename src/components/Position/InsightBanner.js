import { useEffect, useState } from 'react';
import { Card } from '@kne/react-box';
import { createWithRemoteLoader } from '@kne/remote-loader';
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

const formatNames = (names, formatMessage) => {
  const list = (names || []).filter(Boolean);
  if (list.length === 0) {
    return formatMessage({ id: 'position.insightBannerNamesFallback' });
  }
  if (list.length === 1) {
    return list[0];
  }
  if (list.length === 2) {
    return formatMessage({ id: 'position.insightBannerNamesTwo' }, { a: list[0], b: list[1] });
  }
  return formatMessage({ id: 'position.insightBannerNamesMore' }, { a: list[0], b: list[1] });
};

const InsightBanner = createWithRemoteLoader({
  modules: ['components-core:Global@usePreset']
})(
  withLocale(({ remoteModules, apis, onReview }) => {
    const [usePreset] = remoteModules;
    const { ajax } = usePreset();
    const { formatMessage } = useIntl();
    const [insight, setInsight] = useState({ highChangeCount: 0, sampleNames: [] });

    useEffect(() => {
      let cancelled = false;
      const load = async () => {
        if (!apis?.insight) {
          return;
        }
        try {
          const { data: resData } = await ajax(Object.assign({}, apis.insight));
          if (cancelled || resData?.code !== 0) {
            return;
          }
          const payload = resData.data || {};
          setInsight({
            highChangeCount: Number(payload.highChangeCount) || 0,
            sampleNames: Array.isArray(payload.sampleNames) ? payload.sampleNames : []
          });
        } catch (e) {
          // keep defaults
        }
      };
      load();
      return () => {
        cancelled = true;
      };
    }, [ajax, apis?.insight]);

    const count = insight.highChangeCount;
    const namesText = formatNames(insight.sampleNames, formatMessage);

    if (count <= 0) {
      return null;
    }

    return (
      <Card
        className={style.banner}
        theme="banner"
        hover={false}
        prefix={<InsightBannerIcon />}
        title={formatMessage({ id: 'position.insightBannerTitle' }, { count })}
        description={formatMessage({ id: 'position.insightBannerDescription' }, { names: namesText })}
        extra={
          <>
            <InsightBannerBars />
            <button type="button" className={style.review} onClick={onReview} disabled={count <= 0}>
              {formatMessage({ id: 'position.insightBannerReview' })}
            </button>
          </>
        }
      />
    );
  })
);

export default InsightBanner;
