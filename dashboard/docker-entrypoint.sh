#!/bin/sh
set -e

DIST_DIR="/usr/share/nginx/html"
NGINX_TEMPLATE="/etc/nginx/templates/default.conf.template"
NGINX_CONFIG="/etc/nginx/conf.d/default.conf"

pick_first_non_empty() {
  for key in "$@"; do
    eval "value=\${$key:-}"
    if [ -n "$value" ]; then
      printf '%s' "$value"
      return 0
    fi
  done
  return 1
}

to_bool() {
  value=$(printf '%s' "$1" | tr '[:upper:]' '[:lower:]')
  fallback="$2"
  case "$value" in
    1|true|yes|on) printf 'true' ;;
    0|false|no|off) printf 'false' ;;
    *) printf '%s' "$fallback" ;;
  esac
}

to_int() {
  value="$1"
  fallback="$2"
  case "$value" in
    ''|*[!0-9]*) printf '%s' "$fallback" ;;
    *) printf '%s' "$value" ;;
  esac
}

json_escape() {
  printf '%s' "$1" | sed 's/\\/\\\\/g; s/"/\\"/g'
}

BASE_PATH="$(pick_first_non_empty BASE_PATH VITE_BASE_PATH || true)"
BASE_DOMAIN="$(pick_first_non_empty BASE_DOMAIN VITE_BASE_DOMAIN || true)"
SHOW_DEMO_RAW="$(pick_first_non_empty SHOW_DEMO_PAGE DASHBOARD_SHOW_DEMO_PAGE || true)"
REFRESH_INTERVAL_RAW="$(pick_first_non_empty DASHBOARD_REFRESH_INTERVAL_MS REFRESH_INTERVAL_MS || true)"
MAX_LOGS_RAW="$(pick_first_non_empty DASHBOARD_MAX_LOGS_DISPLAY MAX_LOGS_DISPLAY || true)"
DENSITY="$(pick_first_non_empty DASHBOARD_DENSITY UI_DENSITY || true)"
AGENT_URL="$(pick_first_non_empty AGENT_URL AGENT_API_URL VITE_AGENT_API_URL || true)"
AGENT_TOKEN="$(pick_first_non_empty AGENT_API_TOKEN AGENT_TOKEN VITE_AGENT_API_TOKEN || true)"
FRONTEND_AGENT_URL="$(pick_first_non_empty DASHBOARD_DEFAULT_AGENT_URL DEFAULT_AGENT_URL || true)"

[ -n "$DENSITY" ] || DENSITY="comfortable"
SHOW_DEMO="$(to_bool "$SHOW_DEMO_RAW" "true")"
REFRESH_INTERVAL="$(to_int "$REFRESH_INTERVAL_RAW" "5000")"
MAX_LOGS="$(to_int "$MAX_LOGS_RAW" "1000")"

BASE_PATH_ESCAPED="$(json_escape "$BASE_PATH")"
BASE_DOMAIN_ESCAPED="$(json_escape "$BASE_DOMAIN")"
DENSITY_ESCAPED="$(json_escape "$DENSITY")"
AGENT_TOKEN_ESCAPED="$(json_escape "$AGENT_TOKEN")"
FRONTEND_AGENT_URL_ESCAPED="$(json_escape "$FRONTEND_AGENT_URL")"

[ -n "$AGENT_URL" ] || AGENT_URL="http://traefik-agent:5000"

AGENT_UPSTREAM="$(printf '%s' "$AGENT_URL" | sed 's:/*$::')"
case "$AGENT_UPSTREAM" in
  */api|*/api/*)
    AGENT_UPSTREAM="${AGENT_UPSTREAM%/api*}"
    ;;
esac

RUNTIME_CONFIG_JSON=$(cat <<EOF
{
  "basePath": "$BASE_PATH_ESCAPED",
  "baseDomain": "$BASE_DOMAIN_ESCAPED",
  "showDemoPage": $SHOW_DEMO,
  "refreshIntervalMs": $REFRESH_INTERVAL,
  "maxLogsDisplay": $MAX_LOGS,
  "chartPalette": ["var(--chart-1)","var(--chart-2)","var(--chart-3)","var(--chart-4)","var(--chart-5)"],
  "density": "$DENSITY_ESCAPED",
  "themeTokens": {},
  "defaultAgentUrl": "$FRONTEND_AGENT_URL_ESCAPED",
  "defaultAgentToken": "$AGENT_TOKEN_ESCAPED"
}
EOF
)

# Generate runtime JS consumed by index.html (works without HTML rewriting).
cat > "$DIST_DIR/runtime-config.js" <<EOF
window.__DASHBOARD_CONFIG__ = $RUNTIME_CONFIG_JSON;
EOF

# Generate /api/dashboard-config and /api/dashboard-config.json static endpoints
CONFIG_DIR="$DIST_DIR/api"
mkdir -p "$CONFIG_DIR"
cat > "$CONFIG_DIR/dashboard-config" <<EOF
$RUNTIME_CONFIG_JSON
EOF
cat > "$CONFIG_DIR/dashboard-config.json" <<EOF
$RUNTIME_CONFIG_JSON
EOF

# Render nginx config with the resolved upstream.
if [ -f "$NGINX_TEMPLATE" ]; then
  sed "s|__AGENT_UPSTREAM__|$AGENT_UPSTREAM|g" "$NGINX_TEMPLATE" > "$NGINX_CONFIG"
fi

exec "$@"
