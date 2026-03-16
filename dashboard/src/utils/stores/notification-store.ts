// Client-side notification history store backed by localStorage.

import { NotificationHistory } from '../types/alerting';
import { createLocalStore } from './local-store';

const MAX_ENTRIES = 500;

const store = createLocalStore<NotificationHistory>('tld-notifications');

export const notificationStore = {
  getHistory(): NotificationHistory[] {
    return store.getAll().sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    );
  },

  addEntry(
    entry: Omit<NotificationHistory, 'id' | 'created_at'>,
  ): NotificationHistory {
    const record: NotificationHistory = {
      ...entry,
      id: `notif-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      created_at: new Date().toISOString(),
    };
    store.add(record);

    // Prune if over limit
    const all = store.getAll();
    if (all.length > MAX_ENTRIES) {
      const sorted = all.sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      );
      store.setAll(sorted.slice(0, MAX_ENTRIES));
    }

    return record;
  },

  clearHistory(): void {
    store.clear();
  },

  getStats() {
    const all = store.getAll();
    const now = Date.now();
    const dayAgo = now - 24 * 60 * 60 * 1000;

    const last24h = all.filter((n) => new Date(n.created_at).getTime() > dayAgo);

    return {
      total: all.length,
      last24h: last24h.length,
      success: all.filter((n) => n.status === 'success').length,
      failed: all.filter((n) => n.status === 'failed').length,
    };
  },
};
