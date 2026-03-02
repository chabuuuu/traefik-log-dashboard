// Webhook and Alerting Types

export type WebhookType = 'discord' | 'telegram';

export interface Webhook {
  id: string;
  name: string;
  type: WebhookType;
  url: string;
  enabled: boolean;
  description?: string;
  created_at: string;
  updated_at: string;
}

export type WebhookUpdate = Partial<Omit<Webhook, 'id' | 'created_at' | 'updated_at'>>;

// Alert notification parameters
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
  | 'top_request_addresses'
  | 'top_client_ips';

export interface AlertParameterConfig {
  parameter: AlertParameter;
  enabled: boolean;
  limit?: number; // For "top N" parameters
  threshold?: number; // For numeric parameters (error_rate, response_time, etc.)
}

export type AlertTriggerType =
  | 'interval' // Periodic alerts at fixed intervals
  | 'threshold' // Trigger when a metric crosses a threshold
  | 'event'; // Trigger on specific events

export type AlertInterval = '5m' | '15m' | '30m' | '1h' | '6h' | '12h' | '24h';

export interface AlertRule {
  id: string;
  name: string;
  description?: string;
  enabled: boolean;
  agent_id?: string; // Optional: specific agent, null = all agents
  webhook_ids: string[]; // Multiple webhooks can be notified
  trigger_type: AlertTriggerType;
  interval?: AlertInterval; // For interval-based alerts
  parameters: AlertParameterConfig[]; // Which metrics to include in notification
  created_at: string;
  updated_at: string;
}

export type AlertRuleUpdate = Partial<Omit<AlertRule, 'id' | 'created_at' | 'updated_at'>>;

export interface NotificationHistory {
  id: string;
  alert_rule_id: string;
  webhook_id: string;
  agent_id?: string;
  status: 'success' | 'failed';
  error_message?: string;
  payload: string; // JSON string of what was sent
  created_at: string;
}

// Discord Embed Types
export interface DiscordEmbed {
  title?: string;
  description?: string;
  color?: number; // Decimal color code
  fields?: DiscordEmbedField[];
  timestamp?: string;
  footer?: {
    text: string;
    icon_url?: string;
  };
  author?: {
    name: string;
    icon_url?: string;
  };
}

export interface DiscordEmbedField {
  name: string;
  value: string;
  inline?: boolean;
}

export interface DiscordWebhookPayload {
  username?: string;
  avatar_url?: string;
  content?: string;
  embeds?: DiscordEmbed[];
}

// Telegram Message Types
export interface TelegramWebhookPayload {
  text: string;
  parse_mode?: 'Markdown' | 'HTML';
  disable_web_page_preview?: boolean;
}

// Alert Data Types
export interface AlertData {
  timestamp: string;
  agent_name?: string;
  agent_id?: string;
  metrics: {
    top_ips?: Array<{ ip: string; count: number }>;
    top_locations?: Array<{ country: string; city?: string; count: number }>;
    top_routes?: Array<{ path: string; count: number; avgDuration: number }>;
    top_status_codes?: Array<{ status: number; count: number }>;
    top_user_agents?: Array<{ browser: string; count: number }>;
    top_routers?: Array<{ name: string; requests: number }>;
    top_services?: Array<{ name: string; requests: number }>;
    top_hosts?: Array<{ host: string; count: number }>;
    top_request_addresses?: Array<{ addr: string; count: number }>;
    top_client_ips?: Array<{ ip: string; count: number }>;
    error_rate?: number;
    response_time?: {
      average: number;
      p95: number;
      p99: number;
    };
    request_count?: number;
  };
}
