// Client-side webhook store backed by localStorage.

import { Webhook } from '../types/alerting';
import { createLocalStore } from './local-store';

const store = createLocalStore<Webhook>('tld-webhooks');

export const webhookStore = {
  getWebhooks: store.getAll,

  addWebhook(webhook: Omit<Webhook, 'id' | 'created_at' | 'updated_at'>): Webhook {
    const now = new Date().toISOString();
    const newWebhook: Webhook = {
      ...webhook,
      id: `wh-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      created_at: now,
      updated_at: now,
    };
    store.add(newWebhook);
    return newWebhook;
  },

  updateWebhook(id: string, updates: Partial<Webhook>): Webhook | null {
    return store.update(id, { ...updates, updated_at: new Date().toISOString() });
  },

  deleteWebhook(id: string): void {
    store.remove(id);
  },

  getWebhookById: store.getById,
};
