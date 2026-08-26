import { Splitter } from 'antd';
import ContextSidePanel from './ContextSidePanel';
import style from './style.module.scss';

const AnalysisFormLayout = ({ context, children }) => {
  return (
    <Splitter className={style['split-layout']}>
      <Splitter.Panel defaultSize="48%" min="300" max="70%" className={style['split-left']}>
        <ContextSidePanel context={context} />
      </Splitter.Panel>
      <Splitter.Panel className={style['split-right']}>
        <div className={style['form-scroll']}>{children}</div>
      </Splitter.Panel>
    </Splitter>
  );
};

export default AnalysisFormLayout;
