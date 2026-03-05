import { DBAgent, getAgentById, getAllAgents } from '../db';
import {
  createAlertMetricSnapshot,
  createAlertNotificationHistory,
  deleteAlertMetricSnapshot,
  getAlertThresholdBreached,
  listAlertRules,
  listAlertWebhooks,
  markAlertRuleEvaluation,
  pruneExpiredAlertMetricSnapshots,
  upsertAlertThresholdState,
} from './repository';
import {
  AggregatedAlertMetrics,
  AgentLogRecord,
  AlertInterval,
  AlertRule,
  AlertWebhook,
  ParserMetricsSnapshot,
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
  nowMs: number;
  windowMs: number;
}

interface RuleDispatchInput {
  agent: DBAgent;
  metrics: AggregatedAlertMetrics;
  rule: AlertRule;
  webhooks: AlertWebhook[];
  windowEndISO: string;
  windowStartISO: string;
}

interface ProcessAgentRuleInput {
  agent: DBAgent;
  context: SchedulerExecutionContext;
  rule: AlertRule;
  targetWebhooks: AlertWebhook[];
  windowEndISO: string;
  windowMs: number;
  windowStartISO: string;
}

interface StartAlertSchedulerInput {
  runImmediately?: boolean;
}

interface SchedulerExecutionContext {
  errors: string[];
  logCache: Map<string, Promise<AgentLogRecord[]>>;
  parserMetricsCache: Map<string, Promise<ParserMetricsSnapshot | null>>;
  now: Date;
  webhooksByID: Map<string, AlertWebhook>;
}

interface ParserCounterTotals {
  parsed: number;
  total: number;
  unknown: number;
  errors: number;
}

export interface AlertSchedulerCycleResult {
  started: boolean;
  skipped: boolean;
  evaluatedRules: number;
  triggeredRules: number;
  errors: string[];
}

let schedulerTimer: NodeJS.Timeout | null = null;
let cycleInProgress = false;
const parserCounterBaselineByAgent = new Map<string, ParserCounterTotals>();

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

function hasParserThresholdParameters(rule: AlertRule): boolean {
  return rule.parameters.some((parameter) =>
    parameter.enabled
    && (parameter.parameter === 'parser_unknown_ratio' || parameter.parameter === 'parser_error_ratio'),
  );
}

