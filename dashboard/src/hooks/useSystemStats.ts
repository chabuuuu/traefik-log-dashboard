import { useState, useEffect } from 'react';
import { apiClient } from '@/utils/api-client';
import { useTabVisibility } from './useTabVisibility';
import { SystemStatsResponse } from '@/utils/types';
import { useAgents } from '@/utils/contexts/AgentContext';

export function useSystemStats(demoMode: boolean) {
  const [systemStats, setSystemStats] = useState<SystemStatsResponse | undefined>(undefined);
  const { selectedAgent } = useAgents();
  
  // REDUNDANCY FIX: Use shared visibility hook
  const isTabVisible = useTabVisibility();

  useEffect(() => {
    let isMounted = true;
    const abortController = new AbortController();

    async function fetchSystemStats() {
      // PERFORMANCE FIX: Don't fetch when demo mode or tab not visible
      if (demoMode || !isTabVisible) return;
      if (!selectedAgent?.id) {
        setSystemStats(undefined);
        return;
      }

      try {
        const data = await apiClient.getSystemResources({
          agentId: selectedAgent.id,
          signal: abortController.signal,
        });
        if (!isMounted) return;

        // Treat disabled monitoring as a non-error terminal state
        if (data && typeof data === 'object' && 'status' in data && (data as { status?: string }).status === 'disabled') {
          setSystemStats(data);
          return;
        }

        setSystemStats(data);
      } catch (error) {
        // Don't log abort errors as they're expected
        if (error instanceof Error && error.name === 'AbortError') {
          return;
        }
        if (isMounted) {
          console.error('Failed to fetch system stats:', error);
        }
      }
    }

    fetchSystemStats();
    // PERFORMANCE FIX: Increased from 5s to 15s to reduce CPU load
    const interval = setInterval(fetchSystemStats, 15000);

    return () => {
      isMounted = false;
      abortController.abort();
      clearInterval(interval);
    };
  }, [demoMode, isTabVisible, selectedAgent?.id]);

  return systemStats;
}
