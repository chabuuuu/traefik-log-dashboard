/// <reference types="vite/client" />

declare interface Window {
  __DASHBOARD_CONFIG__?: {
    basePath?: string;
    baseDomain?: string;
    showDemoPage?: boolean;
    refreshIntervalMs?: number;
    maxLogsDisplay?: number;
    trafficTopItemsLimit?: number;
    parserTrendWindowMinutes?: number;
    agentsEnvOnly?: boolean;
    hideInternalTrafficDefault?: boolean;
    internalNoisePathPrefixes?: string[];
    internalNoiseServicePatterns?: string[];
    density?: 'compact' | 'comfortable';
    chartPalette?: string[];
    themeTokens?: Record<string, string>;
    defaultAgentUrl?: string;
    defaultAgentConfigured?: boolean;
  };
}
