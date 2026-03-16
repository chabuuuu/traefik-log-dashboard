#!/bin/sh
set -e

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

# Resolve environment variables with fallback aliases.
# The Node.js server reads these directly from process.env.
export AGENT_API_URL="$(pick_first_non_empty AGENT_API_URL AGENT_URL || echo 'http://traefik-agent:5000')"
export AGENT_API_TOKEN="$(pick_first_non_empty AGENT_API_TOKEN AGENT_TOKEN || true)"
export DASHBOARD_DEFAULT_AGENT_URL="$(pick_first_non_empty DASHBOARD_DEFAULT_AGENT_URL || true)"
export BASE_PATH="$(pick_first_non_empty BASE_PATH VITE_BASE_PATH || true)"
export BASE_DOMAIN="$(pick_first_non_empty BASE_DOMAIN VITE_BASE_DOMAIN || true)"
export SHOW_DEMO_PAGE="$(pick_first_non_empty SHOW_DEMO_PAGE DASHBOARD_SHOW_DEMO_PAGE || true)"
export DASHBOARD_REFRESH_INTERVAL_MS="$(pick_first_non_empty DASHBOARD_REFRESH_INTERVAL_MS REFRESH_INTERVAL_MS || true)"
export DASHBOARD_MAX_LOGS_DISPLAY="$(pick_first_non_empty DASHBOARD_MAX_LOGS_DISPLAY MAX_LOGS_DISPLAY || true)"
export DASHBOARD_TRAFFIC_TOP_ITEMS_LIMIT="$(pick_first_non_empty DASHBOARD_TRAFFIC_TOP_ITEMS_LIMIT || true)"
export DASHBOARD_PARSER_TREND_WINDOW_MINUTES="$(pick_first_non_empty DASHBOARD_PARSER_TREND_WINDOW_MINUTES || true)"
export DASHBOARD_AGENTS_ENV_ONLY="$(pick_first_non_empty DASHBOARD_AGENTS_ENV_ONLY || true)"
export DASHBOARD_DENSITY="$(pick_first_non_empty DASHBOARD_DENSITY UI_DENSITY || true)"

exec "$@"
