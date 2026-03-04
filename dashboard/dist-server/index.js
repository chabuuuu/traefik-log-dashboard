"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const db_1 = require("./db");
const agents_1 = __importDefault(require("./routes/agents"));
const proxy_1 = __importDefault(require("./routes/proxy"));
const app = (0, express_1.default)();
const PORT = parseInt(process.env.PORT || '3000', 10);
const DIST_DIR = path_1.default.resolve(__dirname, '../dist');
const DATA_DIR = process.env.DATA_DIR || '/data';
// Ensure data directory exists for SQLite
if (!fs_1.default.existsSync(DATA_DIR)) {
    fs_1.default.mkdirSync(DATA_DIR, { recursive: true });
}
// Initialize DB and sync env agents
(0, db_1.getDB)();
(0, db_1.syncEnvAgents)();
console.log('[server] Database initialized, env agents synced');
// --- Runtime config ---
function buildRuntimeConfig() {
    const pick = (...keys) => {
        for (const k of keys) {
            const v = process.env[k];
            if (v)
                return v;
        }
        return '';
    };
    const toBool = (val, fallback) => {
        const v = val.toLowerCase();
        if (['1', 'true', 'yes', 'on'].includes(v))
            return true;
        if (['0', 'false', 'no', 'off'].includes(v))
            return false;
        return fallback;
    };
    const toInt = (val, fallback) => {
        const n = parseInt(val, 10);
        return isNaN(n) ? fallback : n;
    };
    const basePath = pick('BASE_PATH', 'VITE_BASE_PATH');
    const baseDomain = pick('BASE_DOMAIN', 'VITE_BASE_DOMAIN');
    const showDemoRaw = pick('SHOW_DEMO_PAGE', 'DASHBOARD_SHOW_DEMO_PAGE');
    const refreshRaw = pick('DASHBOARD_REFRESH_INTERVAL_MS', 'REFRESH_INTERVAL_MS');
    const maxLogsRaw = pick('DASHBOARD_MAX_LOGS_DISPLAY', 'MAX_LOGS_DISPLAY');
    const density = pick('DASHBOARD_DENSITY', 'UI_DENSITY') || 'comfortable';
    const agentUrl = pick('AGENT_URL', 'AGENT_API_URL', 'VITE_AGENT_API_URL');
    const agentToken = pick('AGENT_API_TOKEN', 'AGENT_TOKEN', 'VITE_AGENT_API_TOKEN');
    const frontendAgentUrl = pick('DASHBOARD_DEFAULT_AGENT_URL', 'DEFAULT_AGENT_URL');
    return {
        basePath,
        baseDomain,
        showDemoPage: toBool(showDemoRaw, true),
        refreshIntervalMs: toInt(refreshRaw, 5000),
        maxLogsDisplay: toInt(maxLogsRaw, 1000),
        chartPalette: [
            'var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)',
            'var(--chart-4)', 'var(--chart-5)',
        ],
        density,
        themeTokens: {},
        defaultAgentUrl: frontendAgentUrl,
        defaultAgentToken: agentToken,
        configuredAgentUrl: agentUrl,
    };
}
const runtimeConfig = buildRuntimeConfig();
const runtimeConfigJSON = JSON.stringify(runtimeConfig);
// --- Middleware ---
app.use(express_1.default.json());
// --- API Routes (before static files) ---
// Dashboard agent management API
app.use('/api/dashboard/agents', agents_1.default);
// Runtime config endpoint
app.get('/api/dashboard-config', (_req, res) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.json(runtimeConfig);
});
app.get('/api/dashboard-config.json', (_req, res) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.json(runtimeConfig);
});
// Agent API proxy (logs, system, location)
app.use(proxy_1.default);
// --- Static files ---
// Generate runtime-config.js for the SPA
app.get('/runtime-config.js', (_req, res) => {
    res.setHeader('Content-Type', 'application/javascript');
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.send(`window.__DASHBOARD_CONFIG__ = ${runtimeConfigJSON};`);
});
// Serve static build assets with immutable caching
app.use('/assets', express_1.default.static(path_1.default.join(DIST_DIR, 'assets'), {
    maxAge: '1y',
    immutable: true,
}));
// Serve other static files
app.use(express_1.default.static(DIST_DIR, {
    index: false, // We handle index.html via SPA fallback
}));
// --- SPA Fallback ---
app.get('*', (_req, res) => {
    const indexPath = path_1.default.join(DIST_DIR, 'index.html');
    if (fs_1.default.existsSync(indexPath)) {
        res.sendFile(indexPath);
    }
    else {
        res.status(404).send('Dashboard not built. Run npm run build first.');
    }
});
// --- Start ---
app.listen(PORT, '0.0.0.0', () => {
    console.log(`[server] Dashboard server running on port ${PORT}`);
    console.log(`[server] Serving static files from ${DIST_DIR}`);
    console.log(`[server] Data directory: ${DATA_DIR}`);
});
