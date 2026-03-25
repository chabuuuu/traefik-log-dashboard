import crypto from 'crypto';
import { NextFunction, Request, Response, Router } from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { DBAgent, getAllAgents, getAgentById, getSelectedAgent, serializeAgent } from '../db';
import {
  getAlertNotificationStats,
  listAlertNotificationHistory,
  listAlertRules,
  listAlertWebhooks,
} from '../alerts/repository';
import { runtimeConfig } from '../config';
import { getAgentIDFromRequest, normalizeProxyTarget } from './proxy';

const router = Router();

// --- Auth middleware ---

export function requireMobileApiKey(req: Request, res: Response, next: NextFunction): void {
  // Mobile app uses browser-style `fetch()` to a user-provided absolute URL.
  // Those requests commonly trigger CORS preflight `OPTIONS`, so we must
  // respond with CORS headers even before validating the API key.
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Content-Type, X-API-Key, Authorization, X-Agent-Id',
  );
  res.setHeader('Access-Control-Max-Age', '86400');

  if (req.method?.toUpperCase() === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  const configuredKey = process.env.MOBILE_API_KEY;
  if (!configuredKey) {
    res.status(503).json({
      error: 'Mobile API disabled',
      message: 'MOBILE_API_KEY environment variable is not configured',
    });
    return;
  }

  const headerKey =
    req.header('x-api-key') ||
    req.header('authorization')?.replace(/^Bearer\s+/i, '') ||
    '';

  if (!headerKey) {
    res.status(401).json({
      error: 'Unauthorized',
      message: 'Missing API key. Provide via X-API-Key header or Authorization: Bearer header.',
    });
    return;
  }

  const keyBuffer = Buffer.from(headerKey);
  const configuredBuffer = Buffer.from(configuredKey);

  if (keyBuffer.length !== configuredBuffer.length || !crypto.timingSafeEqual(keyBuffer, configuredBuffer)) {
    res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid API key',
    });
    return;
  }

  next();
}

router.use(requireMobileApiKey);

// --- Helpers ---

function serializeAgentForMobile(row: DBAgent) {
  const { token, ...rest } = serializeAgent(row);
  return rest;
}

// --- Dashboard-local endpoints ---

// List all agents (tokens stripped)
router.get('/agents', (_req, res) => {
  try {
    const agents = getAllAgents().map(serializeAgentForMobile);
    res.json(agents);
  } catch (err) {
    console.error('[mobile] Error listing agents:', err);
    res.status(500).json({ error: 'Internal error', message: 'Failed to list agents' });
  }
});

// Single agent detail (token stripped)
router.get('/agents/:id', (req, res) => {
  try {
    const agent = getAgentById(req.params.id);
    if (!agent) {
      res.status(404).json({ error: 'Agent not found', message: `Agent ${req.params.id} does not exist` });
      return;
    }
    res.json(serializeAgentForMobile(agent));
  } catch (err) {
    console.error('[mobile] Error getting agent:', err);
    res.status(500).json({ error: 'Internal error', message: 'Failed to get agent' });
  }
});

// Alert rules
router.get('/alerts/rules', (_req, res) => {
  try {
    res.json(listAlertRules());
  } catch (err) {
    console.error('[mobile] Error listing alert rules:', err);
    res.status(500).json({ error: 'Internal error', message: 'Failed to list alert rules' });
  }
});

// Alert webhooks
router.get('/alerts/webhooks', (_req, res) => {
  try {
    res.json(listAlertWebhooks());
  } catch (err) {
    console.error('[mobile] Error listing webhooks:', err);
    res.status(500).json({ error: 'Internal error', message: 'Failed to list webhooks' });
  }
});

// Notification history (paginated)
router.get('/alerts/history', (req, res) => {
  try {
    const limit = Math.min(Math.max(parseInt(String(req.query.limit), 10) || 50, 1), 500);
    res.json(listAlertNotificationHistory(limit));
  } catch (err) {
    console.error('[mobile] Error listing notification history:', err);
    res.status(500).json({ error: 'Internal error', message: 'Failed to list notification history' });
  }
});

