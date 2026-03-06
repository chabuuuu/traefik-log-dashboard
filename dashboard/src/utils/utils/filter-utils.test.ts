import { describe, expect, it } from 'vitest';
import type { TraefikLog } from '@/utils/types';
import { defaultFilterSettings } from '@/utils/types/filter';
import { applyFilters, getActiveFilterSummary, isInternalNoiseLog, type InternalNoiseRules } from './filter-utils';

const noiseRules: InternalNoiseRules = {
  pathPrefixes: ['/api/system/resources', '/api/logs/status', '/api/location'],
  servicePatterns: ['dashboard', 'agent', 'traefik-log-dashboard'],
};

const makeLog = (overrides: Partial<TraefikLog> = {}): TraefikLog => ({
  ClientAddr: '1.1.1.1:443',
  ClientHost: '1.1.1.1',
  ClientPort: '443',
  ClientUsername: '-',
  DownstreamContentSize: 128,
  DownstreamStatus: 200,
  Duration: 100000000,
  OriginContentSize: 128,
  OriginDuration: 100000000,
  OriginStatus: 200,
  Overhead: 0,
  RequestAddr: 'https://example.com',
  RequestContentSize: 0,
  RequestCount: 1,
  RequestHost: 'example.com',
  RequestMethod: 'GET',
  RequestPath: '/',
  RequestPort: '443',
  RequestProtocol: 'HTTP/1.1',
  RequestScheme: 'https',
  RetryAttempts: 0,
  RouterName: 'router',
  ServiceAddr: 'service:443',
  ServiceName: 'svc',
  ServiceURL: 'https://service',
  StartLocal: '2024-01-01T00:00:00Z',
  StartUTC: '2024-01-01T00:00:00Z',
  entryPointName: 'web',
  RequestReferer: '',
  RequestUserAgent: 'Mozilla/5.0',
  ...overrides,
});

describe('internal noise filtering', () => {
  it('matches by path prefix', () => {
    const log = makeLog({ RequestPath: '/api/system/resources?_t=123' });
    expect(isInternalNoiseLog(log, noiseRules)).toBe(true);
  });

  it('matches by service/router patterns (case-insensitive)', () => {
    const log = makeLog({
      ServiceName: '2-Dashboard-Service@http',
      RouterName: 'dashboard-router',
    });
    expect(isInternalNoiseLog(log, noiseRules)).toBe(true);
  });

  it('keeps normal traffic when hideInternalTraffic is enabled', () => {
    const settings = { ...defaultFilterSettings, hideInternalTraffic: true };
    const logs = [
      makeLog({ RequestPath: '/api/system/resources', ServiceName: 'dashboard-service' }),
      makeLog({ RequestPath: '/checkout', ServiceName: 'payments-service' }),
    ];

    const filtered = applyFilters(logs, settings, noiseRules);
    expect(filtered).toHaveLength(1);
    expect(filtered[0].RequestPath).toBe('/checkout');
  });

  it('does not exclude internal traffic when hideInternalTraffic is disabled', () => {
    const settings = { ...defaultFilterSettings, hideInternalTraffic: false };
    const logs = [
      makeLog({ RequestPath: '/api/logs/status', ServiceName: 'dashboard-service' }),
      makeLog({ RequestPath: '/products', ServiceName: 'catalog-service' }),
    ];

    const filtered = applyFilters(logs, settings, noiseRules);
    expect(filtered).toHaveLength(2);
  });

  it('adds summary label when internal traffic toggle is enabled', () => {
    const summary = getActiveFilterSummary({
      ...defaultFilterSettings,
      hideInternalTraffic: true,
    });
    expect(summary).toContain('Internal traffic excluded');
  });
});
