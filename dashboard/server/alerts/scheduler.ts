import { DBAgent, getAgentById, getAllAgents } from '../db';
import {
  createAlertMetricSnapshot,
  createAlertNotificationHistory,
  deleteAlertMetricSnapshot,
  listAlertRules,
  listAlertWebhooks,
  markAlertRuleEvaluation,
  pruneExpiredAlertMetricSnapshots,
} from './repository';
import {
  AggregatedAlertMetrics,
  AgentLogRecord,
  AlertInterval,
  AlertRule,
  AlertWebhook,
} from './types';
import { buildAggregatedMetrics, filterLogsByWindow, thresholdValueForParameter } from './metrics';
import { buildAlertMessage, sendWebhookNotification } from './notifications';

const DEFAULT_SCHEDULER_INTERVAL_MS = 5 * 60_000;
const DEFAULT_FETCH_LINES = 5_000;
const DEFAULT_DAILY_SUMMARY_TIME_UTC = '09:00';

const INTERVAL_TO_MS: Record<AlertInterval, number> = {
  '5m': 5 * 60_000,
  '15m': 15 * 60_000,
  '30m': 30 * 60_000,
  '1h': 60 * 60_000,
  '6h': 6 * 60 * 60_000,
  '12h': 12 * 60 * 60_000,
  '24h': 24 * 60 * 60_000,
};

interface FetchAgentLogsInput {
  agent: DBAgent;
  windowMs: number;
  nowMs: number;
}

interface RuleDispatchInput {
  agent: DBAgent;
  metrics: AggregatedAlertMetrics;
  rule: AlertRule;
  webhooks: AlertWebhook[];
  windowEndISO: string;
  windowStartISO: string;
}

interface StartAlertSchedulerInput {
  runImmediately?: boolean;
}

let schedulerTimer: NodeJS.Timeout | null = null;
let cycleInProgress = false;

function normalizeAgentURL(agent: DBAgent): string {
  return (agent.configured_url || agent.url).replace(/\/+$/, '');
}

function getSchedulerIntervalMs(): number {
  const fromEnv = Number(process.env.ALERT_SCHEDULER_INTERVAL_MS ?? DEFAULT_SCHEDULER_INTERVAL_MS);
  if (Number.isFinite(fromEnv) && fromEnv >= 60_000) {
    return fromEnv;
  }

  return DEFAULT_SCHEDULER_INTERVAL_MS;
}

function getFetchLines(): number {
  const fromEnv = Number(process.env.ALERT_FETCH_LINES ?? DEFAULT_FETCH_LINES);
  if (Number.isFinite(fromEnv) && fromEnv > 0) {
    return Math.floor(fromEnv);
  }

  return DEFAULT_FETCH_LINES;
}

function getWindowMinutes(rule: AlertRule): number {
  if (rule.snapshot_window_minutes > 0) {
    return rule.snapshot_window_minutes;
  }

  if (rule.trigger_type === 'daily_summary') {
    return 24 * 60;
  }

  return 5;
}

function isIntervalDue(rule: AlertRule, nowMs: number): boolean {
  const interval = rule.interval || '5m';
  const intervalMs = INTERVAL_TO_MS[interval] ?? INTERVAL_TO_MS['5m'];

  if (!rule.last_triggered_at) {
    return true;
  }

  const lastTriggeredMs = Date.parse(rule.last_triggered_at);
  if (Number.isNaN(lastTriggeredMs)) {
    return true;
  }

  return nowMs - lastTriggeredMs >= intervalMs;
}

function isDailySummaryDue(rule: AlertRule, now: Date): boolean {
  const [hoursRaw, minutesRaw] = (rule.schedule_time_utc || DEFAULT_DAILY_SUMMARY_TIME_UTC).split(':');
  const scheduleHour = Number(hoursRaw);
  const scheduleMinute = Number(minutesRaw);

  if (!Number.isFinite(scheduleHour) || !Number.isFinite(scheduleMinute)) {
    return false;
  }

  const scheduledToday = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
    scheduleHour,
    scheduleMinute,
    0,
    0,
  );

  const nowMs = now.getTime();
  if (nowMs < scheduledToday) {
    return false;
  }

  if (!rule.last_triggered_at) {
    return true;
  }

  const lastTriggeredMs = Date.parse(rule.last_triggered_at);
  if (Number.isNaN(lastTriggeredMs)) {
    return true;
  }

  return lastTriggeredMs < scheduledToday;
}

