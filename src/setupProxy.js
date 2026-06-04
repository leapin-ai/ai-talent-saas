const { createProxyMiddleware } = require('http-proxy-middleware');

function isSseRequest(req) {
  if (req.url && req.url.includes('/sse')) return true;
  const accept = req.headers.accept;
  return accept && String(accept).includes('text/event-stream');
}

module.exports = function (app) {
  app.use(
    '/api',
    createProxyMiddleware({
      target: 'http://localhost:8040',
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
};
