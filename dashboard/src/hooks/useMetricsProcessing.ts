// Custom hook for client-side alert evaluation on metrics changes.
import { useEffect, useRef } from 'react'; // eslint-disable-line no-restricted-syntax
import { DashboardMetrics } from '@/utils/types';
import { useConfig } from '@/utils/contexts/ConfigContext';
import { evaluateAlerts } from '@/utils/alert-engine';
import { alertStore } from '@/utils/stores/alert-store';
import { webhookStore } from '@/utils/stores/webhook-store';
import { dispatchAlertNotifications } from '@/utils/notification-service';

interface UseMetricsProcessingOptions {
  enabled?: boolean;
  debounceMs?: number;
  agentUrl?: string;
  agentToken?: string;
}

/**
 * Hook to automatically evaluate alert rules against current metrics.
 * When thresholds are exceeded, dispatches notifications via the agent's /api/notify proxy.
 */
export function useMetricsProcessing(
  agentId: string | null,
  agentName: string | null,
  metrics: DashboardMetrics | null,
  _logs: unknown,
  options: UseMetricsProcessingOptions = {},
) {
  const { config } = useConfig();
  const defaultDebounceMs = Math.max(config.refreshIntervalMs, 10000);
  const {
    enabled = true,
    debounceMs = defaultDebounceMs,
    agentUrl = '',
    agentToken = '',
  } = options;
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastProcessedRef = useRef<string>('');

  // eslint-disable-next-line no-restricted-syntax
  useEffect(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    if (!enabled || !agentId || !agentName || !metrics) {
      return;
    }

    // Deduplicate — skip if metrics haven't changed
    const metricsHash = JSON.stringify({
      agentId,
      requestCount: metrics.requests?.total,
      errorRate: metrics.statusCodes?.errorRate,
      avgResponseTime: metrics.responseTime?.average,
    });

    if (metricsHash === lastProcessedRef.current) {
      return;
    }

    timeoutRef.current = setTimeout(async () => {
      try {
        const alertRules = alertStore.getAlertRules();
        const triggered = evaluateAlerts(metrics, alertRules);

        if (triggered.length > 0 && agentUrl) {
          for (const alert of triggered) {
            const ruleWebhooks = alert.rule.webhook_ids
              .map((id) => webhookStore.getWebhookById(id))
              .filter((w) => w !== null);

            await dispatchAlertNotifications(
              agentUrl,
              agentToken,
              alert.rule.id,
              ruleWebhooks,
              alert.rule.name,
              alert.message,
            );
          }
        }

        lastProcessedRef.current = metricsHash;
      } catch (error) {
        console.error('Failed to process metrics for alerts:', error);
      }
    }, debounceMs);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [agentId, agentName, metrics, enabled, debounceMs, agentUrl, agentToken]);
}
