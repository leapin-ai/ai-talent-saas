const { createProxyMiddleware } = require('http-proxy-middleware');

function isSseRequest(req) {
  if (req.url && req.url.includes('/sse')) return true;
  const accept = req.headers.accept;
  return accept && String(accept).includes('text/event-stream');
}

module.exports = function (app) {
  app.use(
    createProxyMiddleware({
      target: 'http://localhost:8040',
      pathFilter: '/api',
      changeOrigin: true,
      on: {
        proxyReq(proxyReq, req) {
          if (!isSseRequest(req)) return;

          const abortUpstream = () => {
            if (proxyReq.destroyed) return;
            proxyReq.destroy();
          };

          req.once('aborted', abortUpstream);
          req.once('close', abortUpstream);
          req.socket?.once('close', abortUpstream);
        }
      }
    })
  );
  // 保留 Host（localhost:3040），oidc-provider 据此生成 issuer 一致的跳转地址
  app.use(
    createProxyMiddleware({
      target: 'http://localhost:8040',
      // 前缀匹配会误伤前端路由 /oidc-interaction、/oidc-callback
      pathFilter: path => path === '/oidc' || path.startsWith('/oidc/'),
      xfwd: true
    })
  );
};
