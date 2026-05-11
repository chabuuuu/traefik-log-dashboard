import { AggregatedAlertMetrics, AlertRule, AlertWebhook } from './types';

interface SendWebhookNotificationInput {
  webhook: AlertWebhook;
  title: string;
  message: string;
  metadata?: Record<string, unknown>;
  timeoutMs?: number;
}

interface SendWebhookNotificationResult {
  success: boolean;
  statusCode?: number;
  error?: string;
}

interface BuildAlertMessageInput {
  rule: AlertRule;
  metrics: AggregatedAlertMetrics;
  agentName: string;
  windowStartISO: string;
  windowEndISO: string;
}

function isValidWebhookURL(rawURL: string): boolean {
  try {
    const parsed = new URL(rawURL);
    if (!(parsed.protocol === 'http:' || parsed.protocol === 'https:')) {
      return false;
    }

    const allowPrivateTargets = process.env.ALERT_ALLOW_PRIVATE_WEBHOOKS === 'true';
    if (!allowPrivateTargets && isPrivateNetworkHost(parsed.hostname)) {
      return false;
    }

    return true;
  } catch {
    return false;
  }
}

function isPrivateNetworkHost(hostname: string): boolean {
  const lower = hostname.toLowerCase();
  if (
    lower === 'localhost'
    || lower === '0.0.0.0'
    || lower === '::1'
    || lower.endsWith('.local')
    || lower.endsWith('.internal')
  ) {
    return true;
  }

  if (lower.startsWith('127.') || lower.startsWith('10.') || lower.startsWith('192.168.') || lower.startsWith('169.254.')) {
    return true;
  }

  if (lower.startsWith('172.')) {
    const second = Number(lower.split('.')[1]);
    if (Number.isFinite(second) && second >= 16 && second <= 31) {
      return true;
    }
  }

  if (lower.startsWith('fc') || lower.startsWith('fd')) {
    return true;
  }

  return false;
}

function formatMetricValue(key: string, value: unknown): string {
  if (value == null) {
    return 'n/a';
  }

  if (typeof value === 'number') {
    if (key === 'error_rate' || key === 'parser_unknown_ratio' || key === 'parser_error_ratio') {
      return `${value.toFixed(2)}%`;
    }

    if (key === 'request_rate') {
      return `${value.toFixed(2)} req/s`;
    }

    if (key === 'response_time') {
      return `${value.toFixed(2)} ms`;
    }

    return `${value}`;
  }

  if (typeof value === 'object') {
    return JSON.stringify(value);
  }

  return String(value);
}

function formatAlertTimestamp(isoTimestamp: string): string {
  const timestamp = new Date(isoTimestamp);
  if (Number.isNaN(timestamp.getTime())) {
    return isoTimestamp;
  }

  return timestamp.toLocaleString('en-US');
}

function formatInteger(value: number): string {
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(value);
}

function formatRequestWord(count: number): string {
  return count === 1 ? 'request' : 'requests';
}

function getTopIPMetrics(metrics: AggregatedAlertMetrics): Array<{ ip: string; count: number }> {
  if (Array.isArray(metrics.top_ips) && metrics.top_ips.length > 0) {
    return metrics.top_ips;
  }

  if (Array.isArray(metrics.top_client_ips) && metrics.top_client_ips.length > 0) {
    return metrics.top_client_ips;
  }

  return [];
}

function getTopIPLimit(rule: AlertRule): number {
  const topIPConfig = rule.parameters.find((parameter) => parameter.parameter === 'top_ips' || parameter.parameter === 'top_client_ips');
  const configuredLimit = topIPConfig?.limit ?? 5;
  return Math.max(1, Math.min(10, configuredLimit));
}

