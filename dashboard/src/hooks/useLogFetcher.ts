import { useState, useEffect, useRef } from 'react';
import { TraefikLog } from '@/utils/types';
import { enrichLogsWithGeoLocation } from '@/utils/location';
import { apiClient } from '@/utils/api-client';
import { useTabVisibility } from './useTabVisibility';
import { buildLogKey, createLogBuffer, dedupeLogs } from '@/utils/utils/log-batching';
import { getNextLogCursor } from '@/utils/utils/log-cursor';
import { useConfig } from '@/utils/contexts/ConfigContext';
import { useAgents } from '@/utils/contexts/AgentContext';

const STREAM_BATCH_SIZE = 250;
const STREAM_FLUSH_INTERVAL = 350;
const POLL_MAX_INTERVAL = 30000;
const STALE_CONNECTION_MS = 45000;

export interface DedupeDebugStats {
  received: number;
  kept: number;
  dropped: number;
  dropRate: number;
}

export function useLogFetcher() {
  const { config } = useConfig();
  const { selectedAgent } = useAgents();
  const [logs, setLogs] = useState<TraefikLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [isPaused, setIsPaused] = useState(false);
  const [agentId, setAgentId] = useState<string | null>(null);
  const [agentName, setAgentName] = useState<string | null>(null);
  const [dedupeDebug, setDedupeDebug] = useState<DedupeDebugStats | null>(null);

  const positionRef = useRef<number>(-1);
  const isFirstFetch = useRef(true);
  const seenLogsRef = useRef<Set<string>>(new Set());
  const dedupeReceivedRef = useRef(0);
  const dedupeDroppedRef = useRef(0);
  const maxSeenLogs = config.maxLogsDisplay * 2; // Limit seen logs cache to prevent infinite growth
  const pollDelayRef = useRef(config.refreshIntervalMs);
  const lastSuccessRef = useRef<number | null>(null);

  // REDUNDANCY FIX: Use shared visibility hook
  const isTabVisible = useTabVisibility();

  useEffect(() => {
    const selectedAgentID = selectedAgent?.id;
    const selectedAgentName = selectedAgent?.name ?? null;

    setLogs([]);
    setConnected(false);
    setLastUpdate(null);
    setError(null);
    setAgentId(selectedAgentID ?? null);
    setAgentName(selectedAgentName);
    setLoading(true);
    positionRef.current = -1;
    isFirstFetch.current = true;
    seenLogsRef.current.clear();
    dedupeReceivedRef.current = 0;
    dedupeDroppedRef.current = 0;
    setDedupeDebug(null);
    lastSuccessRef.current = null;

    if (!selectedAgentID) {
      setLoading(false);
      setError('No agent selected or available');
      return;
    }

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
      const dropped = rawLogs.length - uniqueLogs.length;
      dedupeReceivedRef.current += rawLogs.length;
      dedupeDroppedRef.current += dropped;
      if (import.meta.env.DEV) {
        const received = dedupeReceivedRef.current;
        const droppedTotal = dedupeDroppedRef.current;
        const kept = received - droppedTotal;
        setDedupeDebug({
          received,
          kept,
          dropped: droppedTotal,
          dropRate: received > 0 ? (droppedTotal / received) * 100 : 0,
        });
      }

      if (uniqueLogs.length === 0) {
        setLoading(false);
        return;
      }

      let enrichedLogs = uniqueLogs;
      try {
        const shouldEnrichGeo = uniqueLogs.some((log) => Boolean(log.ClientHost || log.ClientAddr));
        if (shouldEnrichGeo) {
          enrichedLogs = await enrichLogsWithGeoLocation(uniqueLogs);
        }
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
      if (!selectedAgentID) return;

      const controller = addController();
      try {
        const position = positionRef.current ?? -1;
        const data = await apiClient.getAccessLogs({
          agentId: selectedAgentID,
          position,
          lines: 1000,
          signal: controller.signal,
        });
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

        const nextPosition = getNextLogCursor(
          data.positions as Array<{ position?: unknown; Position?: unknown }> | undefined
        );

        if (typeof nextPosition === 'number') {
          positionRef.current = nextPosition;
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
      if (!selectedAgentID) {
        return;
      }
      const controller = addController();
      try {
        setLoading(true);
        for await (const line of apiClient.streamAccessLogs({ agentId: selectedAgentID, signal: controller.signal })) {
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
  }, [config.maxLogsDisplay, config.refreshIntervalMs, isPaused, isTabVisible, maxSeenLogs, selectedAgent?.id, selectedAgent?.name]);

  return {
    logs,
    loading,
    error,
    connected,
    lastUpdate,
    isPaused,
    setIsPaused,
    agentId,
    agentName,
    dedupeDebug,
  };
}
