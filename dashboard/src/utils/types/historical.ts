// Historical Data Storage Types

export interface HistoricalConfig {
  enabled: boolean;
  retention_days: number; // How long to keep historical data
  archive_interval: number; // How often to archive data (in minutes)
  db_path?: string; // Custom database path
  created_at: string;
  updated_at: string;
}

export interface HistoricalDataEntry {
  id: string;
  agent_id: string;
  timestamp: string;
  // Metrics snapshot
  total_requests: number;
  error_rate: number;
  avg_response_time: number;
  p95_response_time: number;
  p99_response_time: number;
  status_2xx: number;
  status_3xx: number;
  status_4xx: number;
  status_5xx: number;
  // Top metrics (stored as JSON)
  top_ips: string; // JSON array
  top_locations: string; // JSON array
  top_routes: string; // JSON array
  top_status_codes: string; // JSON array
  top_routers: string; // JSON array
  top_services: string; // JSON array
  created_at: string;
}

export interface HistoricalDataQuery {
  agent_id?: string;
  start_date?: string;
  end_date?: string;
  limit?: number;
  offset?: number;
}

export interface HistoricalMetrics {
  timestamp: string;
  total_requests: number;
  error_rate: number;
  avg_response_time: number;
  p95_response_time: number;
  p99_response_time: number;
  status_2xx: number;
  status_3xx: number;
  status_4xx: number;
  status_5xx: number;
  top_ips?: Array<{ ip: string; count: number }>;
  top_locations?: Array<{ country: string; city?: string; count: number }>;
  top_routes?: Array<{ path: string; count: number; avgDuration: number }>;
  top_status_codes?: Array<{ status: number; count: number }>;
  top_routers?: Array<{ name: string; requests: number }>;
  top_services?: Array<{ name: string; requests: number }>;
}
