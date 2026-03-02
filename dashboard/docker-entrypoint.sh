#!/bin/sh
set -e

# Default agent URL if not provided
AGENT_URL="${AGENT_URL:-http://localhost:5000}"

# Run envsubst on nginx config template
envsubst '${AGENT_URL}' < /etc/nginx/nginx.conf.template > /etc/nginx/conf.d/default.conf

# Inject runtime config into index.html
# This allows the dashboard to discover agent URL/token without rebuilding
INDEX_FILE="/usr/share/nginx/html/index.html"
if [ -f "$INDEX_FILE" ]; then
    RUNTIME_CONFIG="$(cat <<JSONEOF
{
  "basePath":"${BASE_PATH:-}",
  "baseDomain":"${BASE_DOMAIN:-}",
  "showDemoPage":${SHOW_DEMO_PAGE:-true},
  "refreshIntervalMs":${DASHBOARD_REFRESH_INTERVAL_MS:-5000},
  "maxLogsDisplay":${DASHBOARD_MAX_LOGS_DISPLAY:-1000},
  "density":"${DASHBOARD_DENSITY:-comfortable}",
  "defaultAgentUrl":"${AGENT_URL}",
  "defaultAgentToken":"${AGENT_API_TOKEN:-}"
}
JSONEOF
)"
    # Collapse to single line for safe injection into <script> tag
    RUNTIME_CONFIG_LINE="$(echo "$RUNTIME_CONFIG" | tr -d '\n')"
    sed -i "s|</head>|<script>window.__DASHBOARD_CONFIG__=${RUNTIME_CONFIG_LINE};</script></head>|" "$INDEX_FILE"
fi

# Generate /api/dashboard-config as a static JSON file served by nginx
CONFIG_DIR="/usr/share/nginx/html/api"
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
  "defaultAgentUrl": "${AGENT_URL}",
  "defaultAgentToken": "${AGENT_API_TOKEN:-}"
}
EOF

exec "$@"
