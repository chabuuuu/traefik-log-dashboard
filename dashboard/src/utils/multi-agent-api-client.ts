// dashboard/lib/multi-agent-api-client.ts

import { Agent } from './types/agent';
import { 
  LogsResponse, 
  SystemStats, 
  LogSizesResponse, 
  StatusResponse 
} from './types';

export class MultiAgentAPIClient {
  private agent: Agent;

  constructor(agent: Agent) {
    this.agent = agent;
  }

  private async fetch<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Authorization': `Bearer ${this.agent.token}`,
      ...(options.headers as Record<string, string> || {}),
    };

    const url = `${this.agent.url}${endpoint}`;

    try {
      const response = await fetch(url, {
        ...options,
        headers,
        cache: 'no-store',
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Agent ${this.agent.name} (${this.agent.id}) error: ${response.status} - ${errorText}`);
      }

      return await response.json();
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to connect to agent ${this.agent.name} (${this.agent.id}): ${error.message}`);
      }
      throw error;
    }
  }

  async getStatus(): Promise<StatusResponse> {
    return this.fetch<StatusResponse>('/api/logs/status');
  }

  async getAccessLogs(limit?: number): Promise<LogsResponse> {
    const params = new URLSearchParams();
    if (limit) params.append('limit', limit.toString());
    
    return this.fetch<LogsResponse>(`/api/logs/access${params.toString() ? `?${params}` : ''}`);
  }

  async getErrorLogs(limit?: number): Promise<LogsResponse> {
    const params = new URLSearchParams();
    if (limit) params.append('limit', limit.toString());
    
    return this.fetch<LogsResponse>(`/api/logs/error${params.toString() ? `?${params}` : ''}`);
  }

  async getSystemStats(): Promise<SystemStats> {
    return this.fetch<SystemStats>('/api/system/resources');
  }

  async getLogSizes(): Promise<LogSizesResponse> {
    return this.fetch<LogSizesResponse>('/api/logs/get');
  }

  getAgent(): Agent {
    return this.agent;
  }

  getAgentId(): string {
    return this.agent.id;
  }

  getAgentName(): string {
    return this.agent.name;
  }

  getAgentNumber(): number {
    return this.agent.number;
  }
}

/**
 * Create an API client for a specific agent
 */
export function createAgentClient(agent: Agent): MultiAgentAPIClient {
  return new MultiAgentAPIClient(agent);
}