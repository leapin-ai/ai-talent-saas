let oidcClient = null;

const RETURN_TO_KEY = 'kne-oidc:post-logout-returnTo';

/** end_session 只能回 `/`。returnTo 只在落地 `/` 的那次 login 恢复；禁止写进交互页/login 页上的 login() */
export const normalizeOidcClientLogout = client => {
  const logout = client.logout.bind(client);
  const login = client.login.bind(client);
  client.logout = async options => {
    if (window.location.pathname === '/account/login') {
      sessionStorage.removeItem(RETURN_TO_KEY);
    } else {
      sessionStorage.setItem(RETURN_TO_KEY, `${window.location.pathname}${window.location.search}${window.location.hash}`);
    }
    return logout({ ...options, returnTo: undefined });
  };
  client.login = options => {
    const returnTo = sessionStorage.getItem(RETURN_TO_KEY);
    if (returnTo && window.location.pathname === '/') {
      sessionStorage.removeItem(RETURN_TO_KEY);
      return login({ ...options, returnTo });
    }
    return login(options);
  };
  return client;
};

export const setOidcClient = client => {
  oidcClient = client;
};

export const getOidcClient = () => oidcClient;