export function buildAlertMessage(input: BuildAlertMessageInput): string {
  const lines: string[] = [];
  lines.push(`Agent: ${input.agentName}`);
  lines.push(`🚨 ${input.rule.name}`);
  lines.push(`Alert triggered at ${formatAlertTimestamp(input.windowEndISO)}`);

  if (typeof input.metrics.request_count === 'number') {
    lines.push('📈 Total Requests');
    lines.push(formatInteger(input.metrics.request_count));
  }

  if (typeof input.metrics.error_rate === 'number') {
    lines.push('❌ Error Rate');
    lines.push(`${input.metrics.error_rate.toFixed(2)}%`);
  }

  if (typeof input.metrics.parser_unknown_ratio === 'number') {
    lines.push('🧩 Parser Unknown Ratio');
    lines.push(`${input.metrics.parser_unknown_ratio.toFixed(2)}%`);
  }

  if (typeof input.metrics.parser_error_ratio === 'number') {
    lines.push('⚠️ Parser Error Ratio');
    lines.push(`${input.metrics.parser_error_ratio.toFixed(2)}%`);
  }

  if (input.metrics.response_time) {
    lines.push('⏱️ Response Time');
    lines.push(`Avg: ${Math.round(input.metrics.response_time.average)}ms`);
    lines.push(`P95: ${Math.round(input.metrics.response_time.p95)}ms`);
    lines.push(`P99: ${Math.round(input.metrics.response_time.p99)}ms`);
  }

  const topIPs = getTopIPMetrics(input.metrics);
  if (topIPs.length > 0) {
    const topIPLimit = getTopIPLimit(input.rule);
    const topIPRows = topIPs.slice(0, topIPLimit);
    lines.push(`🔝 Top ${topIPRows.length} IPs`);
    for (const row of topIPRows) {
      lines.push(`${row.ip} - ${formatInteger(row.count)} ${formatRequestWord(row.count)}`);
    }
  }

  if (
    typeof input.metrics.request_rate === 'number'
    && typeof input.metrics.request_count !== 'number'
  ) {
    lines.push('⚡ Request Rate');
    lines.push(`${input.metrics.request_rate.toFixed(2)} req/s`);
  }

  const handledKeys = new Set([
    'request_count',
    'error_rate',
    'parser_unknown_ratio',
    'parser_error_ratio',
    'response_time',
    'top_ips',
    'top_client_ips',
    'request_rate',
  ]);

  for (const [key, value] of Object.entries(input.metrics)) {
    if (handledKeys.has(key) || value == null) {
      continue;
    }
    lines.push(`${key}: ${formatMetricValue(key, value)}`);
  }

  if (Array.isArray(input.metrics.ping_results) && input.metrics.ping_results.length > 0) {
    lines.push('\n🌐 Health Check Status');
    for (const res of input.metrics.ping_results) {
      lines.push(`❌ ${res}`);
    }
  }

  return lines.join('\n');
}

export async function sendWebhookNotification(
  input: SendWebhookNotificationInput,
): Promise<SendWebhookNotificationResult> {
  if (!isValidWebhookURL(input.webhook.url)) {
    return {
      success: false,
      error: 'Invalid webhook URL',
    };
  }

  const timeoutMs = input.timeoutMs ?? 10_000;
  const abortController = new AbortController();
  const timeoutID = setTimeout(() => abortController.abort(), timeoutMs);

  try {
    let body: string;

    if (input.webhook.type === 'discord') {
      body = JSON.stringify({
        username: 'Traefik Log Dashboard',
        allowed_mentions: {
          parse: [],
        },
        embeds: [
          {
            title: input.title,
            description: input.message,
            color: 15158332,
            timestamp: new Date().toISOString(),
            footer: {
              text: 'Traefik Log Dashboard',
            },
          },
        ],
      });
    } else if (input.webhook.type === 'telegram') {
      body = JSON.stringify({
        text: `*${input.title}*\n${input.message}`,
        parse_mode: 'Markdown',
        disable_web_page_preview: true,
      });
    } else {
      body = JSON.stringify({
        title: input.title,
        message: input.message,
        timestamp: new Date().toISOString(),
        metadata: input.metadata ?? {},
      });
    }

    const response = await fetch(input.webhook.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body,
      signal: abortController.signal,
    });

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      return {
        success: false,
        statusCode: response.status,
        error: `Webhook responded with ${response.status}: ${text}`,
      };
    }

    return {
      success: true,
      statusCode: response.status,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown webhook error',
    };
  } finally {
    clearTimeout(timeoutID);
  }
}