// Alert stats
router.get('/alerts/stats', (_req, res) => {
  try {
    res.json(getAlertNotificationStats());
  } catch (err) {
    console.error('[mobile] Error getting alert stats:', err);
    res.status(500).json({ error: 'Internal error', message: 'Failed to get alert stats' });
  }
});

// Runtime dashboard config
router.get('/config', (_req, res) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.json(runtimeConfig);
});

// Aggregated overview for mobile home screen
router.get('/overview', (_req, res) => {
  try {
    const agents = getAllAgents();
    const selectedAgent = getSelectedAgent();
    const rules = listAlertRules();
    const stats = getAlertNotificationStats();

    const onlineCount = agents.filter((a) => a.status === 'online').length;
    const offlineCount = agents.filter((a) => a.status === 'offline').length;

    res.json({
      agent: selectedAgent
        ? {
            id: selectedAgent.id,
            name: selectedAgent.name,
            status: selectedAgent.status,
            lastSeen: selectedAgent.last_seen ?? undefined,
          }
        : null,
      agents_summary: {
        total: agents.length,
        online: onlineCount,
        offline: offlineCount,
      },
      alerts_summary: {
        total_rules: rules.length,
        enabled_rules: rules.filter((r) => r.enabled).length,
        recent_notifications_24h: stats.last24h,
        failed_notifications_24h: stats.failed,
      },
    });
  } catch (err) {
    console.error('[mobile] Error building overview:', err);
    res.status(500).json({ error: 'Internal error', message: 'Failed to build overview' });
  }
});

// --- Agent-proxied endpoints ---

interface ProxyAgentContext {
  id: string;
  target: string;
  token: string;
}

type ProxyRequest = Request & {
  proxyAgent?: ProxyAgentContext;
};

function resolveProxyAgent(req: ProxyRequest, res: Response, next: NextFunction): void {
  const agentID = getAgentIDFromRequest(req);
  if (!agentID) {
    res.status(400).json({
      error: 'Missing agent id',
      message: 'X-Agent-Id header is required',
    });
    return;
  }

  const agent = getAgentById(agentID);
  if (!agent) {
    res.status(404).json({
      error: 'Agent not found',
      message: `Agent ${agentID} does not exist`,
    });
    return;
  }

  req.proxyAgent = {
    id: agent.id,
    target: normalizeProxyTarget(agent.configured_url || agent.url),
    token: agent.token || '',
  };

  next();
}

// Proxy /api/mobile/logs/* -> agent /api/logs/*
// Proxy /api/mobile/system/* -> agent /api/system/*
const proxyPaths = ['/logs', '/system'];

for (const basePath of proxyPaths) {
  router.use(
    basePath,
    resolveProxyAgent,
    createProxyMiddleware({
      router: (req) => (req as ProxyRequest).proxyAgent?.target || 'http://localhost:5000',
      changeOrigin: true,
      on: {
        proxyReq: (proxyReq, req) => {
          // Rewrite path: /api/mobile/logs/access -> /api/logs/access
          const originalUrl = (req as ProxyRequest).originalUrl;
          if (originalUrl) {
            proxyReq.path = originalUrl.replace('/api/mobile/', '/api/');
          }

          const token = (req as ProxyRequest).proxyAgent?.token || '';
          if (token) {
            proxyReq.setHeader('Authorization', `Bearer ${token}`);
          } else {
            proxyReq.removeHeader('Authorization');
          }
        },
        error: (err, req, res) => {
          const agentID = (req as ProxyRequest).proxyAgent?.id || 'unknown';
          console.error(`[mobile] Proxy error: ${err.message}`);
          if (res && 'writeHead' in res) {
            (res as Response).status(502).json({
              error: 'Agent unreachable',
              agentId: agentID,
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