function shouldEvaluateRuleNow(rule: AlertRule, now: Date): boolean {
  if (!rule.enabled) {
    return false;
  }

  switch (rule.trigger_type) {
    case 'interval':
      return isIntervalDue(rule, now.getTime());
    case 'daily_summary':
      return isDailySummaryDue(rule, now);
    case 'threshold':
    default:
      return true;
  }
}

function thresholdRuleTriggered(rule: AlertRule, metrics: AggregatedAlertMetrics): boolean {
  const thresholdParameters = rule.parameters.filter((parameter) =>
    parameter.enabled && typeof parameter.threshold === 'number',
  );

  if (thresholdParameters.length === 0) {
    return false;
  }

  const checks = thresholdParameters.map((parameter) => {
    const value = thresholdValueForParameter(parameter.parameter, metrics);
    if (value == null || parameter.threshold == null) {
      return false;
    }

    return value > parameter.threshold;
  });

  if (rule.condition_operator === 'all') {
    return checks.every(Boolean);
  }

  return checks.some(Boolean);
}

async function fetchRecentAgentLogs(input: FetchAgentLogsInput): Promise<AgentLogRecord[]> {
  const controller = new AbortController();
  const timeoutID = setTimeout(() => controller.abort(), 20_000);

  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (input.agent.token) {
      headers.Authorization = `Bearer ${input.agent.token}`;
    }

    const response = await fetch(
      `${normalizeAgentURL(input.agent)}/api/logs/access?position=0&lines=${getFetchLines()}`,
      {
        method: 'GET',
        headers,
        signal: controller.signal,
      },
    );

    if (!response.ok) {
      throw new Error(`Agent logs API responded with ${response.status}`);
    }

    const payload = await response.json() as { logs?: unknown };
    const logs = Array.isArray(payload.logs) ? payload.logs as AgentLogRecord[] : [];

    return filterLogsByWindow(logs, input.windowMs, input.nowMs);
  } finally {
    clearTimeout(timeoutID);
  }
}

async function dispatchRuleNotifications(input: RuleDispatchInput): Promise<void> {
  const payload = {
    alert_rule_id: input.rule.id,
    alert_rule_name: input.rule.name,
    trigger_type: input.rule.trigger_type,
    agent_id: input.agent.id,
    agent_name: input.agent.name,
    window_start: input.windowStartISO,
    window_end: input.windowEndISO,
    metrics: input.metrics,
  };

  const title = `[${input.rule.trigger_type.toUpperCase()}] ${input.rule.name}`;
  const message = buildAlertMessage({
    rule: input.rule,
    metrics: input.metrics,
    agentName: input.agent.name,
    windowStartISO: input.windowStartISO,
    windowEndISO: input.windowEndISO,
  });

  await Promise.allSettled(
    input.webhooks.map(async (webhook) => {
      const result = await sendWebhookNotification({
        webhook,
        title,
        message,
        metadata: payload,
      });

      createAlertNotificationHistory({
        alert_rule_id: input.rule.id,
        webhook_id: webhook.id,
        agent_id: input.agent.id,
        status: result.success ? 'success' : 'failed',
        error_message: result.error,
        payload: JSON.stringify(payload),
      });
    }),
  );
}

function getRuleTargetAgents(rule: AlertRule): DBAgent[] {
  if (rule.agent_id) {
    const agent = getAgentById(rule.agent_id);
    return agent ? [agent] : [];
  }

  return getAllAgents();
}

