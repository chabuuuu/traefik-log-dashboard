export interface RuntimeConfig {
  basePath?: string;
  baseDomain?: string;
  showDemoPage?: boolean;
  refreshIntervalMs?: number;
  maxLogsDisplay?: number;
  defaultAgentUrl?: string;
  defaultAgentToken?: string;
}

export function getRuntimeConfig(): RuntimeConfig {
  if (typeof window === 'undefined') return {};
  const anyWindow = window as Window & { __DASHBOARD_CONFIG__?: RuntimeConfig };
  return anyWindow.__DASHBOARD_CONFIG__ ?? {};
}
