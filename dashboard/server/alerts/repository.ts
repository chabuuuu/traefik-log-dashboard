import { randomUUID } from 'crypto';
import { getDB } from '../db';
import {
  AlertMetricSnapshot,
  AlertNotificationHistory,
  AlertParameterConfig,
  AlertRule,
  AlertWebhook,
} from './types';

interface AlertWebhookRow {
  id: string;
  name: string;
  type: string;
  url: string;
  enabled: number;
  description: string | null;
  created_at: string;
  updated_at: string;
}

interface AlertRuleRow {
  id: string;
  name: string;
  description: string | null;
  enabled: number;
  agent_id: string | null;
  webhook_ids: string;
  trigger_type: string;
  interval: string | null;
  schedule_time_utc: string | null;
  snapshot_window_minutes: number;
  condition_operator: string;
  last_triggered_at: string | null;
  last_evaluated_at: string | null;
  ping_urls: string | null;
  created_at: string;
  updated_at: string;
}

interface AlertRuleParameterRow {
  parameter: string;
  enabled: number;
  limit_value: number | null;
  threshold: number | null;
}

interface AlertHistoryRow {
  id: string;
  alert_rule_id: string | null;
  webhook_id: string | null;
  agent_id: string | null;
  status: 'success' | 'failed';
  error_message: string | null;
  payload: string;
  created_at: string;
}

interface SnapshotRow {
  id: string;
  alert_rule_id: string;
  agent_id: string | null;
  metrics_json: string;
  window_start: string;
  window_end: string;
  created_at: string;
  expires_at: string;
}

interface NotificationStatsRow {
  total: number;
  last24h: number;
  success: number;
  failed: number;
}

interface ThresholdStateRow {
  alert_rule_id: string;
  agent_id: string;
  breached: number;
  updated_at: string;
}

interface CreateWebhookInput {
  name: string;
  type: AlertWebhook['type'];
  url: string;
  enabled?: boolean;
  description?: string;
}

interface UpdateWebhookInput {
  id: string;
  updates: Partial<Omit<AlertWebhook, 'id' | 'created_at' | 'updated_at'>>;
}

interface CreateAlertRuleInput {
  name: string;
  description?: string;
  enabled?: boolean;
  agent_id?: string;
  webhook_ids: string[];
  trigger_type: AlertRule['trigger_type'];
  interval?: AlertRule['interval'];
  schedule_time_utc?: string;
  snapshot_window_minutes?: number;
  condition_operator?: AlertRule['condition_operator'];
  parameters: AlertParameterConfig[];
  ping_urls?: string[];
}

interface UpdateAlertRuleInput {
  id: string;
  updates: Partial<Omit<AlertRule, 'id' | 'created_at' | 'updated_at' | 'parameters'>> & {
    parameters?: AlertParameterConfig[];
    ping_urls?: string[];
  };
}

interface CreateHistoryInput {
  alert_rule_id?: string;
  webhook_id?: string;
  agent_id?: string;
  status: 'success' | 'failed';
  error_message?: string;
  payload: string;
}

interface CreateSnapshotInput {
  alert_rule_id: string;
  agent_id?: string;
  metrics_json: string;
  window_start: string;
  window_end: string;
  expires_at: string;
}

interface MarkRuleEvaluationInput {
  id: string;
  evaluatedAt: string;
  triggeredAt?: string;
}

function parseWebhookIDs(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : [];
  } catch {
    return [];
  }
}

function parsePingURLs(raw: string | null): string[] | undefined {
  if (!raw) return undefined;
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((url): url is string => typeof url === 'string') : undefined;
  } catch {
    return undefined;
  }
}

