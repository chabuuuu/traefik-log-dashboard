import {
  AggregatedAlertMetrics,
  AgentLogRecord,
  AlertParameter,
  AlertParameterConfig,
} from './types';

interface BuildMetricsInput {
  logs: AgentLogRecord[];
  parameters: AlertParameterConfig[];
  windowMs: number;
}

function parseLogTimestamp(log: AgentLogRecord): number | null {
  const timestamp = log.StartUTC || log.StartLocal;
  if (!timestamp) {
    return null;
  }

  const parsed = Date.parse(timestamp);
  return Number.isNaN(parsed) ? null : parsed;
}

function toDurationMs(log: AgentLogRecord): number {
  const duration = typeof log.Duration === 'number' ? log.Duration : 0;
  return duration > 10000 ? duration / 1_000_000 : duration;
}

function percentile(values: number[], p: number): number {
  if (values.length === 0) {
    return 0;
  }

  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[Math.max(0, index)] ?? 0;
}

function topN<T extends string>(values: T[], limit: number): Array<{ value: T; count: number }> {
  const counts = new Map<T, number>();

  for (const value of values) {
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }

  return [...counts.entries()]
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, Math.max(1, limit));
}

function getParameterLimit(parameter: AlertParameterConfig): number {
  return Math.max(1, Math.min(50, parameter.limit ?? 5));
}

export function filterLogsByWindow(logs: AgentLogRecord[], windowMs: number, nowMs: number): AgentLogRecord[] {
  const minTimestamp = nowMs - windowMs;

  return logs.filter((log) => {
    const timestamp = parseLogTimestamp(log);
    if (!timestamp) {
      return false;
    }

    return timestamp >= minTimestamp && timestamp <= nowMs;
  });
}

export function buildAggregatedMetrics(input: BuildMetricsInput): AggregatedAlertMetrics {
  const enabledParameters = input.parameters.filter((parameter) => parameter.enabled);
  const selectedParameters = new Set(enabledParameters.map((parameter) => parameter.parameter));

  const requestCount = input.logs.length;
  const errors = input.logs.filter((log) => {
    const status = typeof log.DownstreamStatus === 'number' ? log.DownstreamStatus : 0;
    return status >= 400;
  }).length;

  const durations = input.logs.map(toDurationMs).filter((duration) => duration >= 0);

  const metrics: AggregatedAlertMetrics = {};

  if (selectedParameters.has('request_count')) {
    metrics.request_count = requestCount;
  }

  if (selectedParameters.has('request_rate')) {
    const windowSeconds = input.windowMs / 1000;
    metrics.request_rate = windowSeconds > 0 ? requestCount / windowSeconds : 0;
  }

  if (selectedParameters.has('error_rate')) {
    metrics.error_rate = requestCount > 0 ? (errors / requestCount) * 100 : 0;
  }

  if (selectedParameters.has('response_time')) {
    const average = durations.length > 0 ? durations.reduce((sum, value) => sum + value, 0) / durations.length : 0;
    metrics.response_time = {
      average,
      p95: percentile(durations, 95),
      p99: percentile(durations, 99),
    };
  }

  for (const parameter of enabledParameters) {
    const limit = getParameterLimit(parameter);

    switch (parameter.parameter) {
      case 'top_ips': {
        metrics.top_ips = topN(
          input.logs.map((log) => log.ClientHost).filter((ip): ip is string => Boolean(ip)),
          limit,
        ).map((entry) => ({ ip: entry.value, count: entry.count }));
        break;
      }
      case 'top_client_ips': {
        metrics.top_client_ips = topN(
          input.logs.map((log) => log.ClientHost).filter((ip): ip is string => Boolean(ip)),
          limit,
        ).map((entry) => ({ ip: entry.value, count: entry.count }));
        break;
      }
      case 'top_locations': {
        const locationCounts = new Map<string, { country: string; city?: string; count: number }>();
        for (const log of input.logs) {
          const country = log.geoCountry || 'Unknown';
          const city = log.geoCity || undefined;
          const key = `${country}|${city ?? ''}`;
          const existing = locationCounts.get(key);

          if (existing) {
            existing.count += 1;
          } else {
            locationCounts.set(key, { country, city, count: 1 });
          }
        }

        metrics.top_locations = [...locationCounts.values()]
          .sort((a, b) => b.count - a.count)
          .slice(0, limit);
        break;
      }
      case 'top_routes': {
        const routeMap = new Map<string, { path: string; count: number; durationMsSum: number }>();
        for (const log of input.logs) {
          const path = log.RequestPath || '/';
          const existing = routeMap.get(path);
          if (existing) {
            existing.count += 1;
            existing.durationMsSum += toDurationMs(log);
          } else {
            routeMap.set(path, { path, count: 1, durationMsSum: toDurationMs(log) });
          }
        }

        metrics.top_routes = [...routeMap.values()]
          .sort((a, b) => b.count - a.count)
          .slice(0, limit)
          .map((entry) => ({
            path: entry.path,
            count: entry.count,
            avgDuration: entry.count > 0 ? entry.durationMsSum / entry.count : 0,
          }));
        break;
      }
      case 'top_status_codes': {
        metrics.top_status_codes = topN(
          input.logs
            .map((log) => (typeof log.DownstreamStatus === 'number' ? String(log.DownstreamStatus) : '0'))
            .filter((status) => status !== '0'),
          limit,
        ).map((entry) => ({ status: Number(entry.value), count: entry.count }));
        break;
      }
      case 'top_user_agents': {
        metrics.top_user_agents = topN(
          input.logs.map((log) => log.RequestUserAgent).filter((ua): ua is string => Boolean(ua)),
          limit,
        ).map((entry) => ({ browser: entry.value, count: entry.count }));
        break;
      }
      case 'top_routers': {
        metrics.top_routers = topN(
          input.logs.map((log) => log.RouterName).filter((router): router is string => Boolean(router)),
          limit,
        ).map((entry) => ({ name: entry.value, requests: entry.count }));
        break;
      }
      case 'top_services': {
        metrics.top_services = topN(
          input.logs.map((log) => log.ServiceName).filter((service): service is string => Boolean(service)),
          limit,
        ).map((entry) => ({ name: entry.value, requests: entry.count }));
        break;
      }
      case 'top_hosts': {
        metrics.top_hosts = topN(
          input.logs.map((log) => log.RequestHost).filter((host): host is string => Boolean(host)),
          limit,
        ).map((entry) => ({ host: entry.value, count: entry.count }));
        break;
      }
      case 'top_request_addresses': {
        metrics.top_request_addresses = topN(
          input.logs.map((log) => log.RequestAddr).filter((address): address is string => Boolean(address)),
          limit,
        ).map((entry) => ({ addr: entry.value, count: entry.count }));
        break;
      }
      default:
        break;
    }
  }

  return metrics;
}

export function thresholdValueForParameter(
  parameter: AlertParameter,
  metrics: AggregatedAlertMetrics,
): number | null {
  switch (parameter) {
    case 'error_rate':
      return metrics.error_rate ?? null;
    case 'response_time':
      return metrics.response_time?.average ?? null;
    case 'request_count':
      return metrics.request_count ?? null;
    case 'request_rate':
      return metrics.request_rate ?? null;
    default:
      return null;
  }
}
