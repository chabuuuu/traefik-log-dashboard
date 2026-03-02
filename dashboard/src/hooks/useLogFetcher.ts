import { useState, useEffect, useRef } from 'react';
import { TraefikLog } from '@/utils/types';
import { enrichLogsWithGeoLocation } from '@/utils/location';
import { apiClient } from '@/utils/api-client';
import { useTabVisibility } from './useTabVisibility';
import { buildLogKey, createLogBuffer, dedupeLogs } from '@/utils/utils/log-batching';
import { useConfig } from '@/utils/contexts/ConfigContext';

const STREAM_BATCH_SIZE = 250;
const STREAM_FLUSH_INTERVAL = 350;
const POLL_MAX_INTERVAL = 30000;
const STALE_CONNECTION_MS = 45000;

export function useLogFetcher() {
  const { config } = useConfig();
  const [logs, setLogs] = useState<TraefikLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [isPaused, setIsPaused] = useState(false);
  const [agentId, setAgentId] = useState<string | null>(null);
  const [agentName, setAgentName] = useState<string | null>(null);

  const positionRef = useRef<number>(-1);
  const isFirstFetch = useRef(true);
  const seenLogsRef = useRef<Set<string>>(new Set());
  const maxSeenLogs = config.maxLogsDisplay * 2; // Limit seen logs cache to prevent infinite growth
  const pollDelayRef = useRef(config.refreshIntervalMs);
  const lastSuccessRef = useRef<number | null>(null);

  // REDUNDANCY FIX: Use shared visibility hook
  const isTabVisible = useTabVisibility();

  useEffect(() => {
    pollDelayRef.current = config.refreshIntervalMs;
    let isMounted = true;
    let pollTimeout: ReturnType<typeof setTimeout> | null = null;
    let staleInterval: ReturnType<typeof setInterval> | null = null;
    const activeControllers = new Set<AbortController>();

    const addController = () => {
      const controller = new AbortController();
      activeControllers.add(controller);
      return controller;
    };

    const abortActiveControllers = () => {
      activeControllers.forEach((controller) => controller.abort());
      activeControllers.clear();
    };

    const processLogs = async (rawLogs: TraefikLog[]) => {
      if (!isMounted || rawLogs.length === 0) return;

      const uniqueLogs = dedupeLogs(rawLogs, seenLogsRef.current, maxSeenLogs, buildLogKey);

      if (uniqueLogs.length === 0) {
        setLoading(false);
        return;
      }

      let enrichedLogs = uniqueLogs;
      try {
        enrichedLogs = await enrichLogsWithGeoLocation(uniqueLogs);
      } catch (geoError) {
        console.warn('GeoLocation enrichment failed, continuing without geo data:', geoError);
      }

      if (!isMounted) return;

      setLogs((prevLogs: TraefikLog[]) => {
        const nextLogs = isFirstFetch.current
          ? enrichedLogs
          : [...prevLogs, ...enrichedLogs];
        isFirstFetch.current = false;
        return nextLogs.slice(-config.maxLogsDisplay);
      });
      setConnected(true);
      setError(null);
      setLastUpdate(new Date());
      setLoading(false);
      lastSuccessRef.current = Date.now();
    };

    const buffer = createLogBuffer(
      async (batch) => {
        await processLogs(batch);
      },
      {
        flushIntervalMs: STREAM_FLUSH_INTERVAL,
        maxBatchSize: STREAM_BATCH_SIZE,
        maxBufferSize: STREAM_BATCH_SIZE * 6,
      }
    );

    const scheduleStaleCheck = () => {
      staleInterval = setInterval(() => {
        if (!isMounted) return;
        if (!lastSuccessRef.current) return;
        if (isPaused) return;
        const age = Date.now() - lastSuccessRef.current;
        if (age > STALE_CONNECTION_MS) {
          setConnected(false);
        }
      }, STALE_CONNECTION_MS);
    };

    const schedulePoll = (delay = pollDelayRef.current) => {
      if (pollTimeout) clearTimeout(pollTimeout);
      pollTimeout = setTimeout(() => {
        void pollLogs();
      }, delay);
    };

    const pollLogs = async () => {
      if (isPaused || !isTabVisible || !isMounted) return;

      const controller = addController();
      try {
        const position = positionRef.current ?? -1;
        const data = await apiClient.getAccessLogs(position, 1000, { signal: controller.signal });
        if (!isMounted) return;

        if (isFirstFetch.current && data.agent) {
          setAgentId(data.agent.id);
          setAgentName(data.agent.name);
        }

        if (data.logs?.length) {
          buffer.push(data.logs);
          await buffer.flush();
        } else {
          setLoading(false);
        }

        if (data.positions && data.positions.length > 0 && typeof data.positions[0].Position === 'number') {
          positionRef.current = data.positions[0].Position;
        }

        pollDelayRef.current = config.refreshIntervalMs;
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') return;
        if (!isMounted) return;
        console.error('Error fetching logs:', err);
        setError(err instanceof Error ? err.message : 'Failed to fetch logs');
        setConnected(false);
        setLoading(false);
        pollDelayRef.current = Math.min(pollDelayRef.current * 1.6, POLL_MAX_INTERVAL);
      } finally {
        activeControllers.delete(controller);
        if (isMounted && !isPaused && isTabVisible) {
          schedulePoll();
        }
      }
    };

    const startStreaming = async () => {
      const controller = addController();
      try {
        setLoading(true);
        for await (const line of apiClient.streamAccessLogs({ signal: controller.signal })) {
          if (!isMounted) return;
          if (isPaused || !isTabVisible) {
            controller.abort();
            return;
          }
          buffer.push(line);
        }
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') return;
        console.warn('Streaming failed, falling back to polling:', err);
        schedulePoll(2000);
      } finally {
        activeControllers.delete(controller);
        try {
          await buffer.flush();
        } catch (flushError) {
          console.error('Failed to flush buffered logs:', flushError);
        }
        if (isMounted) setLoading(false);
      }
    };

    // Start with streaming; fallback to polling on failure or when paused
    if (!isPaused && isTabVisible) {
      startStreaming();
    } else if (isTabVisible) {
      schedulePoll();
    }

    scheduleStaleCheck();

    return () => {
      isMounted = false;
      buffer.clear();
      abortActiveControllers();
      if (pollTimeout) clearTimeout(pollTimeout);
      if (staleInterval) clearInterval(staleInterval);
    };
  }, [config.maxLogsDisplay, config.refreshIntervalMs, isPaused, isTabVisible, maxSeenLogs]);

  return {
    logs,
    loading,
    error,
    connected,
    lastUpdate,
    isPaused,
    setIsPaused,
    agentId,
    agentName
  };
}
