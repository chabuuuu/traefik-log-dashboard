"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const http_proxy_middleware_1 = require("http-proxy-middleware");
const db_1 = require("../db");
const router = (0, express_1.Router)();
// Dynamic proxy — reads selected agent from DB on each request
function getTargetUrl() {
    const agent = (0, db_1.getSelectedAgent)();
    if (!agent)
        return 'http://localhost:5000';
    // Use configured_url (internal Docker URL) for server-side proxying,
    // falling back to the browser-facing url
    const url = (agent.configured_url || agent.url).replace(/\/+$/, '');
    return url;
}
function getAuthToken() {
    const agent = (0, db_1.getSelectedAgent)();
    return agent?.token || '';
}
// Proxy /api/logs/*, /api/system/*, /api/location/* to the selected agent
const proxyPaths = ['/api/logs', '/api/system', '/api/location'];
for (const basePath of proxyPaths) {
    router.use(basePath, (0, http_proxy_middleware_1.createProxyMiddleware)({
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
                    res.status(502).json({
                        error: 'Agent unreachable',
                        message: err.message,
                    });
                }
            },
        },
        // SSE/streaming support
        timeout: 3600000,
        proxyTimeout: 3600000,
    }));
}
exports.default = router;
