import type { TraefikLog } from '@/utils/types';

const DEFAULT_MAX_BUFFER_MULTIPLIER = 4;

export type LogKeyBuilder = (log: TraefikLog) => string;

/**
 * Build a stable, compact key for de-duplicating logs across batches.
 */
export const buildLogKey: LogKeyBuilder = (log) => {
  const start = log.StartUTC || log.StartLocal || '';
  return [
    start,
    log.RequestCount,
    log.RequestPath,
    log.RequestMethod,
    log.ClientHost || log.ClientAddr || '',
    log.DownstreamStatus,
  ].join('|');
};

/**
 * Remove already-seen logs while keeping a bounded cache of keys.
 */
export function dedupeLogs(
  logs: TraefikLog[],
  seen: Set<string>,
  maxSeen: number,
  keyBuilder: LogKeyBuilder = buildLogKey
): TraefikLog[] {
  if (logs.length === 0) return [];

  const unique: TraefikLog[] = [];

  for (const log of logs) {
    const key = keyBuilder(log);
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(log);
  }

  if (seen.size > maxSeen) {
    const trimmed = Array.from(seen).slice(seen.size - maxSeen);
    seen.clear();
    trimmed.forEach((key) => seen.add(key));
  }

  return unique;
}

export interface LogBufferOptions {
  flushIntervalMs: number;
  maxBatchSize: number;
  maxBufferSize?: number;
}

export interface LogBuffer<T = TraefikLog> {
  push: (lines: T | T[]) => void;
  flush: () => Promise<void>;
  clear: () => void;
  size: () => number;
}

/**
 * Lightweight buffer that batches parsed log objects before processing.
 * - Flushes on size threshold or interval.
 * - Prevents overlapping flushes.
 */
export function createLogBuffer<T = TraefikLog>(
  processBatch: (lines: T[]) => Promise<void> | void,
  options: LogBufferOptions
): LogBuffer<T> {
  const flushInterval = Math.max(options.flushIntervalMs, 50);
  const maxBatchSize = Math.max(options.maxBatchSize, 1);
  const maxBufferSize =
    options.maxBufferSize ?? maxBatchSize * DEFAULT_MAX_BUFFER_MULTIPLIER;

  let buffer: T[] = [];
  let timer: ReturnType<typeof setTimeout> | null = null;
  let isFlushing = false;

  const clearTimer = () => {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
  };

  const scheduleTimer = () => {
    if (timer) return;
    timer = setTimeout(async () => {
      timer = null;
      await flush();
    }, flushInterval);
  };

  const flush = async () => {
    if (isFlushing || buffer.length === 0) return;
    isFlushing = true;

    try {
      while (buffer.length > 0) {
        const batch = buffer.slice(0, maxBatchSize);
        buffer = buffer.slice(batch.length);
        // Await in case processBatch is async; callers can rely on flush resolving.
        await processBatch(batch);
      }
    } finally {
      isFlushing = false;
    }
  };

  const push = (lines: T | T[]) => {
    const items = Array.isArray(lines) ? lines : [lines];
    if (items.length === 0) return;

    buffer.push(...items);

    if (buffer.length >= maxBatchSize) {
      // Flush immediately when size threshold is hit.
      void flush();
    } else {
      scheduleTimer();
    }

    if (buffer.length >= maxBufferSize) {
      // Prevent unbounded growth; flush proactively.
      void flush();
    }
  };

  const clear = () => {
    buffer = [];
    clearTimer();
  };

  const size = () => buffer.length;

  return { push, flush, clear, size };
}
