// Client-side alert evaluation engine.
// Pure functions — no React dependency.

import { AlertRule, AlertParameterConfig } from './types/alerting';
import { DashboardMetrics } from './types';

export interface TriggeredAlert {
  rule: AlertRule;
  triggeredParams: AlertParameterConfig[];
  message: string;
}

// In-memory cooldown tracker (resets on page reload — acceptable for client-side)
const cooldowns = new Map<string, number>();

const COOLDOWN_MS: Record<string, number> = {
  '5m': 5 * 60_000,
  '15m': 15 * 60_000,
  '30m': 30 * 60_000,
  '1h': 60 * 60_000,
  '6h': 6 * 60 * 60_000,
  '12h': 12 * 60 * 60_000,
  '24h': 24 * 60 * 60_000,
};

function isOnCooldown(ruleId: string, interval?: string): boolean {
  const last = cooldowns.get(ruleId);
  if (!last) return false;
  const cooldownMs = COOLDOWN_MS[interval ?? '5m'] ?? 5 * 60_000;
  return Date.now() - last < cooldownMs;
}

function markTriggered(ruleId: string): void {
  cooldowns.set(ruleId, Date.now());
}

/**
 * Evaluate all alert rules against current metrics.
 * Returns an array of triggered alerts (rules whose thresholds are exceeded).
 */
export function evaluateAlerts(
  metrics: DashboardMetrics,
  alertRules: AlertRule[],
): TriggeredAlert[] {
  const triggered: TriggeredAlert[] = [];

  for (const rule of alertRules) {
    if (!rule.enabled) continue;
    if (isOnCooldown(rule.id, rule.interval)) continue;

    const matchedParams: AlertParameterConfig[] = [];

    for (const param of rule.parameters) {
      if (!param.enabled) continue;

      const exceeded = checkThreshold(param, metrics);
      if (exceeded) {
        matchedParams.push(param);
      }
    }

    if (matchedParams.length > 0) {
      markTriggered(rule.id);
      triggered.push({
        rule,
        triggeredParams: matchedParams,
        message: buildMessage(rule, matchedParams, metrics),
      });
    }
  }

  return triggered;
}

function checkThreshold(
  param: AlertParameterConfig,
  metrics: DashboardMetrics,
): boolean {
  const threshold = param.threshold;
  if (threshold == null) return false;

  switch (param.parameter) {
    case 'error_rate':
      return (metrics.statusCodes?.errorRate ?? 0) > threshold;
    case 'response_time':
      return (metrics.responseTime?.average ?? 0) > threshold;
    case 'request_count':
      return (metrics.requests?.total ?? 0) > threshold;
    default:
      return false;
  }
}

function buildMessage(
  rule: AlertRule,
  params: AlertParameterConfig[],
  metrics: DashboardMetrics,
): string {
  const lines: string[] = [`Alert: ${rule.name}`];

  for (const p of params) {
    switch (p.parameter) {
      case 'error_rate':
        lines.push(
          `Error rate: ${(metrics.statusCodes?.errorRate ?? 0).toFixed(1)}% (threshold: ${p.threshold}%)`,
        );
        break;
      case 'response_time':
        lines.push(
          `Avg response time: ${(metrics.responseTime?.average ?? 0).toFixed(0)}ms (threshold: ${p.threshold}ms)`,
        );
        break;
      case 'request_count':
        lines.push(
          `Request count: ${metrics.requests?.total ?? 0} (threshold: ${p.threshold})`,
        );
        break;
    }
  }

  return lines.join('\n');
}
