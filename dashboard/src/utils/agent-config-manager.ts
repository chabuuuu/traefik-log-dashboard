// dashboard/lib/agent-config-manager.ts

import { Agent } from './types/agent';
import { getRuntimeConfig } from './config/runtime-config';

/**
 * Agent Configuration Manager
 * Handles storage and retrieval of multiple agent configurations
 */
export class AgentConfigManager {
  private static STORAGE_KEY = 'tld-agents';
  private static SELECTED_AGENT_KEY = 'tld-selected-agent';

  /**
   * Load all agents from localStorage
   */
  static getAgents(): Agent[] {
    if (typeof window === 'undefined') return [];
    
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (!stored) return this.getDefaultAgents();
      
      const agents: Agent[] = JSON.parse(stored);
      return agents.map(agent => ({
        ...agent,
        lastSeen: agent.lastSeen ? new Date(agent.lastSeen) : undefined,
      }));
    } catch (error) {
      console.error('Failed to load agents:', error);
      return this.getDefaultAgents();
    }
  }

  /**
   * Get default agents from runtime configuration
   * Falls back to same-origin so API calls can be proxied by the dashboard host.
   */
  private static getDefaultAgents(): Agent[] {
    const runtime = getRuntimeConfig();
    const sameOrigin =
      typeof window !== 'undefined' && window.location?.origin
        ? window.location.origin
        : 'http://localhost:5000';
    const defaultAgent: Agent = {
      id: 'agent-001',
      name: 'Default Agent',
      url: runtime.defaultAgentUrl || sameOrigin,
      token: runtime.defaultAgentToken || '',
      location: 'on-site',
      number: 1,
      status: 'checking',
    };

    return [defaultAgent];
  }

  /**
   * Save agents to localStorage
   */
  static saveAgents(agents: Agent[]): void {
    if (typeof window === 'undefined') return;
    
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(agents));
    } catch (error) {
      console.error('Failed to save agents:', error);
    }
  }

  /**
   * Add a new agent
   */
  static addAgent(agent: Omit<Agent, 'id' | 'number'>): Agent {
    const agents = this.getAgents();
    const nextNumber = Math.max(0, ...agents.map(a => a.number)) + 1;
    
    const newAgent: Agent = {
      ...agent,
      id: `agent-${String(nextNumber).padStart(3, '0')}`,
      number: nextNumber,
      status: 'checking',
    };

    agents.push(newAgent);
    this.saveAgents(agents);
    
    return newAgent;
  }

  /**
   * Update an existing agent
   */
  static updateAgent(id: string, updates: Partial<Agent>): void {
    const agents = this.getAgents();
    const index = agents.findIndex(a => a.id === id);
    
    if (index !== -1) {
      agents[index] = { ...agents[index], ...updates };
      this.saveAgents(agents);
    }
  }

  /**
   * Delete an agent
   */
  static deleteAgent(id: string): void {
    const agents = this.getAgents().filter(a => a.id !== id);
    this.saveAgents(agents);
    
    // If deleted agent was selected, select the first available agent
    if (this.getSelectedAgentId() === id) {
      this.setSelectedAgentId(agents[0]?.id || null);
    }
  }

  /**
   * Get the currently selected agent ID
   */
  static getSelectedAgentId(): string | null {
    if (typeof window === 'undefined') return null;
    
    return localStorage.getItem(this.SELECTED_AGENT_KEY);
  }

  /**
   * Set the currently selected agent ID
   */
  static setSelectedAgentId(id: string | null): void {
    if (typeof window === 'undefined') return;
    
    if (id) {
      localStorage.setItem(this.SELECTED_AGENT_KEY, id);
    } else {
      localStorage.removeItem(this.SELECTED_AGENT_KEY);
    }
  }

  /**
   * Get the currently selected agent
   */
  static getSelectedAgent(): Agent | null {
    const selectedId = this.getSelectedAgentId();
    if (!selectedId) {
      const agents = this.getAgents();
      return agents[0] || null;
    }
    
    const agents = this.getAgents();
    return agents.find(a => a.id === selectedId) || agents[0] || null;
  }

  /**
   * Update agent status
   */
  static updateAgentStatus(id: string, online: boolean, _error?: string): void {
    this.updateAgent(id, {
      status: online ? 'online' : 'offline',
      lastSeen: online ? new Date() : undefined,
    });
  }

  /**
   * Get agent by ID
   */
  static getAgentById(id: string): Agent | null {
    const agents = this.getAgents();
    return agents.find(a => a.id === id) || null;
  }

  /**
   * Validate agent configuration
   */
  static validateAgent(agent: Partial<Agent>): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!agent.name?.trim()) {
      errors.push('Agent name is required');
    }

    if (!agent.url?.trim()) {
      errors.push('Agent address is required');
    } else {
      const trimmed = agent.url.trim();
      // Accept: full URLs, host:port, IP:port, container-name:port
      const hasProtocol = /^https?:\/\//i.test(trimmed);
      if (hasProtocol) {
        try {
          new URL(trimmed);
        } catch {
          errors.push('Agent address is not a valid URL');
        }
      } else {
        // Bare address: must have at least a hostname or IP
        const addressPattern = /^[a-zA-Z0-9._-]+(:\d+)?(\/.*)?$/;
        if (!addressPattern.test(trimmed)) {
          errors.push('Agent address is invalid. Use host:port, IP:port, or a full URL');
        }
      }
    }

    if (!agent.token?.trim()) {
      errors.push('Authentication token is required');
    }

    if (!agent.location || !['on-site', 'off-site'].includes(agent.location)) {
      errors.push('Location must be either "on-site" or "off-site"');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}
