import { useEffect, useRef, useState } from 'react';
import { apiClient } from '@/utils/api-client';
import { ParserMetrics, StatusResponse } from '@/utils/types';
import { useTabVisibility } from './useTabVisibility';

interface UseAgentStatusInput {
  agentId?: string;
  demoMode?: boolean;
  intervalMs?: number;
  trendWindowMinutes?: number;
}

export interface ParserRatioTrendPoint {
  timestamp: number;
  unknownRatio: number;
  errorRatio: number;
}

interface UseAgentStatusResult {
  status: StatusResponse | null;
  loading: boolean;
  error: string | null;
  lastUpdate: Date | null;
  parserTrend: ParserRatioTrendPoint[];
}

interface RatioSample {
  unknownRatio: number;
  errorRatio: number;
}

function buildParserRatioSample(
  current: ParserMetrics,
  previous?: ParserMetrics,
): RatioSample {
  const currentParsed = current.json + current.traefik_clf + current.generic_clf;
  const currentTotal = currentParsed + current.unknown;

  if (previous) {
    const prevParsed = previous.json + previous.traefik_clf + previous.generic_clf;
    const prevTotal = prevParsed + previous.unknown;

    const parsedDelta = Math.max(0, currentParsed - prevParsed);
    const totalDelta = Math.max(0, currentTotal - prevTotal);
    const unknownDelta = Math.max(0, current.unknown - previous.unknown);
    const errorDelta = Math.max(0, current.errors - previous.errors);

    if (totalDelta > 0) {
      return {
        unknownRatio: unknownDelta / totalDelta,
        errorRatio: parsedDelta > 0 ? errorDelta / parsedDelta : 0,
      };
    }
  }

  return {
    unknownRatio: currentTotal > 0 ? current.unknown / currentTotal : 0,
    errorRatio: currentParsed > 0 ? current.errors / currentParsed : 0,
  };
}

export function useAgentStatus(input: UseAgentStatusInput): UseAgentStatusResult {
  const { agentId, demoMode = false, intervalMs = 15000, trendWindowMinutes = 30 } = input;
  const isTabVisible = useTabVisibility();

  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [parserTrend, setParserTrend] = useState<ParserRatioTrendPoint[]>([]);
  const previousParserMetricsRef = useRef<ParserMetrics | null>(null);

  useEffect(() => {
    setStatus(null);
    setError(null);
    setLastUpdate(null);
    setParserTrend([]);
    previousParserMetricsRef.current = null;
    if (demoMode || !agentId) {
      setLoading(false);
    }
  }, [agentId, demoMode]);

  useEffect(() => {
    if (demoMode || !agentId) {
      return;
    }

    let isMounted = true;
    const activeControllers = new Set<AbortController>();

    const fetchStatus = async () => {
      if (!isTabVisible) {
        return;
      }

      const controller = new AbortController();
      activeControllers.add(controller);
      try {
        setLoading(true);
        const payload = await apiClient.getStatus({ agentId, signal: controller.signal });
        if (!isMounted) {
          return;
        }

        setStatus(payload);
        setError(null);
        setLastUpdate(new Date());
        setParserTrend((previousTrend) => {
          if (!payload.parser_metrics) {
            previousParserMetricsRef.current = null;
            return previousTrend;
          }

          const now = Date.now();
          const previousMetrics = previousParserMetricsRef.current ?? undefined;
          const ratio = buildParserRatioSample(payload.parser_metrics, previousMetrics);
          const minTimestamp = now - trendWindowMinutes * 60_000;
          previousParserMetricsRef.current = payload.parser_metrics;

          return [
            ...previousTrend.filter((point) => point.timestamp >= minTimestamp),
            {
              timestamp: now,
              unknownRatio: ratio.unknownRatio,
              errorRatio: ratio.errorRatio,
            },
          ];
        });
      } catch (err) {
        if (!isMounted) {
          return;
        }
        if (err instanceof Error && err.name === 'AbortError') {
          return;
        }
        setError(err instanceof Error ? err.message : 'Failed to fetch agent status');
      } finally {
        activeControllers.delete(controller);
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchStatus();
    const interval = setInterval(fetchStatus, intervalMs);

    return () => {
      isMounted = false;
      activeControllers.forEach((controller) => controller.abort());
      activeControllers.clear();
      clearInterval(interval);
    };
  }, [agentId, demoMode, intervalMs, isTabVisible, trendWindowMinutes]);

  return { status, loading, error, lastUpdate, parserTrend };
}
