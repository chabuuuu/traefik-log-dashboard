import { describe, expect, it } from 'vitest';
import type { Request } from 'express';
import { getAgentIDFromRequest, normalizeProxyTarget } from './proxy';

function createRequestWithHeaders(headers: Record<string, string | undefined>): Request {
  return {
    header: (name: string) => headers[name.toLowerCase()],
  } as unknown as Request;
}

describe('getAgentIDFromRequest', () => {
  it('reads and trims x-agent-id', () => {
    const req = createRequestWithHeaders({ 'x-agent-id': '  agent-123  ' });
    expect(getAgentIDFromRequest(req)).toBe('agent-123');
  });

  it('returns empty string when header is missing', () => {
    const req = createRequestWithHeaders({});
    expect(getAgentIDFromRequest(req)).toBe('');
  });
});

describe('normalizeProxyTarget', () => {
  it('keeps existing http/https protocol', () => {
    expect(normalizeProxyTarget('https://agent.example.com/')).toBe('https://agent.example.com');
    expect(normalizeProxyTarget('http://agent:5000')).toBe('http://agent:5000');
  });

  it('adds http protocol to bare host:port', () => {
    expect(normalizeProxyTarget('agent:5000')).toBe('http://agent:5000');
    expect(normalizeProxyTarget('192.168.1.10:5000/')).toBe('http://192.168.1.10:5000');
  });
});
