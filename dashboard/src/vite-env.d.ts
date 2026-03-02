/// <reference types="vite/client" />

declare interface Window {
  __DASHBOARD_CONFIG__?: {
    basePath?: string;
    baseDomain?: string;
    showDemoPage?: boolean;
    refreshIntervalMs?: number;
    maxLogsDisplay?: number;
    defaultAgentUrl?: string;
    defaultAgentToken?: string;
  };
}
