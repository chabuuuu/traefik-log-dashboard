// Client-side agent configuration store backed by localStorage.
// Replaces server-side /api/agents CRUD.

import { Agent } from '../types/agent';
import { getRuntimeConfig } from '../config/runtime-config';
import { createLocalStore } from './local-store';

const STORAGE_KEY = 'tld-agents';
const SELECTED_KEY = 'tld-selected-agent';
const ENV_AGENT_ID = 'agent-env-default';

type EnvAgentConfig = {
  url: string;
  token: string;
};

function isEnvironmentAgent(agent: Agent): boolean {
  return agent.source === 'env' || agent.id.startsWith('agent-env-');
}

function getEnvAgentConfig(): EnvAgentConfig | null {
  const runtime = getRuntimeConfig();
  const url = (runtime.defaultAgentUrl || '').trim();
  const token = (runtime.defaultAgentToken || '').trim();

  // URL determines whether an explicit env-backed default agent is configured.
  if (!url) return null;

  return { url, token };
}

function buildUserDefaultAgent(): Agent {
  const runtime = getRuntimeConfig();
  return {
    id: 'agent-001',
    name: 'Default Agent',
    url: runtime.defaultAgentUrl || 'http://traefik-agent:5000',
    token: runtime.defaultAgentToken || '',
    source: 'user',
    location: 'on-site',
    number: 1,
    status: 'checking',
  };
}

function getDefaultAgents(): Agent[] {
  const env = getEnvAgentConfig();
  if (env) {
    return [
      {
        id: ENV_AGENT_ID,
        name: 'Default Agent',
        url: env.url,
        token: env.token,
        source: 'env',
        location: 'on-site',
        number: 1,
        status: 'checking',
      },
    ];
  }
  return [buildUserDefaultAgent()];
}

function syncAgentsWithEnvironment(agents: Agent[]): Agent[] {
  const normalized = agents.map((agent) => ({
    ...agent,
    source: isEnvironmentAgent(agent) ? 'env' : agent.source || 'user',
  }));

  const env = getEnvAgentConfig();
  if (!env) {
    const withoutEnv = normalized.filter((agent) => !isEnvironmentAgent(agent));
    return withoutEnv.length > 0 ? withoutEnv : [buildUserDefaultAgent()];
  }

  const existingEnv = normalized.find((agent) => isEnvironmentAgent(agent));
  const nonEnv = normalized.filter((agent) => {
    if (isEnvironmentAgent(agent)) return false;
    // Migration: replace legacy bootstrap default with the env-backed default.
    if (agent.source === 'user' && agent.id === 'agent-001' && agent.name === 'Default Agent') {
      return false;
    }
    return true;
  });

  const envAgent: Agent = {
    id: ENV_AGENT_ID,
    name: existingEnv?.name || 'Default Agent',
    url: env.url,
    token: env.token,
    source: 'env',
    location: existingEnv?.location || 'on-site',
    number: existingEnv?.number || 1,
    status: existingEnv?.status || 'checking',
    description: existingEnv?.description,
    tags: existingEnv?.tags,
    lastSeen: existingEnv?.lastSeen,
  };

  return [envAgent, ...nonEnv];
}

function getSyncedAgents(): Agent[] {
  const current = store.getAll();
  const synced = syncAgentsWithEnvironment(current);

  if (JSON.stringify(current) !== JSON.stringify(synced)) {
    store.setAll(synced);
  }

  return synced;
}

const store = createLocalStore<Agent>(STORAGE_KEY, getDefaultAgents);

export const agentStore = {
  getAgents: getSyncedAgents,

  addAgent(agent: Omit<Agent, 'id' | 'number'>): Agent {
    const agents = getSyncedAgents();
    const nextNumber = Math.max(0, ...agents.map((a) => a.number)) + 1;
    const newAgent: Agent = {
      ...agent,
      id: `agent-${String(nextNumber).padStart(3, '0')}`,
      number: nextNumber,
      source: 'user',
      status: 'checking',
    };
    store.setAll([...agents, newAgent]);
    return newAgent;
  },

  updateAgent(id: string, updates: Partial<Agent>): Agent | null {
    const existing = store.getById(id);
    if (!existing) return null;
    if (isEnvironmentAgent(existing)) {
      return existing;
    }
    return store.update(id, { ...updates, source: 'user' });
  },

  deleteAgent(id: string): void {
    const existing = store.getById(id);
    if (existing && isEnvironmentAgent(existing)) {
      return;
    }
    store.remove(id);
    if (agentStore.getSelectedAgentId() === id) {
      const remaining = getSyncedAgents();
      agentStore.setSelectedAgentId(remaining[0]?.id ?? null);
    }
  },

  getSelectedAgentId(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem(SELECTED_KEY);
  },

  setSelectedAgentId(id: string | null): void {
    if (typeof window === 'undefined') return;
    if (id) {
      localStorage.setItem(SELECTED_KEY, id);
    } else {
      localStorage.removeItem(SELECTED_KEY);
    }
  },

  getSelectedAgent(): Agent | null {
    const selectedId = agentStore.getSelectedAgentId();
    const agents = getSyncedAgents();
    if (!selectedId) return agents[0] ?? null;
    return agents.find((a) => a.id === selectedId) ?? agents[0] ?? null;
  },

  getAgentById(id: string): Agent | null {
    return getSyncedAgents().find((agent) => agent.id === id) ?? null;
  },
};
