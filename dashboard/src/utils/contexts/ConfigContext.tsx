import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';

export interface DashboardConfig {
  basePath: string;
  baseDomain: string;
  showDemoPage: boolean;
  refreshIntervalMs: number;
  maxLogsDisplay: number;
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
  const response = await fetch('/api/dashboard-config', { cache: 'no-store' });
  if (!response.ok) {
    throw new Error(`Failed to load dashboard config: ${response.status}`);
  }
  return (await response.json()) as DashboardConfig;
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