function toWebhook(row: AlertWebhookRow): AlertWebhook {
  return {
    id: row.id,
    name: row.name,
    type: row.type as AlertWebhook['type'],
    url: row.url,
    enabled: row.enabled === 1,
    description: row.description ?? undefined,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function toRule(row: AlertRuleRow, parameters: AlertParameterConfig[]): AlertRule {
  return {
    id: row.id,
    name: row.name,
    description: row.description ?? undefined,
    enabled: row.enabled === 1,
    agent_id: row.agent_id ?? undefined,
    webhook_ids: parseWebhookIDs(row.webhook_ids),
    trigger_type: row.trigger_type as AlertRule['trigger_type'],
    interval: (row.interval ?? undefined) as AlertRule['interval'] | undefined,
    schedule_time_utc: row.schedule_time_utc ?? undefined,
    snapshot_window_minutes: row.snapshot_window_minutes,
    condition_operator: row.condition_operator === 'all' ? 'all' : 'any',
    parameters,
    ping_urls: parsePingURLs(row.ping_urls),
    last_triggered_at: row.last_triggered_at ?? undefined,
    last_evaluated_at: row.last_evaluated_at ?? undefined,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function getRuleParameters(ruleId: string): AlertParameterConfig[] {
  const rows = getDB()
    .prepare('SELECT parameter, enabled, limit_value, threshold FROM alert_rule_parameters WHERE rule_id = ? ORDER BY id ASC')
    .all(ruleId) as AlertRuleParameterRow[];

  return rows.map((row) => ({
    parameter: row.parameter as AlertParameterConfig['parameter'],
    enabled: row.enabled === 1,
    limit: row.limit_value ?? undefined,
    threshold: row.threshold ?? undefined,
  }));
}

function upsertRuleParameters(ruleId: string, parameters: AlertParameterConfig[]): void {
  const db = getDB();
  const now = new Date().toISOString();

  const transaction = db.transaction(() => {
    db.prepare('DELETE FROM alert_rule_parameters WHERE rule_id = ?').run(ruleId);

    const insert = db.prepare(`
      INSERT INTO alert_rule_parameters (rule_id, parameter, enabled, limit_value, threshold, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    for (const parameter of parameters) {
      insert.run(
        ruleId,
        parameter.parameter,
        parameter.enabled ? 1 : 0,
        parameter.limit ?? null,
        parameter.threshold ?? null,
        now,
        now,
      );
    }
  });

  transaction();
}

export function initAlertingSchema(): void {
  const db = getDB();

  db.exec(`
    CREATE TABLE IF NOT EXISTS alert_webhooks (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT NOT NULL CHECK (type IN ('discord', 'telegram', 'webhook')),
      url TEXT NOT NULL,
      enabled INTEGER NOT NULL DEFAULT 1,
      description TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS alert_rules (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      enabled INTEGER NOT NULL DEFAULT 1,
      agent_id TEXT,
      webhook_ids TEXT NOT NULL,
      trigger_type TEXT NOT NULL CHECK (trigger_type IN ('interval', 'threshold', 'daily_summary')),
      interval TEXT,
      schedule_time_utc TEXT,
      snapshot_window_minutes INTEGER NOT NULL DEFAULT 5,
      condition_operator TEXT NOT NULL DEFAULT 'any' CHECK (condition_operator IN ('any', 'all')),
      last_triggered_at TEXT,
      last_evaluated_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS alert_rule_parameters (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      rule_id TEXT NOT NULL,
      parameter TEXT NOT NULL,
      enabled INTEGER NOT NULL DEFAULT 1,
      limit_value INTEGER,
      threshold REAL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (rule_id) REFERENCES alert_rules(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_alert_rule_parameters_rule_id
      ON alert_rule_parameters(rule_id);

    CREATE TABLE IF NOT EXISTS alert_notification_history (
      id TEXT PRIMARY KEY,
      alert_rule_id TEXT,
      webhook_id TEXT,
      agent_id TEXT,
      status TEXT NOT NULL CHECK (status IN ('success', 'failed')),
      error_message TEXT,
      payload TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (alert_rule_id) REFERENCES alert_rules(id) ON DELETE SET NULL,
      FOREIGN KEY (webhook_id) REFERENCES alert_webhooks(id) ON DELETE SET NULL
    );

    CREATE INDEX IF NOT EXISTS idx_alert_history_created_at
      ON alert_notification_history(created_at DESC);

    CREATE TABLE IF NOT EXISTS alert_metric_snapshots (
      id TEXT PRIMARY KEY,
      alert_rule_id TEXT NOT NULL,
      agent_id TEXT,
      metrics_json TEXT NOT NULL,
      window_start TEXT NOT NULL,
      window_end TEXT NOT NULL,
      created_at TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      FOREIGN KEY (alert_rule_id) REFERENCES alert_rules(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_alert_metric_snapshots_expires_at
      ON alert_metric_snapshots(expires_at);

    CREATE TABLE IF NOT EXISTS alert_threshold_state (
      alert_rule_id TEXT NOT NULL,
      agent_id TEXT NOT NULL,
      breached INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (alert_rule_id, agent_id),
      FOREIGN KEY (alert_rule_id) REFERENCES alert_rules(id) ON DELETE CASCADE,
      FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE
    );
  `);

  try {
    db.prepare('ALTER TABLE alert_rules ADD COLUMN ping_urls TEXT').run();
  } catch {
    // column exists or other error
  }
}

export function listAlertWebhooks(): AlertWebhook[] {
  const rows = getDB()
    .prepare('SELECT * FROM alert_webhooks ORDER BY created_at DESC')
    .all() as AlertWebhookRow[];

  return rows.map(toWebhook);
}

export function getAlertWebhookByID(id: string): AlertWebhook | null {
  const row = getDB()
    .prepare('SELECT * FROM alert_webhooks WHERE id = ?')
    .get(id) as AlertWebhookRow | undefined;

  return row ? toWebhook(row) : null;
}

export function createAlertWebhook(input: CreateWebhookInput): AlertWebhook {
  const id = randomUUID();
  const now = new Date().toISOString();

  getDB().prepare(`
    INSERT INTO alert_webhooks (id, name, type, url, enabled, description, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    input.name,
    input.type,
    input.url,
    input.enabled === false ? 0 : 1,
    input.description ?? null,
    now,
    now,
  );

  const webhook = getAlertWebhookByID(id);
  if (!webhook) {
    throw new Error('Failed to create webhook');
  }

  return webhook;
}

export function updateAlertWebhook(input: UpdateWebhookInput): AlertWebhook | null {
  const existing = getAlertWebhookByID(input.id);
  if (!existing) {
    return null;
  }

  const updates: string[] = [];
  const values: unknown[] = [];

  if (input.updates.name !== undefined) {
    updates.push('name = ?');
    values.push(input.updates.name);
  }

  if (input.updates.type !== undefined) {
    updates.push('type = ?');
    values.push(input.updates.type);
  }

  if (input.updates.url !== undefined) {
    updates.push('url = ?');
    values.push(input.updates.url);
  }

  if (input.updates.enabled !== undefined) {
    updates.push('enabled = ?');
    values.push(input.updates.enabled ? 1 : 0);
  }

  if (input.updates.description !== undefined) {
    updates.push('description = ?');
    values.push(input.updates.description ?? null);
  }

  if (updates.length === 0) {
    return existing;
  }

  updates.push('updated_at = ?');
  values.push(new Date().toISOString());
  values.push(input.id);

  getDB().prepare(`UPDATE alert_webhooks SET ${updates.join(', ')} WHERE id = ?`).run(...values);
  return getAlertWebhookByID(input.id);
}

export function deleteAlertWebhook(id: string): boolean {
  const result = getDB().prepare('DELETE FROM alert_webhooks WHERE id = ?').run(id);
  return result.changes > 0;
}

export function listAlertRules(): AlertRule[] {
  const rows = getDB()
    .prepare('SELECT * FROM alert_rules ORDER BY created_at DESC')
    .all() as AlertRuleRow[];

  return rows.map((row) => toRule(row, getRuleParameters(row.id)));
}

export function getAlertRuleByID(id: string): AlertRule | null {
  const row = getDB()
    .prepare('SELECT * FROM alert_rules WHERE id = ?')
    .get(id) as AlertRuleRow | undefined;

  if (!row) {
    return null;
  }

  return toRule(row, getRuleParameters(row.id));
}

export function createAlertRule(input: CreateAlertRuleInput): AlertRule {
  const id = randomUUID();
  const now = new Date().toISOString();

  getDB().prepare(`
    INSERT INTO alert_rules (
      id,
      name,
      description,
      enabled,
      agent_id,
      webhook_ids,
      trigger_type,
      interval,
      schedule_time_utc,
      snapshot_window_minutes,
      condition_operator,
      ping_urls,
      created_at,
      updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    input.name,
    input.description ?? null,
    input.enabled === false ? 0 : 1,
    input.agent_id ?? null,
    JSON.stringify(input.webhook_ids),
    input.trigger_type,
    input.interval ?? null,
    input.schedule_time_utc ?? null,
    input.snapshot_window_minutes ?? 5,
    input.condition_operator ?? 'any',
    input.ping_urls ? JSON.stringify(input.ping_urls) : null,
    now,
    now,
  );

  upsertRuleParameters(id, input.parameters);

  const created = getAlertRuleByID(id);
  if (!created) {
    throw new Error('Failed to create alert rule');
  }

  return created;
}

export function updateAlertRule(input: UpdateAlertRuleInput): AlertRule | null {
  const existing = getAlertRuleByID(input.id);
  if (!existing) {
    return null;
  }

  const updates: string[] = [];
  const values: unknown[] = [];

  if (input.updates.name !== undefined) {
    updates.push('name = ?');
    values.push(input.updates.name);
  }

  if (input.updates.description !== undefined) {
    updates.push('description = ?');
    values.push(input.updates.description ?? null);
  }

  if (input.updates.enabled !== undefined) {
    updates.push('enabled = ?');
    values.push(input.updates.enabled ? 1 : 0);
  }

  if (input.updates.agent_id !== undefined) {
    updates.push('agent_id = ?');
    values.push(input.updates.agent_id ?? null);
  }

  if (input.updates.webhook_ids !== undefined) {
    updates.push('webhook_ids = ?');
    values.push(JSON.stringify(input.updates.webhook_ids));
  }

  if (input.updates.trigger_type !== undefined) {
    updates.push('trigger_type = ?');
    values.push(input.updates.trigger_type);
  }

  if (input.updates.interval !== undefined) {
    updates.push('interval = ?');
    values.push(input.updates.interval ?? null);
  }

  if (input.updates.schedule_time_utc !== undefined) {
    updates.push('schedule_time_utc = ?');
    values.push(input.updates.schedule_time_utc ?? null);
  }

  if (input.updates.snapshot_window_minutes !== undefined) {
    updates.push('snapshot_window_minutes = ?');
    values.push(input.updates.snapshot_window_minutes);
  }

  if (input.updates.condition_operator !== undefined) {
    updates.push('condition_operator = ?');
    values.push(input.updates.condition_operator);
  }

  if (input.updates.ping_urls !== undefined) {
    updates.push('ping_urls = ?');
    values.push(input.updates.ping_urls ? JSON.stringify(input.updates.ping_urls) : null);
  }

  if (updates.length > 0) {
    updates.push('updated_at = ?');
    values.push(new Date().toISOString());
    values.push(input.id);

    getDB().prepare(`UPDATE alert_rules SET ${updates.join(', ')} WHERE id = ?`).run(...values);
  }

  if (input.updates.parameters) {
    upsertRuleParameters(input.id, input.updates.parameters);
  }

  return getAlertRuleByID(input.id);
}

export function deleteAlertRule(id: string): boolean {
  const result = getDB().prepare('DELETE FROM alert_rules WHERE id = ?').run(id);
  return result.changes > 0;
}

export function markAlertRuleEvaluation(input: MarkRuleEvaluationInput): void {
  if (input.triggeredAt) {
    getDB().prepare(`
      UPDATE alert_rules
      SET last_evaluated_at = ?, last_triggered_at = ?, updated_at = ?
      WHERE id = ?
    `).run(input.evaluatedAt, input.triggeredAt, input.evaluatedAt, input.id);
    return;
  }

  getDB().prepare(`
    UPDATE alert_rules
    SET last_evaluated_at = ?, updated_at = ?
    WHERE id = ?
  `).run(input.evaluatedAt, input.evaluatedAt, input.id);
}

export function createAlertNotificationHistory(input: CreateHistoryInput): AlertNotificationHistory {
  const id = randomUUID();
  const createdAt = new Date().toISOString();

  getDB().prepare(`
    INSERT INTO alert_notification_history (
      id,
      alert_rule_id,
      webhook_id,
      agent_id,
      status,
      error_message,
      payload,
      created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    input.alert_rule_id ?? null,
    input.webhook_id ?? null,
    input.agent_id ?? null,
    input.status,
    input.error_message ?? null,
    input.payload,
    createdAt,
  );

  return {
    id,
    alert_rule_id: input.alert_rule_id,
    webhook_id: input.webhook_id,
    agent_id: input.agent_id,
    status: input.status,
    error_message: input.error_message,
    payload: input.payload,
    created_at: createdAt,
  };
}

export function listAlertNotificationHistory(limit: number): AlertNotificationHistory[] {
  const rows = getDB()
    .prepare('SELECT * FROM alert_notification_history ORDER BY created_at DESC LIMIT ?')
    .all(limit) as AlertHistoryRow[];

  return rows.map((row) => ({
    id: row.id,
    alert_rule_id: row.alert_rule_id ?? undefined,
    webhook_id: row.webhook_id ?? undefined,
    agent_id: row.agent_id ?? undefined,
    status: row.status,
    error_message: row.error_message ?? undefined,
    payload: row.payload,
    created_at: row.created_at,
  }));
}

export function getAlertNotificationStats(): NotificationStatsRow {
  const row = getDB().prepare(`
    SELECT
      COUNT(*) as total,
      SUM(CASE WHEN created_at >= datetime('now', '-1 day') THEN 1 ELSE 0 END) as last24h,
      SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as success,
      SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed
    FROM alert_notification_history
  `).get() as NotificationStatsRow | undefined;

  return {
    total: row?.total ?? 0,
    last24h: row?.last24h ?? 0,
    success: row?.success ?? 0,
    failed: row?.failed ?? 0,
  };
}

export function createAlertMetricSnapshot(input: CreateSnapshotInput): AlertMetricSnapshot {
  const id = randomUUID();
  const createdAt = new Date().toISOString();

  getDB().prepare(`
    INSERT INTO alert_metric_snapshots (
      id,
      alert_rule_id,
      agent_id,
      metrics_json,
      window_start,
      window_end,
      created_at,
      expires_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    input.alert_rule_id,
    input.agent_id ?? null,
    input.metrics_json,
    input.window_start,
    input.window_end,
    createdAt,
    input.expires_at,
  );

  return {
    id,
    alert_rule_id: input.alert_rule_id,
    agent_id: input.agent_id,
    metrics_json: input.metrics_json,
    window_start: input.window_start,
    window_end: input.window_end,
    created_at: createdAt,
    expires_at: input.expires_at,
  };
}

export function deleteAlertMetricSnapshot(id: string): boolean {
  const result = getDB().prepare('DELETE FROM alert_metric_snapshots WHERE id = ?').run(id);
  return result.changes > 0;
}

export function pruneExpiredAlertMetricSnapshots(nowISO: string): number {
  const result = getDB().prepare('DELETE FROM alert_metric_snapshots WHERE expires_at <= ?').run(nowISO);
  return result.changes;
}

export function listAlertMetricSnapshots(): AlertMetricSnapshot[] {
  const rows = getDB().prepare('SELECT * FROM alert_metric_snapshots ORDER BY created_at DESC').all() as SnapshotRow[];
  return rows.map((row) => ({
    id: row.id,
    alert_rule_id: row.alert_rule_id,
    agent_id: row.agent_id ?? undefined,
    metrics_json: row.metrics_json,
    window_start: row.window_start,
    window_end: row.window_end,
    created_at: row.created_at,
    expires_at: row.expires_at,
  }));
}

export function getAlertThresholdBreached(ruleID: string, agentID: string): boolean {
  const row = getDB().prepare(`
    SELECT alert_rule_id, agent_id, breached, updated_at
    FROM alert_threshold_state
    WHERE alert_rule_id = ? AND agent_id = ?
  `).get(ruleID, agentID) as ThresholdStateRow | undefined;

  return row?.breached === 1;
}

interface UpsertThresholdStateInput {
  ruleID: string;
  agentID: string;
  breached: boolean;
  updatedAt?: string;
}

export function upsertAlertThresholdState(input: UpsertThresholdStateInput): void {
  const updatedAt = input.updatedAt ?? new Date().toISOString();

  getDB().prepare(`
    INSERT INTO alert_threshold_state (alert_rule_id, agent_id, breached, updated_at)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(alert_rule_id, agent_id) DO UPDATE SET
      breached = excluded.breached,
      updated_at = excluded.updated_at
  `).run(
    input.ruleID,
    input.agentID,
    input.breached ? 1 : 0,
    updatedAt,
  );
}
