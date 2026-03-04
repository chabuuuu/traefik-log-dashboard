import { Router, Request, Response } from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { getSelectedAgent } from '../db';

const router = Router();

// Dynamic proxy — reads selected agent from DB on each request
function getTargetUrl(): string {
  const agent = getSelectedAgent();
  if (!agent) return 'http://localhost:5000';

  // Use configured_url (internal Docker URL) for server-side proxying,
  // falling back to the browser-facing url
  const url = (agent.configured_url || agent.url).replace(/\/+$/, '');
  return url;
}

function getAuthToken(): string {
  const agent = getSelectedAgent();
  return agent?.token || '';
}

// Proxy /api/logs/*, /api/system/*, /api/location/* to the selected agent
const proxyPaths = ['/api/logs', '/api/system', '/api/location'];

for (const basePath of proxyPaths) {
  router.use(
    basePath,
    createProxyMiddleware({
      router: () => getTargetUrl(),
      changeOrigin: true,
      on: {
        proxyReq: (proxyReq) => {
          const token = getAuthToken();
          if (token) {
            proxyReq.setHeader('Authorization', `Bearer ${token}`);
          }
        },
        error: (err, _req, res) => {
          console.error(`Proxy error: ${err.message}`);
          if (res && 'writeHead' in res) {
            (res as Response).status(502).json({
              error: 'Agent unreachable',
              message: err.message,
            });
          }
        },
      },
      // SSE/streaming support
      timeout: 3600000,
      proxyTimeout: 3600000,
    }),
  );
}

export default router;
