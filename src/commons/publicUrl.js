/**
 * App-manager injects window.runtimePublicUrl as `/app/{name}` (no trailing slash) or `/`.
 * Full-page redirects must join with a slash and must not double-prefix.
 */
const getPublicBasePath = () => {
  const raw = window.PUBLIC_URL || window.runtimePublicUrl || '';
  if (!raw || raw === '/') {
    return '';
  }
  return String(raw).replace(/\/+$/, '');
};

const withPublicUrl = pathname => {
  const base = getPublicBasePath();
  let path = String(pathname || '');
  if (!path.startsWith('/')) {
    path = `/${path}`;
  }
  if (base && (path === base || path.startsWith(`${base}/`))) {
    return path;
  }
  return `${base}${path}`;
};

const getRouterBasename = () => getPublicBasePath() || undefined;

export { getPublicBasePath, withPublicUrl, getRouterBasename };
