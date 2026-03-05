import { describe, expect, it } from 'vitest';
import type { TraefikLog } from '@/utils/types';
import { calculateMetrics } from './metric-calculator';

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

describe('calculateMetrics duration handling', () => {
  it('ignores zero durations in response-time metrics', () => {
    const logs = [
      makeLog({ Duration: 0, StartUTC: '2024-01-01T00:00:00Z' }),
      makeLog({ Duration: 100000000, StartUTC: '2024-01-01T00:00:01Z' }), // 100ms
      makeLog({ Duration: 300000000, StartUTC: '2024-01-01T00:00:02Z' }), // 300ms
    ];

    const metrics = calculateMetrics(logs, []);

    expect(metrics.responseTime.samples).toBe(2);
    expect(metrics.responseTime.average).toBe(200);
    expect(metrics.responseTime.p95).toBeGreaterThan(0);
  });

  it('returns zero latency metrics when all durations are non-positive', () => {
    const logs = [
      makeLog({ Duration: 0, StartUTC: '2024-01-01T00:00:00Z' }),
      makeLog({ Duration: 0, StartUTC: '2024-01-01T00:00:01Z' }),
    ];

    const metrics = calculateMetrics(logs, []);

    expect(metrics.responseTime.samples).toBe(0);
    expect(metrics.responseTime.average).toBe(0);
    expect(metrics.responseTime.p95).toBe(0);
    expect(metrics.responseTime.p99).toBe(0);
  });

  it('does not cap backend service count at 10', () => {
    const logs = Array.from({ length: 12 }).map((_, index) =>
      makeLog({
        ServiceName: `svc-${index + 1}`,
        StartUTC: `2024-01-01T00:00:${String(index).padStart(2, '0')}Z`,
      })
    );

    const metrics = calculateMetrics(logs, []);

    expect(metrics.backends.length).toBe(12);
  });
});
