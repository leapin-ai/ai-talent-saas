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
