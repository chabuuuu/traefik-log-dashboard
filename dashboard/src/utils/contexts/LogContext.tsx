import React, { createContext, useContext, useMemo } from 'react';
import { TraefikLog } from '@/utils/types';
import { useLogFetcher, DedupeDebugStats } from '@/hooks/useLogFetcher';

interface LogContextType {
  logs: TraefikLog[];
  loading: boolean;
  error: string | null;
  connected: boolean;
  lastUpdate: Date | null;
  isPaused: boolean;
  setIsPaused: (paused: boolean) => void;
  agentId: string | null;
  agentName: string | null;
  dedupeDebug: DedupeDebugStats | null;
  isCatchingUp: boolean;
  isCached: boolean;
}

const LogContext = createContext<LogContextType | undefined>(undefined);

/**
 * LogProvider wraps all routes and runs useLogFetcher continuously.
 * This means log fetching/streaming continues regardless of which page
 * the user is on (dashboard, settings, etc.), so logs are always
 * up-to-date when the user returns to the dashboard.
 *
 * Must be placed inside AgentProvider and ConfigProvider.
 */
export function LogProvider({ children }: { children: React.ReactNode }) {
  const logFetcherState = useLogFetcher();

  const value = useMemo(
    () => logFetcherState,
    [
      logFetcherState.logs,
      logFetcherState.loading,
      logFetcherState.error,
      logFetcherState.connected,
      logFetcherState.lastUpdate,
      logFetcherState.isPaused,
      logFetcherState.setIsPaused,
      logFetcherState.agentId,
      logFetcherState.agentName,
      logFetcherState.dedupeDebug,
      logFetcherState.isCatchingUp,
      logFetcherState.isCached,
    ]
  );

  return <LogContext.Provider value={value}>{children}</LogContext.Provider>;
}

export function useLogContext(): LogContextType {
  const context = useContext(LogContext);
  if (!context) {
    throw new Error('useLogContext must be used within a LogProvider');
  }
  return context;
}
