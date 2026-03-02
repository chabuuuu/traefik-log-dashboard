import { afterEach, describe, expect, it, vi } from 'vitest';
import type { TraefikLog } from '@/utils/types';
import { buildLogKey, createLogBuffer, dedupeLogs } from './log-batching';

const makeLog = (overrides: Partial<TraefikLog> = {}): TraefikLog => ({
  ClientAddr: '1.1.1.1',
  ClientHost: '1.1.1.1',
  ClientPort: '443',
  ClientUsername: '',
  DownstreamContentSize: 0,
  DownstreamStatus: 200,
  Duration: 1000,
  OriginContentSize: 0,
  OriginDuration: 0,
  OriginStatus: 200,
  Overhead: 0,
  RequestAddr: 'https://example.com',
  RequestContentSize: 0,
  RequestCount: 1,
  RequestHost: 'example.com',
  RequestMethod: 'GET',
  RequestPath: '/',
  RequestPort: '443',
  RequestProtocol: 'https',
  RequestScheme: 'https',
  RetryAttempts: 0,
  RouterName: 'router',
  ServiceAddr: 'service',
  ServiceName: 'svc',
  ServiceURL: 'https://service',
  StartLocal: '2024-01-01T00:00:00Z',
  StartUTC: '2024-01-01T00:00:00Z',
  entryPointName: 'web',
  ...overrides,
});

afterEach(() => {
  vi.useRealTimers();
});

describe('buildLogKey', () => {
  it('builds a stable key for identical logs', () => {
    const a = buildLogKey(makeLog({ RequestPath: '/a', RequestCount: 1 }));
    const b = buildLogKey(makeLog({ RequestPath: '/a', RequestCount: 1 }));
    const c = buildLogKey(makeLog({ RequestPath: '/b', RequestCount: 1 }));

    expect(a).toBe(b);
    expect(c).not.toBe(a);
  });
});

describe('dedupeLogs', () => {
  it('removes duplicates and bounds the seen cache', () => {
    const seen = new Set<string>();
    const logs = [
      makeLog({ RequestCount: 1 }),
      makeLog({ RequestCount: 1 }), // duplicate
      makeLog({ RequestCount: 2, RequestPath: '/two' }),
      makeLog({ RequestCount: 3, RequestPath: '/three' }),
    ];

    const unique = dedupeLogs(logs, seen, 2);

    expect(unique).toHaveLength(3);
    expect(seen.size).toBeLessThanOrEqual(2);
  });
});

describe('createLogBuffer', () => {
  it('flushes immediately when the batch size is reached', async () => {
    const batches: TraefikLog[][] = [];
    const log1 = makeLog({ RequestPath: '/a' });
    const log2 = makeLog({ RequestPath: '/b' });
    const log3 = makeLog({ RequestPath: '/c' });

    const buffer = createLogBuffer<TraefikLog>(
      async (lines) => {
        batches.push([...lines]);
      },
      { flushIntervalMs: 1000, maxBatchSize: 3 }
    );

    buffer.push([log1, log2]);
    expect(batches).toHaveLength(0);
    buffer.push(log3);

    await Promise.resolve();
    expect(batches).toHaveLength(1);
    expect(batches[0]).toEqual([log1, log2, log3]);
  });

  it('flushes after the interval when under the batch size', async () => {
    vi.useFakeTimers();
    const batches: TraefikLog[][] = [];
    const log1 = makeLog({ RequestPath: '/delayed' });

    const buffer = createLogBuffer<TraefikLog>(
      async (lines) => {
        batches.push([...lines]);
      },
      { flushIntervalMs: 500, maxBatchSize: 10 }
    );

    buffer.push(log1);

    await vi.advanceTimersByTimeAsync(600);

    expect(batches).toHaveLength(1);
    expect(batches[0]).toEqual([log1]);
  });
});