async function processRule(rule: AlertRule, webhooksByID: Map<string, AlertWebhook>, now: Date): Promise<boolean> {
  const targetWebhooks = rule.webhook_ids
    .map((webhookID) => webhooksByID.get(webhookID))
    .filter((webhook): webhook is AlertWebhook => Boolean(webhook && webhook.enabled));

  if (targetWebhooks.length === 0) {
    markAlertRuleEvaluation({
      id: rule.id,
      evaluatedAt: now.toISOString(),
    });
    return false;
  }

  const windowMinutes = getWindowMinutes(rule);
  const windowMs = windowMinutes * 60_000;
  const nowMs = now.getTime();
  const windowStartISO = new Date(nowMs - windowMs).toISOString();
  const windowEndISO = new Date(nowMs).toISOString();

  let triggered = false;
  const targetAgents = getRuleTargetAgents(rule);

  for (const agent of targetAgents) {
    let logs: AgentLogRecord[] = [];

    try {
      logs = await fetchRecentAgentLogs({
        agent,
        windowMs,
        nowMs,
      });
    } catch (error) {
      createAlertNotificationHistory({
        alert_rule_id: rule.id,
        status: 'failed',
        agent_id: agent.id,
        error_message: error instanceof Error ? error.message : 'Failed to fetch logs for alert evaluation',
        payload: JSON.stringify({
          agent_id: agent.id,
          alert_rule_id: rule.id,
          window_start: windowStartISO,
          window_end: windowEndISO,
        }),
      });
      continue;
    }

    const aggregatedMetrics = buildAggregatedMetrics({
      logs,
      parameters: rule.parameters,
      windowMs,
    });

    const shouldTrigger =
      rule.trigger_type === 'threshold'
        ? thresholdRuleTriggered(rule, aggregatedMetrics)
        : true;

    if (!shouldTrigger) {
      continue;
    }

    triggered = true;

    const snapshot = createAlertMetricSnapshot({
      alert_rule_id: rule.id,
      agent_id: agent.id,
      metrics_json: JSON.stringify(aggregatedMetrics),
      window_start: windowStartISO,
      window_end: windowEndISO,
      expires_at: new Date(nowMs + 30 * 60_000).toISOString(),
    });

    try {
      await dispatchRuleNotifications({
        agent,
        metrics: aggregatedMetrics,
        rule,
        webhooks: targetWebhooks,
        windowEndISO,
        windowStartISO,
      });
    } finally {
      // Snapshots are temporary by design and removed after notification dispatch.
      deleteAlertMetricSnapshot(snapshot.id);
    }
  }

  markAlertRuleEvaluation({
    id: rule.id,
    evaluatedAt: now.toISOString(),
    triggeredAt: triggered ? now.toISOString() : undefined,
  });

  return triggered;
}

export async function runAlertSchedulerCycle(): Promise<void> {
  if (cycleInProgress) {
    return;
  }

  cycleInProgress = true;

  try {
    const now = new Date();
    pruneExpiredAlertMetricSnapshots(now.toISOString());

    const rules = listAlertRules().filter((rule) => shouldEvaluateRuleNow(rule, now));
    const webhooks = listAlertWebhooks();
    const webhooksByID = new Map(webhooks.map((webhook) => [webhook.id, webhook]));

    for (const rule of rules) {
      await processRule(rule, webhooksByID, now);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown scheduler error';
    console.error('[alerts] scheduler cycle failed:', message);
  } finally {
    cycleInProgress = false;
  }
}

export function startAlertScheduler(input: StartAlertSchedulerInput = {}): void {
  if (schedulerTimer) {
    return;
  }

  const intervalMs = getSchedulerIntervalMs();

  if (input.runImmediately !== false) {
    void runAlertSchedulerCycle();
  }

  schedulerTimer = setInterval(() => {
    void runAlertSchedulerCycle();
  }, intervalMs);

  console.log(`[alerts] scheduler started (interval=${intervalMs}ms)`);
}

export function stopAlertScheduler(): void {
  if (!schedulerTimer) {
    return;
  }

  clearInterval(schedulerTimer);
  schedulerTimer = null;
}
