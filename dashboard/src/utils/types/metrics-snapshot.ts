// Metric Snapshot Types
// Represents a snapshot of metrics calculated for a specific time window

import { AlertInterval } from './alerting';

/**
 * Time-windowed metrics snapshot
 * Contains metrics calculated ONLY from logs within a specific time range
 */
export interface MetricSnapshot {
  id: string;
  agent_id: string;
  agent_name: string;
  timestamp: string; // ISO timestamp when snapshot was created
  window_start: string; // Start of time window (ISO timestamp)
  window_end: string; // End of time window (ISO timestamp)
  interval: AlertInterval; // Which interval this snapshot represents
  log_count: number; // Number of logs in this window
  metrics: SnapshotMetrics;
}

/**
 * Metrics calculated for a specific time window
 */
export interface SnapshotMetrics {
  // Request metrics
  request_count: number;
  error_rate: number;

  // Response time metrics
  response_time?: {
    average: number;
    p95: number;
    p99: number;
    min: number;
    max: number;
  };

  // Status code distribution
  status_codes?: {
    status2xx: number;
    status3xx: number;
    status4xx: number;
    status5xx: number;
  };

  // Top N lists (configurable limit)
  top_ips?: Array<{ ip: string; count: number }>;
  top_locations?: Array<{ country: string; city: string; count: number }>;
  top_routes?: Array<{ path: string; count: number; avgDuration: number }>;
  top_user_agents?: Array<{ browser: string; count: number }>;
  top_routers?: Array<{ name: string; requests: number }>;
  top_services?: Array<{ name: string; requests: number }>;
  top_hosts?: Array<{ host: string; count: number }>;
  top_request_addresses?: Array<{ addr: string; count: number }>;
  top_client_ips?: Array<{ ip: string; count: number }>;
}

/**
 * Snapshot creation options
 */
export interface SnapshotOptions {
  interval: AlertInterval;
  topLimit?: number; // Limit for top N lists (default: 10)
  includeGeoData?: boolean; // Whether to include geo location data (default: false)
}

/**
 * Stored snapshot in database
 */
export interface StoredSnapshot {
  id: string;
  agent_id: string;
  agent_name: string;
  timestamp: string;
  window_start: string;
  window_end: string;
  interval: AlertInterval;
  log_count: number;
  metrics: string; // JSON stringified SnapshotMetrics
  created_at: string;
}
