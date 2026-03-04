import { beforeEach, describe, expect, it, vi } from 'vitest';

// Prevent migration from running during tests
const storageMock: Record<string, string> = { 'tld-migration-done': '1' };
Object.defineProperty(globalThis, 'localStorage', {
  value: {
    getItem: (key: string) => storageMock[key] ?? null,
    setItem: (key: string, value: string) => { storageMock[key] = value; },
    removeItem: (key: string) => { delete storageMock[key]; },
    clear: () => { Object.keys(storageMock).forEach(k => delete storageMock[k]); },
    get length() { return Object.keys(storageMock).length; },
    key: (i: number) => Object.keys(storageMock)[i] ?? null,
  },
  configurable: true,
  writable: true,
});

function mockFetchResponses(...responses: Array<{ ok: boolean; json: () => Promise<unknown> }>) {
  const fn = vi.fn();
  for (const r of responses) {
    fn.mockResolvedValueOnce(r);
  }
  // Default fallback for any extra calls (e.g. init)
  fn.mockResolvedValue({ ok: true, json: () => Promise.resolve([]) });
  globalThis.fetch = fn;
  return fn;
}

describe('agentStore API-backed', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('getAgents returns cached agents after refresh', async () => {
    const agents = [
      { id: 'agent-env-default', name: 'Default Agent', url: 'http://agent:5000', token: 't', source: 'env', location: 'on-site', number: 0, status: 'checking' },
    ];

    // init calls: fetchAgents + fetchSelectedAgent, then refresh calls: fetchAgents + fetchSelectedAgent
    mockFetchResponses(
      { ok: true, json: () => Promise.resolve([]) },           // init fetchAgents
      { ok: true, json: () => Promise.resolve(null) },         // init fetchSelectedAgent
      { ok: true, json: () => Promise.resolve(agents) },       // refresh fetchAgents
      { ok: true, json: () => Promise.resolve(agents[0]) },    // refresh fetchSelectedAgent
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
      { ok: true, json: () => Promise.resolve(agents) },       // init fetchAgents
      { ok: true, json: () => Promise.resolve(agents[0]) },    // init fetchSelectedAgent
      { ok: true, json: () => Promise.resolve(agents) },       // refresh fetchAgents
      { ok: true, json: () => Promise.resolve(agents[0]) },    // refresh fetchSelectedAgent
    );

    const { agentStore } = await import('./agent-store');
    await agentStore.refresh();

    agentStore.deleteAgent('agent-env-default');

    // env agent should still exist in cache
    const remaining = agentStore.getAgents();
    expect(remaining.some(a => a.id === 'agent-env-default')).toBe(true);
  });

  it('addAgent adds to cache and fires POST', async () => {
    const mockFn = mockFetchResponses(
      { ok: true, json: () => Promise.resolve([]) },           // init fetchAgents
      { ok: true, json: () => Promise.resolve(null) },         // init fetchSelectedAgent
      { ok: true, json: () => Promise.resolve([]) },           // refresh fetchAgents
      { ok: true, json: () => Promise.resolve(null) },         // refresh fetchSelectedAgent
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

    // Wait for async POST to fire
    await new Promise(r => setTimeout(r, 10));

    // Verify POST was fired
    const postCall = mockFn.mock.calls.find(c => c[1]?.method === 'POST' && c[0] === '/api/dashboard/agents');
    expect(postCall).toBeDefined();
  });
});
