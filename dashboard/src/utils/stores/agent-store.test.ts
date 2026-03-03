import { beforeEach, describe, expect, it } from 'vitest';
import { agentStore } from './agent-store';

const AGENTS_KEY = 'tld-agents';

type StorageMap = Record<string, string>;

function createStorageMock(initial: StorageMap = {}): Storage {
  const data: StorageMap = { ...initial };
  return {
    get length() {
      return Object.keys(data).length;
    },
    clear() {
      Object.keys(data).forEach((key) => delete data[key]);
    },
    getItem(key: string) {
      return Object.prototype.hasOwnProperty.call(data, key) ? data[key] : null;
    },
    key(index: number) {
      return Object.keys(data)[index] ?? null;
    },
    removeItem(key: string) {
      delete data[key];
    },
    setItem(key: string, value: string) {
      data[key] = value;
    },
  };
}

describe('agentStore env sync', () => {
  beforeEach(() => {
    const storage = createStorageMock();
    Object.defineProperty(globalThis, 'localStorage', {
      value: storage,
      configurable: true,
      writable: true,
    });
    Object.defineProperty(globalThis, 'window', {
      value: { __DASHBOARD_CONFIG__: {} },
      configurable: true,
      writable: true,
    });
  });

  it('replaces legacy default agent with env-backed default agent', () => {
    window.__DASHBOARD_CONFIG__ = {
      defaultAgentUrl: 'http://env-agent:5000',
      defaultAgentToken: 'env-token',
    };

    localStorage.setItem(
      AGENTS_KEY,
      JSON.stringify([
        {
          id: 'agent-001',
          name: 'Default Agent',
          url: 'http://old-agent:5000',
          token: 'old-token',
          location: 'on-site',
          number: 1,
          status: 'checking',
        },
      ])
    );

    const agents = agentStore.getAgents();

    expect(agents).toHaveLength(1);
    expect(agents[0].id).toBe('agent-env-default');
    expect(agents[0].source).toBe('env');
    expect(agents[0].url).toBe('http://env-agent:5000');
    expect(agents[0].token).toBe('env-token');
  });

  it('does not allow deleting env-backed default agent', () => {
    window.__DASHBOARD_CONFIG__ = {
      defaultAgentUrl: 'http://env-agent:5000',
      defaultAgentToken: 'env-token',
    };

    const beforeDelete = agentStore.getAgents();
    expect(beforeDelete.some((agent) => agent.id === 'agent-env-default')).toBe(true);

    agentStore.deleteAgent('agent-env-default');

    const afterDelete = agentStore.getAgents();
    expect(afterDelete.some((agent) => agent.id === 'agent-env-default')).toBe(true);
  });
});
