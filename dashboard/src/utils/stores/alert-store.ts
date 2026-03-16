// Client-side alert rule store backed by localStorage.

import { AlertRule } from '../types/alerting';
import { createLocalStore } from './local-store';

const store = createLocalStore<AlertRule>('tld-alerts');

export const alertStore = {
  getAlertRules: store.getAll,

  addAlertRule(
    rule: Omit<AlertRule, 'id' | 'created_at' | 'updated_at'>,
  ): AlertRule {
    const now = new Date().toISOString();
    const newRule: AlertRule = {
      ...rule,
      id: `alert-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      created_at: now,
      updated_at: now,
    };
    store.add(newRule);
    return newRule;
  },

  updateAlertRule(id: string, updates: Partial<AlertRule>): AlertRule | null {
    return store.update(id, { ...updates, updated_at: new Date().toISOString() });
  },

  deleteAlertRule(id: string): void {
    store.remove(id);
  },

  getAlertRuleById: store.getById,
};