function getNumber(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function toParserCounterTotals(metrics: ParserMetricsSnapshot | null): ParserCounterTotals | null {
  if (!metrics) {
    return null;
  }

  const json = getNumber(metrics.json);
  const traefikCLF = getNumber(metrics.traefik_clf);
  const genericCLF = getNumber(metrics.generic_clf);
  const unknown = getNumber(metrics.unknown);
  const errors = getNumber(metrics.errors);

  const parsed = json + traefikCLF + genericCLF;
  const total = parsed + unknown;

  return {
    parsed,
    total,
    unknown,
    errors,
  };
}

function computeParserRatios(
  current: ParserCounterTotals,
  previous?: ParserCounterTotals,
): { unknownRatio: number; errorRatio: number } {
  if (previous) {
    const totalDelta = Math.max(0, current.total - previous.total);
    const unknownDelta = Math.max(0, current.unknown - previous.unknown);
    const parsedDelta = Math.max(0, current.parsed - previous.parsed);
    const errorsDelta = Math.max(0, current.errors - previous.errors);

    if (totalDelta > 0) {
      return {
        unknownRatio: unknownDelta / totalDelta,
        errorRatio: parsedDelta > 0 ? errorsDelta / parsedDelta : 0,
      };
    }
  }

  return {
    unknownRatio: current.total > 0 ? current.unknown / current.total : 0,
    errorRatio: current.parsed > 0 ? current.errors / current.parsed : 0,
  };
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

function thresholdRuleBreached(rule: AlertRule, metrics: AggregatedAlertMetrics): boolean {
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

function addCycleError(context: SchedulerExecutionContext, message: string): void {
  context.errors.push(message);
  console.error('[alerts]', message);
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

async function fetchParserMetrics(agent: DBAgent): Promise<ParserMetricsSnapshot | null> {
  const controller = new AbortController();
  const timeoutID = setTimeout(() => controller.abort(), 20_000);

  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (agent.token) {
      headers.Authorization = `Bearer ${agent.token}`;
    }

    const response = await fetch(`${normalizeAgentURL(agent)}/api/logs/status`, {
      method: 'GET',
      headers,
      signal: controller.signal,
    });

    if (response.status === 404) {
      return null;
    }

    if (!response.ok) {
      throw new Error(`Agent status API responded with ${response.status}`);
    }

    const payload = await response.json() as { parser_metrics?: ParserMetricsSnapshot };
    return payload.parser_metrics ?? null;
  } finally {
    clearTimeout(timeoutID);
  }
}

function getRuleTargetAgents(rule: AlertRule): DBAgent[] {
  if (rule.agent_id) {
    const agent = getAgentById(rule.agent_id);
    return agent ? [agent] : [];
  }

  return getAllAgents();
}

async function getCachedAgentLogs(
  context: SchedulerExecutionContext,
  agent: DBAgent,
  windowMs: number,
): Promise<AgentLogRecord[]> {
  const nowMs = context.now.getTime();
  const key = `${agent.id}:${windowMs}:${nowMs}`;

  if (!context.logCache.has(key)) {
    context.logCache.set(key, fetchRecentAgentLogs({
      agent,
      nowMs,
      windowMs,
    }));
  }

  return context.logCache.get(key)!;
}

async function getCachedParserMetrics(
  context: SchedulerExecutionContext,
  agent: DBAgent,
): Promise<ParserMetricsSnapshot | null> {
  const key = `${agent.id}:${context.now.getTime()}`;

  if (!context.parserMetricsCache.has(key)) {
    context.parserMetricsCache.set(key, fetchParserMetrics(agent));
  }

  return context.parserMetricsCache.get(key)!;
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

  const title = `🚨 ${input.rule.name}`;
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

async function processRuleForAgent(input: ProcessAgentRuleInput): Promise<boolean> {
  let logs: AgentLogRecord[] = [];

  try {
    logs = await getCachedAgentLogs(input.context, input.agent, input.windowMs);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch logs for alert evaluation';
    createAlertNotificationHistory({
      alert_rule_id: input.rule.id,
      status: 'failed',
      agent_id: input.agent.id,
      error_message: message,
      payload: JSON.stringify({
        agent_id: input.agent.id,
        alert_rule_id: input.rule.id,
        window_start: input.windowStartISO,
        window_end: input.windowEndISO,
      }),
    });
    addCycleError(input.context, `rule=${input.rule.id} agent=${input.agent.id}: ${message}`);
    return false;
  }

  const aggregatedMetrics = buildAggregatedMetrics({
    logs,
    parameters: input.rule.parameters,
    windowMs: input.windowMs,
    parserRatios: undefined,
  });

  if (hasParserThresholdParameters(input.rule)) {
    try {
      const parserMetrics = await getCachedParserMetrics(input.context, input.agent);
      const currentCounters = toParserCounterTotals(parserMetrics);

      if (currentCounters) {
        const previousCounters = parserCounterBaselineByAgent.get(input.agent.id);
        const parserRatios = computeParserRatios(currentCounters, previousCounters);
        parserCounterBaselineByAgent.set(input.agent.id, currentCounters);
        aggregatedMetrics.parser_unknown_ratio = parserRatios.unknownRatio * 100;
        aggregatedMetrics.parser_error_ratio = parserRatios.errorRatio * 100;
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to fetch parser metrics';
      addCycleError(input.context, `rule=${input.rule.id} agent=${input.agent.id}: ${message}`);
    }
  }

  let shouldTrigger = true;

  if (input.rule.trigger_type === 'threshold') {
    const breached = thresholdRuleBreached(input.rule, aggregatedMetrics);
    const wasBreached = getAlertThresholdBreached(input.rule.id, input.agent.id);

    upsertAlertThresholdState({
      ruleID: input.rule.id,
      agentID: input.agent.id,
      breached,
      updatedAt: input.context.now.toISOString(),
    });

    // Fire only when a threshold transitions into breached state.
    shouldTrigger = breached && !wasBreached;
  }

  if (!shouldTrigger) {
    return false;
  }

  const snapshot = createAlertMetricSnapshot({
    alert_rule_id: input.rule.id,
    agent_id: input.agent.id,
    metrics_json: JSON.stringify(aggregatedMetrics),
    window_start: input.windowStartISO,
    window_end: input.windowEndISO,
    expires_at: new Date(input.context.now.getTime() + 30 * 60_000).toISOString(),
  });

  try {
    await dispatchRuleNotifications({
      agent: input.agent,
      metrics: aggregatedMetrics,
      rule: input.rule,
      webhooks: input.targetWebhooks,
      windowEndISO: input.windowEndISO,
      windowStartISO: input.windowStartISO,
    });
  } finally {
    // Snapshots are temporary by design and removed after notification dispatch.
    deleteAlertMetricSnapshot(snapshot.id);
  }

  return true;
}

async function processRule(rule: AlertRule, context: SchedulerExecutionContext): Promise<boolean> {
  const targetWebhooks = rule.webhook_ids
    .map((webhookID) => context.webhooksByID.get(webhookID))
    .filter((webhook): webhook is AlertWebhook => Boolean(webhook && webhook.enabled));

  if (targetWebhooks.length === 0) {
    markAlertRuleEvaluation({
      id: rule.id,
      evaluatedAt: context.now.toISOString(),
    });
    return false;
  }

  const targetAgents = getRuleTargetAgents(rule);
  if (targetAgents.length === 0) {
    markAlertRuleEvaluation({
      id: rule.id,
      evaluatedAt: context.now.toISOString(),
    });
    return false;
  }

  const windowMinutes = getWindowMinutes(rule);
  const windowMs = windowMinutes * 60_000;
  const nowMs = context.now.getTime();
  const windowStartISO = new Date(nowMs - windowMs).toISOString();
  const windowEndISO = context.now.toISOString();

  const results = await Promise.allSettled(
    targetAgents.map((agent) => processRuleForAgent({
      agent,
      context,
      rule,
      targetWebhooks,
      windowEndISO,
      windowMs,
      windowStartISO,
    })),
  );

  const triggered = results.some((result) => result.status === 'fulfilled' && result.value);

  for (const result of results) {
    if (result.status === 'rejected') {
      addCycleError(context, `rule=${rule.id} execution error: ${String(result.reason)}`);
    }
  }

  markAlertRuleEvaluation({
    id: rule.id,
    evaluatedAt: context.now.toISOString(),
    triggeredAt: triggered ? context.now.toISOString() : undefined,
  });

  return triggered;
}

export async function runAlertSchedulerCycle(): Promise<AlertSchedulerCycleResult> {
  if (cycleInProgress) {
    return {
      started: false,
      skipped: true,
      evaluatedRules: 0,
      triggeredRules: 0,
      errors: ['scheduler cycle skipped because a previous cycle is still in progress'],
    };
  }

  cycleInProgress = true;

  const context: SchedulerExecutionContext = {
    errors: [],
    logCache: new Map(),
    parserMetricsCache: new Map(),
    now: new Date(),
    webhooksByID: new Map(listAlertWebhooks().map((webhook) => [webhook.id, webhook])),
  };

  try {
    pruneExpiredAlertMetricSnapshots(context.now.toISOString());

    const rules = listAlertRules().filter((rule) => shouldEvaluateRuleNow(rule, context.now));
    const ruleResults = await Promise.allSettled(rules.map((rule) => processRule(rule, context)));

    let triggeredRules = 0;
    for (const result of ruleResults) {
      if (result.status === 'fulfilled') {
        if (result.value) {
          triggeredRules += 1;
        }
      } else {
        addCycleError(context, `rule processing promise rejected: ${String(result.reason)}`);
      }
    }

    return {
      started: true,
      skipped: false,
      evaluatedRules: rules.length,
      triggeredRules,
      errors: context.errors,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown scheduler error';
    addCycleError(context, `scheduler cycle failed: ${message}`);

    return {
      started: true,
      skipped: false,
      evaluatedRules: 0,
      triggeredRules: 0,
      errors: context.errors,
    };
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
