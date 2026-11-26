const { createProxyMiddleware } = require('http-proxy-middleware');

function isSseRequest(req) {
  if (req.url && req.url.includes('/sse')) return true;
  const accept = req.headers.accept;
  return accept && String(accept).includes('text/event-stream');
}

module.exports = function (app) {
  app.use(
    createProxyMiddleware({
      target: 'http://localhost:8050',
      pathFilter: '/api',
      changeOrigin: true,
      on: {
        proxyReq(proxyReq, req, res) {
          if (!isSseRequest(req)) return;

          const abortUpstream = () => {
            if (proxyReq.destroyed) return;
            proxyReq.destroy();
          };

          req.once('aborted', abortUpstream);
          // req 的 close 在请求体读完时就会触发，客户端断开要监听 res
          res.once('close', abortUpstream);
          req.socket?.once('close', abortUpstream);
        }
      }
    })
  );
  // 保留 Host（localhost:3050），oidc-provider 据此生成 issuer 一致的跳转地址
  app.use(
    createProxyMiddleware({
      target: 'http://localhost:8050',
      // 前缀匹配会误伤前端路由 /oidc-interaction、/oidc-callback
      pathFilter: path => path === '/oidc' || path.startsWith('/oidc/'),
      xfwd: true
    })
  );
  // 应用中心托管的子应用挂在 /app/{name}；不能用前缀匹配，会误伤前端路由 /apps
  app.use(
    createProxyMiddleware({
      target: 'http://localhost:8050',
      pathFilter: path => path === '/app' || path.startsWith('/app/'),
      changeOrigin: true
    })
  );
  // OpenAPI 文档挂在根路径，不在 /api 下（Signature 作用域从这里读 paths）
  app.use(
    createProxyMiddleware({
      target: 'http://localhost:8050',
      pathFilter: path => path === '/open-api.json' || path.startsWith('/open-api.json?'),
      changeOrigin: true
    })
  );
};
