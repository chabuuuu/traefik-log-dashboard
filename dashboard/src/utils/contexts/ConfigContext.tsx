import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';

export interface DashboardConfig {
  basePath: string;
  baseDomain: string;
  showDemoPage: boolean;
  refreshIntervalMs: number;
  maxLogsDisplay: number;
  trafficTopItemsLimit: number;
  parserTrendWindowMinutes: number;
  agentsEnvOnly: boolean;
  hideInternalTrafficDefault: boolean;
  internalNoisePathPrefixes: string[];
  internalNoiseServicePatterns: string[];
  defaultAgentUrl?: string;
  defaultAgentToken?: string;
  chartPalette: string[];
  density: 'compact' | 'comfortable';
  themeTokens?: Record<string, string>;
}

const defaultConfig: DashboardConfig = {
  basePath: '',
  baseDomain: '',
  showDemoPage: true,
  refreshIntervalMs: 5000,
  maxLogsDisplay: 1000,
  trafficTopItemsLimit: 10,
  parserTrendWindowMinutes: 30,
  agentsEnvOnly: false,
  hideInternalTrafficDefault: true,
  internalNoisePathPrefixes: [
    '/api/system/resources',
    '/api/logs/status',
    '/api/location',
    '/api/dashboard/agents/check-status',
  ],
  internalNoiseServicePatterns: ['dashboard', 'agent', 'traefik-log-dashboard', 'log-dashboard'],
  chartPalette: ['var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)', 'var(--chart-4)', 'var(--chart-5)'],
  density: 'comfortable',
};

interface ConfigState {
  config: DashboardConfig;
  loading: boolean;
  error: string | null;
}

const ConfigContext = createContext<ConfigState>({
  config: defaultConfig,
  loading: true,
  error: null,
});

function getInlineConfig(): Partial<DashboardConfig> | null {
  if (typeof window === 'undefined') return null;
  const anyWindow = window as Window & { __DASHBOARD_CONFIG__?: Partial<DashboardConfig> };
  return anyWindow.__DASHBOARD_CONFIG__ ?? null;
}

async function fetchConfig(): Promise<DashboardConfig> {
  const endpoints = ['/api/dashboard-config.json', '/api/dashboard-config'];
  let lastError: Error | null = null;

  for (const endpoint of endpoints) {
    try {
      const response = await fetch(endpoint, { cache: 'no-store' });
      if (!response.ok) {
        lastError = new Error(`Failed to load dashboard config from ${endpoint}: ${response.status}`);
        continue;
      }

      return (await response.json()) as DashboardConfig;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error('Failed to load config');
    }
  }

  throw lastError ?? new Error('Failed to load dashboard config');
}

export function ConfigProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<ConfigState>({
    config: defaultConfig,
    loading: true,
    error: null,
  });

  useEffect(() => {
    let isMounted = true;
    const inlineConfig = getInlineConfig();

    if (inlineConfig && isMounted) {
      setState({
        config: { ...defaultConfig, ...inlineConfig },
        loading: false,
        error: null,
      });
    }

    fetchConfig()
      .then((config) => {
        if (!isMounted) return;
        setState({
          config: { ...defaultConfig, ...config },
          loading: false,
          error: null,
        });
      })
      .catch((error) => {
        if (!isMounted) return;
        setState((prev) => ({
          ...prev,
          loading: false,
          error: error instanceof Error ? error.message : 'Failed to load config',
        }));
      });

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const tokens = state.config.themeTokens;
    if (!tokens) return;
    const root = document.documentElement;
    Object.entries(tokens).forEach(([key, value]) => {
      root.style.setProperty(key, value);
    });
  }, [state.config.themeTokens]);

  const value = useMemo(() => state, [state]);

  return <ConfigContext.Provider value={value}>{children}</ConfigContext.Provider>;
}

export function useConfig() {
  return useContext(ConfigContext);
}
