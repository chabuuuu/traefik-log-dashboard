/// <reference types="vite/client" />

declare interface Window {
  __DASHBOARD_CONFIG__?: {
    basePath?: string;
    baseDomain?: string;
    showDemoPage?: boolean;
    refreshIntervalMs?: number;
    maxLogsDisplay?: number;
    density?: 'compact' | 'comfortable';
    chartPalette?: string[];
    themeTokens?: Record<string, string>;
    defaultAgentUrl?: string;
    defaultAgentToken?: string;
  };
}
