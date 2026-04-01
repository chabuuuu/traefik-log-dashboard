import { beforeEach, describe, expect, it } from 'vitest';
import { getRuntimeConfig } from './runtime-config';

describe('getRuntimeConfig', () => {
  beforeEach(() => {
    Object.defineProperty(globalThis, 'window', {
      value: { __DASHBOARD_CONFIG__: {} },
      configurable: true,
      writable: true,
    });
  });

  it('reads values from runtime injected config', () => {
    window.__DASHBOARD_CONFIG__ = {
      basePath: '/dashboard',
      baseDomain: 'https://example.com',
      defaultAgentUrl: 'http://agent:5000',
      defaultAgentConfigured: true,
      refreshIntervalMs: 2000,
      maxLogsDisplay: 1234,
      trafficTopItemsLimit: 25,
      parserTrendWindowMinutes: 20,
      agentsEnvOnly: true,
      hideInternalTrafficDefault: true,
      internalNoisePathPrefixes: ['/api/system/resources', '/api/logs/status'],
      internalNoiseServicePatterns: ['dashboard', 'agent'],
      density: 'compact',
      showDemoPage: false,
    };

    const cfg = getRuntimeConfig();
    expect(cfg.basePath).toBe('/dashboard');
    expect(cfg.baseDomain).toBe('https://example.com');
    expect(cfg.defaultAgentUrl).toBe('http://agent:5000');
    expect(cfg.defaultAgentConfigured).toBe(true);
    expect(cfg.refreshIntervalMs).toBe(2000);
    expect(cfg.maxLogsDisplay).toBe(1234);
    expect(cfg.trafficTopItemsLimit).toBe(25);
    expect(cfg.parserTrendWindowMinutes).toBe(20);
    expect(cfg.agentsEnvOnly).toBe(true);
    expect(cfg.hideInternalTrafficDefault).toBe(true);
    expect(cfg.internalNoisePathPrefixes).toEqual(['/api/system/resources', '/api/logs/status']);
    expect(cfg.internalNoiseServicePatterns).toEqual(['dashboard', 'agent']);
    expect(cfg.density).toBe('compact');
    expect(cfg.showDemoPage).toBe(false);
  });
});
