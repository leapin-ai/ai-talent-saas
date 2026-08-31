import { localeLoader } from '@kne/react-intl';

/**
 * ConfirmButton（@kne/button-group，namespace `button-group`）只向 intl 缓存注册了 zh-CN。
 * 远程组件与宿主共享 @kne/react-intl 单例，在此补齐该 namespace 的语言包，
 * 避免 en-US 下每个确认按钮在 render 时 MISSING_TRANSLATION 刷屏。
 * 文案与 @kne/button-group/src/locale 对齐。
 * 使用 localeLoader：当前包构建未导出 messagesLoader。
 */
const buttonGroupMessages = {
  'zh-CN': {
    message: '确定要删除吗？',
    confirm: '确定',
    delete: '删除',
    cancel: '取消',
    more: '更多'
  },
  'en-US': {
    message: 'Are you sure you want to delete?',
    confirm: 'Confirm',
    delete: 'Delete',
    cancel: 'Cancel',
    more: 'More'
  }
};

Object.keys(buttonGroupMessages).forEach(locale => {
  localeLoader(locale, buttonGroupMessages[locale], 'button-group');
});

/**
 * TablePage（@kne/table-page，namespace `table-page`）的批量操作按钮文案取自远程包自身的语言包，
 * 没有对应 props 可配，只能覆盖 intl 缓存里的 message。
 *
 * 注意调用时机：远程 chunk 在模块求值时才注册自己的语言包，而 localeLoader 是后写覆盖前写，
 * 所以本函数必须在远程模块加载完成之后调用（即渲染 TablePage 的组件体内），
 * 不能在应用启动时执行，否则会被远程包的默认文案覆盖回去。
 */
export const registerTablePageMessages = () => {
  localeLoader('en-US', { BatchOperations: 'Action' }, 'table-page');
};
