import type { TraefikLog } from '@/utils/types';
import { buildLogKey, dedupeLogs } from '@/utils/utils/log-batching';

/**
 * Module-level singleton store for log state.
 * Lives outside React component lifecycle — survives route navigation.
 * Follows the same pattern as agent-store.ts.
 */

const POSITION_KEY_PREFIX = 'tld:logPosition:';

type Listener = () => void;

interface LogStoreState {
  logs: TraefikLog[];
  connected: boolean;
  lastUpdate: Date | null;
  loading: boolean;
  error: string | null;
  agentId: string | null;
  agentName: string | null;
  isCatchingUp: boolean;
  isCached: boolean;
  resetTrigger: number;
}

// ── Module-level state ──────────────────────────────────────────────
let state: LogStoreState = {
  logs: [],
  connected: false,
  lastUpdate: null,
  loading: true,
  error: null,
  agentId: null,
  agentName: null,
  isCatchingUp: false,
  isCached: false,
  resetTrigger: 0,
};

let seenKeys: Set<string> = new Set();
let positionMap: Map<string, number> = new Map(); // agentId → position
const listeners: Set<Listener> = new Set();

// ── Helpers ─────────────────────────────────────────────────────────
function notify(): void {
  listeners.forEach((fn) => {
    try {
      fn();
    } catch {
      // Listener errors should not break the store
    }
  });
}

function getPositionStorageKey(agentId: string): string {
  return `${POSITION_KEY_PREFIX}${agentId}`;
}

// ── Public API ──────────────────────────────────────────────────────
export const logStore = {
  /** Get the current state snapshot (immutable reference). */
  getState(): Readonly<LogStoreState> {
    return state;
  },

  /** Get the dedup set (for inspection / debugging). */
  getSeenKeys(): Set<string> {
    return seenKeys;
  },

  /** Subscribe to state changes. Returns an unsubscribe function. */
  subscribe(listener: Listener): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },

  // ── Logs ────────────────────────────────────────────────────────
  /** Append new logs with dedup + trim to maxDisplay. */
  appendLogs(
    newLogs: TraefikLog[],
    maxDisplay: number,
    isFirstBatch: boolean
  ): void {
    if (newLogs.length === 0) return;

    const maxSeen = maxDisplay * 2;
    const unique = dedupeLogs(newLogs, seenKeys, maxSeen, buildLogKey);
    if (unique.length === 0) return;

    const combined = isFirstBatch ? unique : [...state.logs, ...unique];
    state = {
      ...state,
      logs: combined.slice(-maxDisplay),
      loading: false,
      isCached: false,
    };
    notify();
  },

  /** Replace entire log buffer (used for IDB hydration). */
  setLogs(logs: TraefikLog[], isCached: boolean = false): void {
    // Populate the seen-keys set from restored logs
    for (const log of logs) {
      seenKeys.add(buildLogKey(log));
    }
    state = { ...state, logs, isCached, loading: false };
    notify();
  },

  /** Trim logs when maxDisplay changes. */
  trimLogs(maxDisplay: number): void {
    if (state.logs.length > maxDisplay) {
      state = { ...state, logs: state.logs.slice(-maxDisplay) };
      notify();
    }
  },

  // ── Connection state ────────────────────────────────────────────
  setConnected(connected: boolean): void {
    if (state.connected !== connected) {
      state = { ...state, connected };
      notify();
    }
  },

  setLastUpdate(date: Date): void {
    state = { ...state, lastUpdate: date };
    // No notify for this alone — it usually accompanies other updates
  },

  setLoading(loading: boolean): void {
    if (state.loading !== loading) {
      state = { ...state, loading };
      notify();
    }
  },

  setError(error: string | null): void {
    state = { ...state, error };
    notify();
  },

  setAgentInfo(agentId: string | null, agentName: string | null): void {
    state = { ...state, agentId, agentName };
    // No notify — minor metadata
  },

  setCatchingUp(isCatchingUp: boolean): void {
    if (state.isCatchingUp !== isCatchingUp) {
      state = { ...state, isCatchingUp };
      notify();
    }
  },

  // ── Position tracking ───────────────────────────────────────────
  getPosition(agentId: string): number {
    // First check memory cache
    const cached = positionMap.get(agentId);
    if (cached !== undefined) return cached;

    // Then try sessionStorage
    try {
      const saved = sessionStorage.getItem(getPositionStorageKey(agentId));
      if (saved !== null) {
        const parsed = Number(saved);
        if (Number.isFinite(parsed) && parsed >= 0) {
          positionMap.set(agentId, parsed);
          return parsed;
        }
      }
    } catch {
      // sessionStorage may be unavailable
    }

    return -1; // No saved position
  },

  setPosition(agentId: string, position: number): void {
    positionMap.set(agentId, position);
    try {
      sessionStorage.setItem(getPositionStorageKey(agentId), String(position));
    } catch {
      // sessionStorage may be unavailable
    }
  },

  /** Check if this agent has ever had a position saved (i.e., not first visit). */
  hasPosition(agentId: string): boolean {
    if (positionMap.has(agentId)) return true;
    try {
      return sessionStorage.getItem(getPositionStorageKey(agentId)) !== null;
    } catch {
      return false;
    }
  },

  /** Clear position for an agent (used by "Load recent" to force tail fetch). */
  clearPosition(agentId: string): void {
    positionMap.delete(agentId);
    try {
      sessionStorage.removeItem(getPositionStorageKey(agentId));
    } catch {
      // sessionStorage may be unavailable
    }
  },

  /** Clear logs and seen keys (used by "Load recent" before re-fetching tail). */
  clearLogs(): void {
    seenKeys = new Set();
    state = { ...state, logs: [], loading: true };
    notify();
  },

  /** Request a reset (increments resetTrigger to cause useLogFetcher to re-initialize). */
  requestReset(): void {
    state = { ...state, resetTrigger: state.resetTrigger + 1 };
    notify();
  },

  // ── Agent switch ────────────────────────────────────────────────
  /** Clear all state for agent switch or reset. */
  clear(): void {
    state = {
      logs: [],
      connected: false,
      lastUpdate: null,
      loading: true,
      error: null,
      agentId: null,
      agentName: null,
      isCatchingUp: false,
      isCached: false,
      resetTrigger: state.resetTrigger,
    };
    seenKeys = new Set();
    notify();
  },

  /** Reset dedup counters (for debug stats). */
  resetDedupeCounters(): void {
    seenKeys = new Set();
  },
};
