import classnames from 'classnames';
import style from './style.module.scss';

/** 与未来任务就绪左右栏对齐的默认限高 */
export const PINNED_SCROLL_MAX_HEIGHT = 'min(70vh, 560px)';

/**
 * 头尾固定，中间限高超出滚动；滚动条贴面板右缘（水平 padding 放 bodyInner）。
 * fill：撑满父级高度（父级需有限高）；与 maxHeight 可同时用。
 */
const PinnedScrollPanel = ({ className, header, footer, children, maxHeight, fill = false, bodyClassName, bodyInnerClassName, headerClassName, footerClassName, style: styleProp }) => {
  const panelStyle = maxHeight ? Object.assign({}, styleProp, { maxHeight: typeof maxHeight === 'number' ? `${maxHeight}px` : maxHeight }) : styleProp;

  return (
    <div className={classnames(style.panel, fill && style.fill, className)} style={panelStyle}>
      {header != null ? <div className={classnames(style.header, headerClassName)}>{header}</div> : null}
      <div className={classnames(style.body, bodyClassName)}>
        <div className={classnames(style['body-inner'], bodyInnerClassName)}>{children}</div>
      </div>
      {footer != null ? <div className={classnames(style.footer, footerClassName)}>{footer}</div> : null}
    </div>
  );
};

export default PinnedScrollPanel;
