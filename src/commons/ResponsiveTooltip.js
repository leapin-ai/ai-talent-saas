import { Tooltip } from 'antd';
import { useIsMobile, usePopupContainer } from '@kne/responsive-utils';

const MOBILE_MAX_WIDTH = 280;

/** antd Tooltip：挂到响应式边界内，移动端收窄宽度，避免浮层超出屏幕 */
const ResponsiveTooltip = ({ styles, ...props }) => {
  const getPopupContainer = usePopupContainer();
  const isMobile = useIsMobile();
  const root = isMobile ? Object.assign({}, styles?.root, { maxWidth: MOBILE_MAX_WIDTH }) : styles?.root;
  return <Tooltip getPopupContainer={getPopupContainer} {...props} styles={Object.assign({}, styles, { root })} />;
};

export default ResponsiveTooltip;
