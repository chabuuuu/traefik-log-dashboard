// Agent configuration store backed by server-side SQLite via API.
// Replaces the previous localStorage implementation.

import { Agent } from '../types/agent';

const API_BASE = '/api/dashboard/agents';

// In-memory cache — refreshed from server on mutations
let cachedAgents: Agent[] | null = null;
let cachedSelectedId: string | null = null;

const LEGACY_STORAGE_KEY = 'tld-agents';
const LEGACY_SELECTED_KEY = 'tld-selected-agent';
const MIGRATION_DONE_KEY = 'tld-migration-done';

// --- Internal helpers ---

async function fetchAgents(): Promise<Agent[]> {
  const res = await fetch(API_BASE);
  if (!res.ok) throw new Error(`Failed to fetch agents: ${res.status}`);
  return res.json();
}

async function fetchSelectedAgent(): Promise<Agent | null> {
  const res = await fetch(`${API_BASE}/selected`);
  if (!res.ok) return null;
  return res.json();
}

function invalidateCache(): void {
  cachedAgents = null;
  cachedSelectedId = null;
}

// --- localStorage Migration ---

async function migrateFromLocalStorage(): Promise<void> {
  if (typeof window === 'undefined') return;

  // Already migrated
  if (localStorage.getItem(MIGRATION_DONE_KEY)) return;

  const raw = localStorage.getItem(LEGACY_STORAGE_KEY);
  if (!raw) {
    localStorage.setItem(MIGRATION_DONE_KEY, '1');
    return;
  }

  try {
    const agents = JSON.parse(raw) as Agent[];
    const userAgents = agents.filter(a => a.source !== 'env' && !a.id.startsWith('agent-env-'));

    if (userAgents.length > 0) {
      await fetch(`${API_BASE}/import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agents: userAgents }),
      });
    }

    // Migrate selected agent
    const selectedId = localStorage.getItem(LEGACY_SELECTED_KEY);
    if (selectedId) {
      await fetch(`${API_BASE}/selected`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: selectedId }),
      });
    }

    // Mark migration complete and clean up
    localStorage.setItem(MIGRATION_DONE_KEY, '1');
    localStorage.removeItem(LEGACY_STORAGE_KEY);
    localStorage.removeItem(LEGACY_SELECTED_KEY);
    console.log('[agent-store] Migrated agents from localStorage to server');
  } catch (err) {
    console.error('[agent-store] Migration failed:', err);
  }
}

// Run migration on module load
migrateFromLocalStorage().catch(() => {});

// --- Synchronous store interface (uses cache, triggers async refresh) ---

// Initialize cache with a synchronous fetch on first access
let initPromise: Promise<void> | null = null;

function ensureInit(): Promise<void> {
  if (!initPromise) {
    initPromise = (async () => {
      try {
        cachedAgents = await fetchAgents();
        const selected = await fetchSelectedAgent();
        cachedSelectedId = selected?.id ?? null;
      } catch {
        cachedAgents = [];
        cachedSelectedId = null;
      }
    })();
  }
  return initPromise;
}

// Kick off init immediately
ensureInit();

export const agentStore = {
  // Synchronous — returns cached data (may be stale on first call)
  getAgents(): Agent[] {
    return cachedAgents ?? [];
  },

  addAgent(agent: Omit<Agent, 'id' | 'number'>): Agent {
    // Optimistically create a placeholder, then sync
    const placeholder: Agent = {
      ...agent,
      id: `agent-pending-${Date.now()}`,
      number: (cachedAgents?.length ?? 0) + 1,
      source: 'user',
      status: 'checking',
    };

    // Fire async API call
    fetch(API_BASE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(agent),
    })
      .then(res => res.json())
      .then((created: Agent) => {
        // Replace placeholder in cache
        if (cachedAgents) {
          const idx = cachedAgents.findIndex(a => a.id === placeholder.id);
          if (idx >= 0) {
            cachedAgents[idx] = created;
          } else {
            cachedAgents.push(created);
          }
        }
      })
      .catch(err => console.error('[agent-store] addAgent failed:', err));

    // Add placeholder to cache immediately
    if (cachedAgents) {
      cachedAgents.push(placeholder);
    }

    return placeholder;
  },

  updateAgent(id: string, updates: Partial<Agent>): Agent | null {
    if (!cachedAgents) return null;
    const idx = cachedAgents.findIndex(a => a.id === id);
    if (idx === -1) return null;

    const agent = cachedAgents[idx];
    if (agent.source === 'env' && !('status' in updates)) return agent;

    // Optimistic local update
    cachedAgents[idx] = { ...agent, ...updates };

    // Async API call
    fetch(API_BASE, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, ...updates }),
    }).catch(err => console.error('[agent-store] updateAgent failed:', err));

    return cachedAgents[idx];
  },

  deleteAgent(id: string): void {
    if (!cachedAgents) return;
    const agent = cachedAgents.find(a => a.id === id);
    if (!agent || agent.source === 'env') return;

    // Optimistic removal
    cachedAgents = cachedAgents.filter(a => a.id !== id);

    if (cachedSelectedId === id) {
      cachedSelectedId = cachedAgents[0]?.id ?? null;
      agentStore.setSelectedAgentId(cachedSelectedId);
    }

    fetch(`${API_BASE}?id=${encodeURIComponent(id)}`, { method: 'DELETE' })
      .catch(err => console.error('[agent-store] deleteAgent failed:', err));
  },

  getSelectedAgentId(): string | null {
    return cachedSelectedId;
  },

  setSelectedAgentId(id: string | null): void {
    cachedSelectedId = id;

    fetch(`${API_BASE}/selected`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    }).catch(err => console.error('[agent-store] setSelectedAgentId failed:', err));
  },

  getSelectedAgent(): Agent | null {
    const agents = agentStore.getAgents();
    if (cachedSelectedId) {
      const found = agents.find(a => a.id === cachedSelectedId);
      if (found) return found;
    }
    return agents[0] ?? null;
  },

  getAgentById(id: string): Agent | null {
    return agentStore.getAgents().find(a => a.id === id) ?? null;
  },

  // Async refresh from server — call after mutations for consistency
  async refresh(): Promise<Agent[]> {
    cachedAgents = await fetchAgents();
    const selected = await fetchSelectedAgent();
    cachedSelectedId = selected?.id ?? null;
    return cachedAgents;
  },
};
