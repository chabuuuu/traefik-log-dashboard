// dashboard/lib/agent-import-export.ts

import { Agent } from './types/agent';
import { AgentConfigManager } from './agent-config-manager';

export interface AgentExportFormat {
  version: string;
  exportDate: string;
  agents: Array<Omit<Agent, 'status' | 'lastSeen'>>;
}

export class AgentImportExport {
  private static readonly EXPORT_VERSION = '1.0';

  /**
   * Export all agents to JSON format
   */
  static exportAgents(): AgentExportFormat {
    const agents = AgentConfigManager.getAgents();
    
    return {
      version: this.EXPORT_VERSION,
      exportDate: new Date().toISOString(),
      agents: agents.map(agent => ({
        id: agent.id,
        name: agent.name,
        url: agent.url,
        token: agent.token,
        location: agent.location,
        number: agent.number,
        description: agent.description,
        tags: agent.tags,
      })),
    };
  }

  /**
   * Export agents and download as JSON file
   */
  static downloadAgentConfig(filename: string = 'traefik-agents-config.json'): void {
    const config = this.exportAgents();
    const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  /**
   * Import agents from JSON format
   */
  static importAgents(
    config: AgentExportFormat,
    options: {
      mergeMode: 'replace' | 'merge' | 'skip-existing';
      validateTokens?: boolean;
    } = { mergeMode: 'merge' }
  ): { success: boolean; imported: number; skipped: number; errors: string[] } {
    const errors: string[] = [];
    let imported = 0;
    let skipped = 0;

    // Validate version
    if (config.version !== this.EXPORT_VERSION) {
      errors.push(`Unsupported config version: ${config.version}`);
      return { success: false, imported, skipped, errors };
    }

    const existingAgents = AgentConfigManager.getAgents();
    let agentsToSave = [...existingAgents];

    // Handle replace mode
    if (options.mergeMode === 'replace') {
      agentsToSave = [];
    }

    // Process each agent in import
    for (const importAgent of config.agents) {
      // Validate agent
      const validation = AgentConfigManager.validateAgent(importAgent);
      if (!validation.valid) {
        errors.push(`Agent ${importAgent.name}: ${validation.errors.join(', ')}`);
        skipped++;
        continue;
      }

      const existingIndex = agentsToSave.findIndex(a => a.id === importAgent.id);

      if (existingIndex !== -1) {
        if (options.mergeMode === 'skip-existing') {
          skipped++;
          continue;
        }
        // Update existing agent
        agentsToSave[existingIndex] = {
          ...agentsToSave[existingIndex],
          ...importAgent,
          status: 'checking',
        };
        imported++;
      } else {
        // Add new agent
        agentsToSave.push({
          ...importAgent,
          status: 'checking',
        });
        imported++;
      }
    }

    // Save agents
    AgentConfigManager.saveAgents(agentsToSave);

    return {
      success: errors.length === 0,
      imported,
      skipped,
      errors,
    };
  }

  /**
   * Import agents from uploaded file
   */
  static async importFromFile(
    file: File,
    options: {
      mergeMode: 'replace' | 'merge' | 'skip-existing';
    } = { mergeMode: 'merge' }
  ): Promise<{ success: boolean; imported: number; skipped: number; errors: string[] }> {
    try {
      const text = await file.text();
      const config: AgentExportFormat = JSON.parse(text);
      return this.importAgents(config, options);
    } catch (error) {
      return {
        success: false,
        imported: 0,
        skipped: 0,
        errors: [error instanceof Error ? error.message : 'Failed to parse file'],
      };
    }
  }

  /**
   * Export agents to clipboard
   */
  static async copyToClipboard(): Promise<boolean> {
    try {
      const config = this.exportAgents();
      await navigator.clipboard.writeText(JSON.stringify(config, null, 2));
      return true;
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
      return false;
    }
  }

  /**
   * Import agents from clipboard
   */
  static async importFromClipboard(
    options: {
      mergeMode: 'replace' | 'merge' | 'skip-existing';
    } = { mergeMode: 'merge' }
  ): Promise<{ success: boolean; imported: number; skipped: number; errors: string[] }> {
    try {
      const text = await navigator.clipboard.readText();
      const config: AgentExportFormat = JSON.parse(text);
      return this.importAgents(config, options);
    } catch (error) {
      return {
        success: false,
        imported: 0,
        skipped: 0,
        errors: [error instanceof Error ? error.message : 'Failed to read from clipboard'],
      };
    }
  }

  /**
   * Create backup of current configuration
   */
  static createBackup(): void {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    this.downloadAgentConfig(`traefik-agents-backup-${timestamp}.json`);
  }

  /**
   * Validate import file before importing
   */
  static async validateImportFile(file: File): Promise<{ valid: boolean; errors: string[] }> {
    const errors: string[] = [];

    try {
      const text = await file.text();
      const config: AgentExportFormat = JSON.parse(text);

      if (!config.version) {
        errors.push('Missing version field');
      }

      if (!Array.isArray(config.agents)) {
        errors.push('Invalid agents array');
      } else {
        config.agents.forEach((agent, index) => {
          const validation = AgentConfigManager.validateAgent(agent);
          if (!validation.valid) {
            errors.push(`Agent ${index + 1}: ${validation.errors.join(', ')}`);
          }
        });
      }
    } catch (error) {
      errors.push(error instanceof Error ? error.message : 'Failed to parse file');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}