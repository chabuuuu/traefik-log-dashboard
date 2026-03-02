'use client';

import React, { createContext, useContext, useState, useCallback, useEffect, useMemo } from 'react';
import { Agent } from '../types/agent';
import { toast } from 'sonner';
import { agentStore } from '../stores/agent-store';

interface AgentContextType {
  agents: Agent[];
  selectedAgent: Agent | null;
  selectAgent: (id: string) => void;
  addAgent: (agent: Omit<Agent, 'id' | 'number'>) => Agent;
  updateAgent: (id: string, updates: Partial<Agent>) => void;
  deleteAgent: (id: string) => void;
  refreshAgents: () => void;
  checkAgentStatus: (id: string) => Promise<boolean>;
}

const AgentContext = createContext<AgentContextType | undefined>(undefined);

export function AgentProvider({ children }: { children: React.ReactNode }) {
  const [agents, setAgents] = useState<Agent[]>(() => agentStore.getAgents());
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(() => agentStore.getSelectedAgent());

  // Sync from localStorage on mount
  useEffect(() => {
    setAgents(agentStore.getAgents());
    setSelectedAgent(agentStore.getSelectedAgent());
  }, []);

  const refreshAgents = useCallback(() => {
    setAgents(agentStore.getAgents());
    setSelectedAgent(agentStore.getSelectedAgent());
  }, []);

  const selectAgent = useCallback((id: string) => {
    agentStore.setSelectedAgentId(id);
    const agent = agentStore.getAgentById(id);
    setSelectedAgent(agent);
    if (agent) {
      toast.success('Agent selected', { description: `Switched to ${agent.name}` });
    }
  }, []);

  const addAgent = useCallback((agent: Omit<Agent, 'id' | 'number'>): Agent => {
    const newAgent = agentStore.addAgent(agent);
    setAgents(agentStore.getAgents());
    toast.success('Agent added successfully');
    return newAgent;
  }, []);

  const updateAgent = useCallback((id: string, updates: Partial<Agent>) => {
    agentStore.updateAgent(id, updates);
    const updated = agentStore.getAgents();
    setAgents(updated);

    if (selectedAgent?.id === id) {
      setSelectedAgent(agentStore.getAgentById(id));
    }

    // Only show toast for manual updates, not status checks
    if (!updates.status) {
      toast.success('Agent updated successfully');
    }
  }, [selectedAgent]);

  const deleteAgent = useCallback((id: string) => {
    agentStore.deleteAgent(id);
    const remaining = agentStore.getAgents();
    setAgents(remaining);

    if (selectedAgent?.id === id) {
      const next = remaining[0] ?? null;
      setSelectedAgent(next);
      if (next) {
        agentStore.setSelectedAgentId(next.id);
      }
    }

    toast.success('Agent deleted successfully');
  }, [selectedAgent]);

  const checkAgentStatus = useCallback(async (id: string): Promise<boolean> => {
    const agent = agentStore.getAgentById(id);
    if (!agent) {
      console.warn(`Agent ${id} not found for status check`);
      return false;
    }

    // Update to checking
    agentStore.updateAgent(id, { status: 'checking' });
    setAgents(agentStore.getAgents());

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      try {
        // Directly check the agent's status endpoint
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (agent.token) {
          headers['Authorization'] = `Bearer ${agent.token}`;
        }

        const response = await fetch(`${agent.url}/api/logs/status`, {
          headers,
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        const isOnline = response.ok;

        agentStore.updateAgent(id, {
          status: isOnline ? 'online' : 'offline',
          lastSeen: isOnline ? new Date() : undefined,
        });
        setAgents(agentStore.getAgents());

        return isOnline;
      } catch (fetchError) {
        clearTimeout(timeoutId);
        throw fetchError;
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        console.warn(`Agent ${id} status check timeout`);
      } else {
        console.error(`Agent ${id} status check failed:`, error);
      }

      agentStore.updateAgent(id, { status: 'offline' });
      setAgents(agentStore.getAgents());

      return false;
    }
  }, []);

  const contextValue = useMemo(
    () => ({
      agents,
      selectedAgent,
      selectAgent,
      addAgent,
      updateAgent,
      deleteAgent,
      refreshAgents,
      checkAgentStatus,
    }),
    [agents, selectedAgent, selectAgent, addAgent, updateAgent, deleteAgent, refreshAgents, checkAgentStatus],
  );

  return (
    <AgentContext.Provider value={contextValue}>
      {children}
    </AgentContext.Provider>
  );
}

export function useAgents() {
  const context = useContext(AgentContext);
  if (!context) {
    throw new Error('useAgents must be used within an AgentProvider');
  }
  return context;
}
