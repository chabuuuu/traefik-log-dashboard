import { describe, expect, it } from 'vitest';
import { buildAlertMessage } from './notifications';
import { AlertRule, AggregatedAlertMetrics } from './types';

function makeRule(overrides: Partial<AlertRule> = {}): AlertRule {
  return {
    id: 'rule-001',
    name: 'New-Deployment',
    enabled: true,
    trigger_type: 'interval',
    interval: '5m',
    webhook_ids: ['webhook-001'],
    snapshot_window_minutes: 5,
    condition_operator: 'any',
    parameters: [
      { parameter: 'request_count', enabled: true },
      { parameter: 'error_rate', enabled: true },
      { parameter: 'response_time', enabled: true },
      { parameter: 'top_ips', enabled: true, limit: 5 },
    ],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

describe('buildAlertMessage', () => {
  it('formats alert body as readable sections for Discord embeds', () => {
    const metrics: AggregatedAlertMetrics = {
      request_count: 29,
      error_rate: 24.14,
      response_time: {
        average: 406.23,
        p95: 1132.01,
        p99: 4205.76,
      },
      top_ips: [
        { ip: '111.77.55.22', count: 24 },
        { ip: '204.76.203.25', count: 2 },
        { ip: '45.156.87.50', count: 1 },
      ],
    };

    const message = buildAlertMessage({
      rule: makeRule(),
      metrics,
      agentName: 'Default Agent',
      windowStartISO: '2026-02-07T03:32:07.000Z',
      windowEndISO: '2026-02-07T03:37:07.000Z',
    });

    expect(message).toContain('Agent: Default Agent');
    expect(message).toContain('🚨 New-Deployment');
    expect(message).toContain('📈 Total Requests');
    expect(message).toContain('29');
    expect(message).toContain('❌ Error Rate');
    expect(message).toContain('24.14%');
    expect(message).toContain('⏱️ Response Time');
    expect(message).toContain('Avg: 406ms');
    expect(message).toContain('P95: 1132ms');
    expect(message).toContain('P99: 4206ms');
    expect(message).toContain('🔝 Top 3 IPs');
    expect(message).toContain('111.77.55.22 - 24 requests');
    expect(message).toContain('204.76.203.25 - 2 requests');
    expect(message).not.toContain('[{"ip":');
  });

  it('uses top_client_ips when top_ips is absent', () => {
    const metrics: AggregatedAlertMetrics = {
      top_client_ips: [
        { ip: '10.10.10.10', count: 7 },
      ],
    };

    const message = buildAlertMessage({
      rule: makeRule({
        parameters: [{ parameter: 'top_client_ips', enabled: true, limit: 5 }],
      }),
      metrics,
      agentName: 'Default Agent',
      windowStartISO: '2026-02-07T03:32:07.000Z',
      windowEndISO: '2026-02-07T03:37:07.000Z',
    });

    expect(message).toContain('🔝 Top 1 IPs');
    expect(message).toContain('10.10.10.10 - 7 requests');
  });
});
