import { get, set, del } from 'idb-keyval';
import type { TraefikLog } from '@/utils/types';

/**
 * IndexedDB persistence layer for log data.
 * Survives full page reloads (unlike module-level memory or sessionStorage
 * which has a 5MB limit too small for thousands of parsed logs).
 */

const IDB_KEY_PREFIX = 'tld:logs:';
const DEBOUNCE_MS = 2000;
const STALENESS_MS = 5 * 60 * 1000; // 5 minutes

interface PersistedLogData {
  logs: TraefikLog[];
  position: number;
  timestamp: number;
}

// ── Debounced save ──────────────────────────────────────────────────
let saveTimer: ReturnType<typeof setTimeout> | null = null;
let pendingSave: { agentId: string; logs: TraefikLog[]; position: number } | null = null;

function flushPendingSave(): void {
  if (!pendingSave) return;
  const { agentId, logs, position } = pendingSave;
  pendingSave = null;

  const data: PersistedLogData = {
    logs,
    position,
    timestamp: Date.now(),
  };

  set(getKey(agentId), data).catch((err) => {
    console.warn('[log-persistence] Failed to save logs to IndexedDB:', err);
  });
}

function getKey(agentId: string): string {
  return `${IDB_KEY_PREFIX}${agentId}`;
}

// ── Public API ──────────────────────────────────────────────────────

/**
 * Schedule a debounced save of logs to IndexedDB.
 * Writes at most every DEBOUNCE_MS milliseconds.
 */
export function saveLogsToIDB(agentId: string, logs: TraefikLog[], position: number): void {
  pendingSave = { agentId, logs, position };

  if (saveTimer) return; // Already scheduled

  saveTimer = setTimeout(() => {
    saveTimer = null;
    flushPendingSave();
  }, DEBOUNCE_MS);
}

/** Force an immediate save (e.g. on page unload). */
export function flushLogsToIDB(): void {
  if (saveTimer) {
    clearTimeout(saveTimer);
    saveTimer = null;
  }
  flushPendingSave();
}

/**
 * Load cached logs from IndexedDB.
 * Returns null if no data exists or if the data is malformed.
 */
export async function loadLogsFromIDB(
  agentId: string
): Promise<{ logs: TraefikLog[]; position: number; isStale: boolean } | null> {
  try {
    const data = await get<PersistedLogData>(getKey(agentId));
    if (!data || !Array.isArray(data.logs)) return null;

    const isStale = Date.now() - data.timestamp > STALENESS_MS;

    return {
      logs: data.logs,
      position: data.position,
      isStale,
    };
  } catch (err) {
    console.warn('[log-persistence] Failed to load logs from IndexedDB:', err);
    return null;
  }
}

/** Remove cached logs for an agent (e.g., on agent deletion). */
export async function clearLogsFromIDB(agentId: string): Promise<void> {
  try {
    await del(getKey(agentId));
  } catch (err) {
    console.warn('[log-persistence] Failed to clear logs from IndexedDB:', err);
  }
}

/** Check if cached data exists without loading it all. */
export async function hasLogsInIDB(agentId: string): Promise<boolean> {
  try {
    const data = await get<PersistedLogData>(getKey(agentId));
    return data != null && Array.isArray(data.logs) && data.logs.length > 0;
  } catch {
    return false;
  }
}

// ── Cleanup on page unload ──────────────────────────────────────────
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    flushLogsToIDB();
  });
}
