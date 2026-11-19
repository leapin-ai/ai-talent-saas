import { createContext, useContext, useMemo } from 'react';
import { useFetch } from '@kne/react-fetch';

const EMPTY = [];
const DEFAULT_VALUE = { apps: EMPTY, tenantId: null, loading: false, reload: () => {} };

const SubAppMenusContext = createContext(DEFAULT_VALUE);

/** 左菜单展示的应用与菜单（应用中心 centerMenus）；reload 供租户设置修改展示方式后刷新左菜单 */
export const useSubAppMenus = () => useContext(SubAppMenusContext);

const Loader = ({ api, tenantId, children }) => {
  const { data, isLoading, reload, refresh } = useFetch(Object.assign({}, api));
  const apps = data?.pageData || EMPTY;
  const value = useMemo(() => ({ apps, tenantId, loading: isLoading, reload: reload || refresh }), [apps, tenantId, isLoading, reload, refresh]);
  return <SubAppMenusContext.Provider value={value}>{children(apps)}</SubAppMenusContext.Provider>;
};

/** api 为空（未启用应用中心或应用中心组件版本不含 centerMenus）时不请求，菜单为空 */
export const SubAppMenusProvider = ({ api, tenantId, children }) => {
  if (!api) {
    return <SubAppMenusContext.Provider value={DEFAULT_VALUE}>{children(EMPTY)}</SubAppMenusContext.Provider>;
  }
  return (
    <Loader api={api} tenantId={tenantId}>
      {children}
    </Loader>
  );
};

/** 打平叶子菜单；二级菜单的叶子带上父级名称 */
export const flattenMenus = (menus, locale) => {
  const labelOf = node => (locale && node.labelI18n?.[locale]) || node.label;
  const output = [];
  (menus || []).forEach(node => {
    if (node.children?.length) {
      node.children.forEach(child => output.push({ menu: child, parent: node, label: `${labelOf(node)} / ${labelOf(child)}` }));
    } else {
      output.push({ menu: node, label: labelOf(node) });
    }
  });
  return output;
};

/** 路由 splat（如 report/sales/detail/1）匹配到最长的叶子菜单 fullKey */
export const matchMenu = (menus, splat) => {
  const path = String(splat || '').replace(/^\/+|\/+$/g, '');
  const leaves = flattenMenus(menus).map(item => item.menu);
  return leaves.filter(menu => path === menu.fullKey || path.startsWith(`${menu.fullKey}/`)).sort((a, b) => b.fullKey.length - a.fullKey.length)[0];
};

export default SubAppMenusContext;
