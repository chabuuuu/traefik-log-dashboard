// Client-side agent configuration store backed by localStorage.
// Replaces server-side /api/agents CRUD.

import { Agent } from '../types/agent';
import { getRuntimeConfig } from '../config/runtime-config';
import { createLocalStore } from './local-store';

const STORAGE_KEY = 'tld-agents';
const SELECTED_KEY = 'tld-selected-agent';

function getDefaultAgents(): Agent[] {
  const runtime = getRuntimeConfig();
  return [
    {
      id: 'agent-001',
      name: 'Default Agent',
      url:
        runtime.defaultAgentUrl ||
        import.meta.env.VITE_AGENT_API_URL ||
        'http://traefik-agent:5000',
      token:
        runtime.defaultAgentToken ||
        import.meta.env.VITE_AGENT_API_TOKEN ||
        '',
      location: 'on-site',
      number: 1,
      status: 'checking',
    },
  ];
}

const store = createLocalStore<Agent>(STORAGE_KEY, getDefaultAgents);

export const agentStore = {
  getAgents: store.getAll,

  addAgent(agent: Omit<Agent, 'id' | 'number'>): Agent {
    const agents = store.getAll();
    const nextNumber = Math.max(0, ...agents.map((a) => a.number)) + 1;
    const newAgent: Agent = {
      ...agent,
      id: `agent-${String(nextNumber).padStart(3, '0')}`,
      number: nextNumber,
      status: 'checking',
    };
    store.add(newAgent);
    return newAgent;
  },

  updateAgent(id: string, updates: Partial<Agent>): Agent | null {
    return store.update(id, updates);
  },

  deleteAgent(id: string): void {
    store.remove(id);
    if (agentStore.getSelectedAgentId() === id) {
      const remaining = store.getAll();
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
    const agents = store.getAll();
    if (!selectedId) return agents[0] ?? null;
    return agents.find((a) => a.id === selectedId) ?? agents[0] ?? null;
  },

  getAgentById: store.getById,
};
