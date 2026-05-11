export type AlertWebhookType = 'discord' | 'telegram' | 'webhook';

export interface AlertWebhook {
  id: string;
  name: string;
  type: AlertWebhookType;
  url: string;
  enabled: boolean;
  description?: string;
  created_at: string;
  updated_at: string;
}

export type AlertTriggerType = 'interval' | 'threshold' | 'daily_summary';
export type AlertConditionOperator = 'any' | 'all';

export type AlertInterval = '5m' | '15m' | '30m' | '1h' | '6h' | '12h' | '24h';

export type AlertParameter =
  | 'top_ips'
  | 'top_locations'
  | 'top_routes'
  | 'top_status_codes'
  | 'top_user_agents'
  | 'top_routers'
  | 'top_services'
  | 'top_hosts'
  | 'error_rate'
  | 'response_time'
  | 'request_count'
  | 'request_rate'
  | 'parser_unknown_ratio'
  | 'parser_error_ratio'
  | 'top_request_addresses'
  | 'top_client_ips';

export interface AlertParameterConfig {
  parameter: AlertParameter;
  enabled: boolean;
  limit?: number;
  threshold?: number;
}

export interface AlertRule {
  id: string;
  name: string;
  description?: string;
  enabled: boolean;
  agent_id?: string;
  webhook_ids: string[];
  trigger_type: AlertTriggerType;
  interval?: AlertInterval;
  schedule_time_utc?: string;
  snapshot_window_minutes: number;
  condition_operator: AlertConditionOperator;
  parameters: AlertParameterConfig[];
  ping_urls?: string[];
  last_triggered_at?: string;
  last_evaluated_at?: string;
  created_at: string;
  updated_at: string;
}

export interface AlertNotificationHistory {
  id: string;
  alert_rule_id?: string;
  webhook_id?: string;
  agent_id?: string;
  status: 'success' | 'failed';
  error_message?: string;
  payload: string;
  created_at: string;
}

export interface AlertMetricSnapshot {
  id: string;
  alert_rule_id: string;
  agent_id?: string;
  metrics_json: string;
  window_start: string;
  window_end: string;
  created_at: string;
  expires_at: string;
}

export interface AggregatedAlertMetrics {
  request_count?: number;
  request_rate?: number;
  error_rate?: number;
  parser_unknown_ratio?: number;
  parser_error_ratio?: number;
  response_time?: {
    average: number;
    p95: number;
    p99: number;
  };
  top_ips?: Array<{ ip: string; count: number }>;
  top_client_ips?: Array<{ ip: string; count: number }>;
  top_locations?: Array<{ country: string; city?: string; count: number }>;
  top_routes?: Array<{ path: string; count: number; avgDuration: number }>;
  top_status_codes?: Array<{ status: number; count: number }>;
  top_user_agents?: Array<{ browser: string; count: number }>;
  top_routers?: Array<{ name: string; requests: number }>;
  top_services?: Array<{ name: string; requests: number }>;
  top_hosts?: Array<{ host: string; count: number }>;
  top_request_addresses?: Array<{ addr: string; count: number }>;
  ping_results?: string[];
}

export interface ParserMetricsSnapshot {
  json?: number;
  traefik_clf?: number;
  generic_clf?: number;
  unknown?: number;
  errors?: number;
}

export interface AgentLogRecord {
  ClientHost?: string;
  DownstreamStatus?: number;
  Duration?: number;
  RequestAddr?: string;
  RequestPath?: string;
  RequestUserAgent?: string;
  RouterName?: string;
  ServiceName?: string;
  RequestHost?: string;
  StartUTC?: string;
  StartLocal?: string;
  geoCountry?: string;
  geoCity?: string;
}
