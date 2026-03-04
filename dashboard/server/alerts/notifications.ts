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
    if (key === 'error_rate') {
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

export function buildAlertMessage(input: BuildAlertMessageInput): string {
  const lines: string[] = [];
  lines.push(`Rule: ${input.rule.name}`);
  lines.push(`Agent: ${input.agentName}`);
  lines.push(`Trigger: ${input.rule.trigger_type}`);
  lines.push(`Window: ${input.windowStartISO} -> ${input.windowEndISO}`);

  for (const [key, value] of Object.entries(input.metrics)) {
    lines.push(`${key}: ${formatMetricValue(key, value)}`);
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
        embeds: [
          {
            title: input.title,
            description: input.message,
            color: 15158332,
            timestamp: new Date().toISOString(),
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
