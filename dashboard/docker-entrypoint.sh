#!/bin/sh
set -e

DIST_DIR="/app/dist"
INDEX_FILE="$DIST_DIR/index.html"

# Inject runtime config into index.html
# This allows the dashboard to discover agent URL/token without rebuilding
if [ -f "$INDEX_FILE" ]; then
    RUNTIME_CONFIG="{\"basePath\":\"${BASE_PATH:-}\",\"baseDomain\":\"${BASE_DOMAIN:-}\",\"showDemoPage\":${SHOW_DEMO_PAGE:-true},\"refreshIntervalMs\":${DASHBOARD_REFRESH_INTERVAL_MS:-5000},\"maxLogsDisplay\":${DASHBOARD_MAX_LOGS_DISPLAY:-1000},\"density\":\"${DASHBOARD_DENSITY:-comfortable}\",\"defaultAgentUrl\":\"${AGENT_URL:-}\",\"defaultAgentToken\":\"${AGENT_API_TOKEN:-}\"}"
    sed -i "s|</head>|<script>window.__DASHBOARD_CONFIG__=${RUNTIME_CONFIG};</script></head>|" "$INDEX_FILE"
fi

# Generate /api/dashboard-config as a static JSON file
CONFIG_DIR="$DIST_DIR/api"
mkdir -p "$CONFIG_DIR"
cat > "$CONFIG_DIR/dashboard-config" <<EOF
{
  "basePath": "${BASE_PATH:-}",
  "baseDomain": "${BASE_DOMAIN:-}",
  "showDemoPage": ${SHOW_DEMO_PAGE:-true},
  "refreshIntervalMs": ${DASHBOARD_REFRESH_INTERVAL_MS:-5000},
  "maxLogsDisplay": ${DASHBOARD_MAX_LOGS_DISPLAY:-1000},
  "chartPalette": ["var(--chart-1)","var(--chart-2)","var(--chart-3)","var(--chart-4)","var(--chart-5)"],
  "density": "${DASHBOARD_DENSITY:-comfortable}",
  "themeTokens": {},
  "defaultAgentUrl": "${AGENT_URL:-}",
  "defaultAgentToken": "${AGENT_API_TOKEN:-}"
}
EOF

exec "$@"
