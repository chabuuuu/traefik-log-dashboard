import { beforeEach, describe, expect, it, vi } from 'vitest';

const localStorageMock: Record<string, string> = { 'tld-migration-done': '1' };
const sessionStorageMock: Record<string, string> = {};

Object.defineProperty(globalThis, 'localStorage', {
  value: {
    getItem: (key: string) => localStorageMock[key] ?? null,
    setItem: (key: string, value: string) => { localStorageMock[key] = value; },
    removeItem: (key: string) => { delete localStorageMock[key]; },
    clear: () => { Object.keys(localStorageMock).forEach((key) => delete localStorageMock[key]); },
  },
  configurable: true,
  writable: true,
});

Object.defineProperty(globalThis, 'sessionStorage', {
  value: {
    getItem: (key: string) => sessionStorageMock[key] ?? null,
    setItem: (key: string, value: string) => { sessionStorageMock[key] = value; },
    removeItem: (key: string) => { delete sessionStorageMock[key]; },
    clear: () => { Object.keys(sessionStorageMock).forEach((key) => delete sessionStorageMock[key]); },
  },
  configurable: true,
  writable: true,
});

function mockFetchResponses(...responses: Array<{ ok: boolean; json: () => Promise<unknown> }>) {
  const fn = vi.fn();
  for (const response of responses) {
    fn.mockResolvedValueOnce(response);
  }
  fn.mockResolvedValue({ ok: true, json: () => Promise.resolve([]) });
  globalThis.fetch = fn;
  return fn;
}

describe('agentStore API-backed', () => {
  beforeEach(() => {
    vi.resetModules();
    Object.keys(sessionStorageMock).forEach((key) => delete sessionStorageMock[key]);
  });

  it('getAgents returns cached agents after refresh', async () => {
    const agents = [
      { id: 'agent-env-default', name: 'Default Agent', url: 'http://agent:5000', token: 't', source: 'env', location: 'on-site', number: 0, status: 'checking' },
    ];

    mockFetchResponses(
      { ok: true, json: () => Promise.resolve([]) },       // init fetchAgents
      { ok: true, json: () => Promise.resolve(agents) },   // refresh fetchAgents
    );

    const { agentStore } = await import('./agent-store');
    const result = await agentStore.refresh();

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('agent-env-default');
    expect(result[0].source).toBe('env');
  });

  it('does not allow deleting env-backed agent', async () => {
    const agents = [
      { id: 'agent-env-default', name: 'Default Agent', url: 'http://agent:5000', token: 't', source: 'env', location: 'on-site', number: 0, status: 'online' },
    ];

    mockFetchResponses(
      { ok: true, json: () => Promise.resolve(agents) },   // init fetchAgents
      { ok: true, json: () => Promise.resolve(agents) },   // refresh fetchAgents
    );

    const { agentStore } = await import('./agent-store');
    await agentStore.refresh();

    agentStore.deleteAgent('agent-env-default');

    const remaining = agentStore.getAgents();
    expect(remaining.some((agent) => agent.id === 'agent-env-default')).toBe(true);
  });

  it('addAgent adds to cache and fires POST', async () => {
    const fetchMock = mockFetchResponses(
      { ok: true, json: () => Promise.resolve([]) },       // init fetchAgents
      { ok: true, json: () => Promise.resolve([]) },       // refresh fetchAgents
      { ok: true, json: () => Promise.resolve({ id: 'agent-001', name: 'Test', url: 'http://test:5000', token: '', source: 'user', location: 'on-site', number: 1, status: 'checking' }) }, // POST addAgent
    );

    const { agentStore } = await import('./agent-store');
    await agentStore.refresh();

    const created = agentStore.addAgent({
      name: 'Test',
      url: 'http://test:5000',
      token: '',
      source: 'user',
      location: 'on-site',
      status: 'checking',
    });

    expect(created.name).toBe('Test');
    expect(agentStore.getAgents()).toHaveLength(1);

    await new Promise((resolve) => setTimeout(resolve, 10));

    const postCall = fetchMock.mock.calls.find((call) => call[1]?.method === 'POST' && call[0] === '/api/dashboard/agents');
    expect(postCall).toBeDefined();
  });

  it('stores selected agent id in session storage', async () => {
    const agents = [
      { id: 'agent-001', name: 'Agent 1', url: 'http://agent-1:5000', token: '', source: 'user', location: 'on-site', number: 1, status: 'checking' },
      { id: 'agent-002', name: 'Agent 2', url: 'http://agent-2:5000', token: '', source: 'user', location: 'off-site', number: 2, status: 'checking' },
    ];

    mockFetchResponses(
      { ok: true, json: () => Promise.resolve(agents) },   // init fetchAgents
      { ok: true, json: () => Promise.resolve(agents) },   // refresh fetchAgents
    );

    const { agentStore } = await import('./agent-store');
    await agentStore.refresh();

    agentStore.setSelectedAgentId('agent-002');

    expect(agentStore.getSelectedAgentId()).toBe('agent-002');
    expect(sessionStorage.getItem('tld-selected-agent-session')).toBe('agent-002');
  });
});
