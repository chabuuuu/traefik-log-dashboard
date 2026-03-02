// Client-side notification dispatcher.
// POSTs to the agent's /api/notify proxy endpoint (which forwards to Discord/Telegram).

import { Webhook } from './types/alerting';
import { notificationStore } from './stores/notification-store';

interface NotifyPayload {
  type: 'discord' | 'telegram';
  url: string;
  title: string;
  message: string;
}

/**
 * Send a notification through the agent's /api/notify proxy.
 * @param agentUrl  The base URL of the agent (e.g. "http://localhost:5000")
 * @param agentToken  The auth token for the agent
 * @param webhook  The webhook to notify
 * @param title  Notification title
 * @param message  Notification body
 */
export async function sendNotification(
  agentUrl: string,
  agentToken: string,
  webhook: Webhook,
  title: string,
  message: string,
): Promise<{ success: boolean; error?: string }> {
  const payload: NotifyPayload = {
    type: webhook.type,
    url: webhook.url,
    title,
    message,
  };

  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (agentToken) {
      headers['Authorization'] = `Bearer ${agentToken}`;
    }

    const resp = await fetch(`${agentUrl}/api/notify`, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });

    const data = await resp.json();

    // Record in notification history
    notificationStore.addEntry({
      alert_rule_id: '',
      webhook_id: webhook.id,
      status: data.success ? 'success' : 'failed',
      error_message: data.error,
      payload: JSON.stringify(payload),
    });

    return data;
  } catch (err) {
    const error = err instanceof Error ? err.message : 'Unknown error';

    notificationStore.addEntry({
      alert_rule_id: '',
      webhook_id: webhook.id,
      status: 'failed',
      error_message: error,
      payload: JSON.stringify(payload),
    });

    return { success: false, error };
  }
}

/**
 * Dispatch notifications for a triggered alert to all associated webhooks.
 */
export async function dispatchAlertNotifications(
  agentUrl: string,
  agentToken: string,
  alertRuleId: string,
  webhooks: Webhook[],
  title: string,
  message: string,
): Promise<void> {
  const enabledWebhooks = webhooks.filter((w) => w.enabled);

  await Promise.allSettled(
    enabledWebhooks.map(async (webhook) => {
      const result = await sendNotification(agentUrl, agentToken, webhook, title, message);

      // Update the history entry with the alert rule ID
      const history = notificationStore.getHistory();
      const latest = history.find((h) => h.webhook_id === webhook.id);
      if (latest) {
        notificationStore.addEntry({
          alert_rule_id: alertRuleId,
          webhook_id: webhook.id,
          status: result.success ? 'success' : 'failed',
          error_message: result.error,
          payload: JSON.stringify({ type: webhook.type, title, message }),
        });
      }
    }),
  );
}
