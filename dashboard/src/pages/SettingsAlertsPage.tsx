import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Plus,
  Trash2,
  Edit,
  Bell,
  Webhook as WebhookIcon,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  TestTube,
  ChevronLeft,
} from 'lucide-react';
import { toast } from 'sonner';
import { Link } from '@tanstack/react-router';
import { Webhook, AlertRule } from '@/utils/types/alerting';
import WebhookFormModal from '@/components/WebhookFormModal';
import AlertRuleFormModal from '@/components/AlertRuleFormModal';
import { webhookStore } from '@/utils/stores/webhook-store';
import { alertStore } from '@/utils/stores/alert-store';
import { notificationStore } from '@/utils/stores/notification-store';
import { sendNotification } from '@/utils/notification-service';
import { useAgents } from '@/utils/contexts/AgentContext';

type TabType = 'webhooks' | 'alerts';

export default function AlertsSettingsPage() {
  const { agents, selectedAgent } = useAgents();
  const [activeTab, setActiveTab] = useState<TabType>('webhooks');
  const [webhooks, setWebhooks] = useState<Webhook[]>([]);
  const [alerts, setAlerts] = useState<AlertRule[]>([]);
  const [testingWebhook, setTestingWebhook] = useState<string | null>(null);
  const [testingAlert, setTestingAlert] = useState<string | null>(null);

  // Modal states
  const [showWebhookModal, setShowWebhookModal] = useState(false);
  const [showAlertModal, setShowAlertModal] = useState(false);
  const [editingWebhook, setEditingWebhook] = useState<Webhook | null>(null);
  const [editingAlert, setEditingAlert] = useState<AlertRule | null>(null);

  const [stats, setStats] = useState({ total: 0, last24h: 0, success: 0, failed: 0 });

  const loadData = useCallback(() => {
    setWebhooks(webhookStore.getWebhooks());
    setAlerts(alertStore.getAlertRules());
    setStats(notificationStore.getStats());
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Webhook handlers
  const handleAddWebhook = () => {
    setEditingWebhook(null);
    setShowWebhookModal(true);
  };

  const handleEditWebhook = (webhook: Webhook) => {
    setEditingWebhook(webhook);
    setShowWebhookModal(true);
  };

  const handleSaveWebhook = async (webhookData: Partial<Webhook>) => {
    if (editingWebhook) {
      webhookStore.updateWebhook(editingWebhook.id, webhookData);
      toast.success('Webhook updated');
    } else {
      webhookStore.addWebhook(webhookData as Omit<Webhook, 'id' | 'created_at' | 'updated_at'>);
      toast.success('Webhook created');
    }
    loadData();
  };

  const handleTestWebhook = async (webhookId: string) => {
    const webhook = webhookStore.getWebhookById(webhookId);
    if (!webhook) return;

    const agent = selectedAgent ?? agents[0];
    if (!agent) {
      toast.error('No agent configured to proxy notifications');
      return;
    }

    setTestingWebhook(webhookId);
    try {
      const result = await sendNotification(
        agent.url,
        agent.token,
        webhook,
        'Test Notification',
        'This is a test notification from Traefik Log Dashboard.',
      );

      if (result.success) {
        toast.success('Test notification sent successfully');
      } else {
        toast.error('Test failed: ' + result.error);
      }
    } catch {
      toast.error('Failed to test webhook');
    } finally {
      setTestingWebhook(null);
      loadData(); // refresh stats
    }
  };

  const handleToggleWebhook = (webhook: Webhook) => {
    webhookStore.updateWebhook(webhook.id, { enabled: !webhook.enabled });
    toast.success(`Webhook ${!webhook.enabled ? 'enabled' : 'disabled'}`);
    loadData();
  };

  const handleDeleteWebhook = (webhook: Webhook) => {
    if (!confirm(`Delete webhook "${webhook.name}"?`)) return;
    webhookStore.deleteWebhook(webhook.id);
    toast.success('Webhook deleted');
    loadData();
  };

  // Alert handlers
  const handleAddAlert = () => {
    setEditingAlert(null);
    setShowAlertModal(true);
  };

  const handleEditAlert = (alert: AlertRule) => {
    setEditingAlert(alert);
    setShowAlertModal(true);
  };

  const handleSaveAlert = async (alertData: Partial<AlertRule>) => {
    if (editingAlert) {
      alertStore.updateAlertRule(editingAlert.id, alertData);
      toast.success('Alert rule updated');
    } else {
      alertStore.addAlertRule(alertData as Omit<AlertRule, 'id' | 'created_at' | 'updated_at'>);
      toast.success('Alert rule created');
    }
    loadData();
  };

  const handleToggleAlert = (alert: AlertRule) => {
    alertStore.updateAlertRule(alert.id, { enabled: !alert.enabled });
    toast.success(`Alert ${!alert.enabled ? 'enabled' : 'disabled'}`);
    loadData();
  };

  const handleTestAlert = async (alert: AlertRule) => {
    setTestingAlert(alert.id);

    const agent = alert.agent_id
      ? agents.find((a) => a.id === alert.agent_id)
      : selectedAgent ?? agents[0];

    if (!agent) {
      toast.error('No agent available to test alert');
      setTestingAlert(null);
      return;
    }

    try {
      // Send test to each webhook
      const alertWebhooks = alert.webhook_ids
        .map((id) => webhookStore.getWebhookById(id))
        .filter((w): w is Webhook => w !== null && w.enabled);

      if (alertWebhooks.length === 0) {
        toast.error('No enabled webhooks configured for this alert');
        return;
      }

      const results = await Promise.allSettled(
        alertWebhooks.map((webhook) =>
          sendNotification(
            agent.url,
            agent.token,
            webhook,
            `[TEST] ${alert.name}`,
            `Test alert triggered for "${alert.name}"`,
          ),
        ),
      );

      const allOk = results.every(
        (r) => r.status === 'fulfilled' && r.value.success,
      );
      if (allOk) {
        toast.success('Test alert triggered successfully');
      } else {
        toast.error('Some notifications failed');
      }
    } catch {
      toast.error('Failed to test alert');
    } finally {
      setTestingAlert(null);
      loadData();
    }
  };

  const handleDeleteAlert = (alert: AlertRule) => {
    if (!confirm(`Delete alert rule "${alert.name}"?`)) return;
    alertStore.deleteAlertRule(alert.id);
    toast.success('Alert rule deleted');
    loadData();
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <Link
            to="/settings"
            className="p-2 hover:bg-accent rounded-lg transition-colors"
          >
            <ChevronLeft className="w-5 h-5 text-muted-foreground" />
          </Link>
          <div>
            <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
              <Bell className="w-8 h-8 text-red-600 dark:text-red-400" />
              Alert Configuration
            </h1>
            <p className="text-muted-foreground mt-1">
              Manage webhooks and alert rules for notifications
            </p>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-card p-4 rounded-lg border border-red-200 dark:border-red-800 shadow-sm">
            <div className="text-sm text-muted-foreground mb-1">Total Alerts</div>
            <div className="text-2xl font-bold text-foreground">{stats.total}</div>
          </div>
          <div className="bg-card p-4 rounded-lg border border-red-200 dark:border-red-800 shadow-sm">
            <div className="text-sm text-muted-foreground mb-1">Last 24 Hours</div>
            <div className="text-2xl font-bold text-foreground">{stats.last24h}</div>
          </div>
          <div className="bg-card p-4 rounded-lg border border-red-200 dark:border-red-800 shadow-sm">
            <div className="text-sm text-muted-foreground mb-1">Successful</div>
            <div className="text-2xl font-bold text-green-600 dark:text-green-400">{stats.success}</div>
          </div>
          <div className="bg-card p-4 rounded-lg border border-red-200 dark:border-red-800 shadow-sm">
            <div className="text-sm text-muted-foreground mb-1">Failed</div>
            <div className="text-2xl font-bold text-red-600 dark:text-red-400">{stats.failed}</div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-2 mb-6 border-b border-border">
          <button
            onClick={() => setActiveTab('webhooks')}
            className={`px-4 py-2 font-medium transition-colors ${
              activeTab === 'webhooks'
                ? 'text-red-600 dark:text-red-400 border-b-2 border-red-600 dark:border-red-400'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <div className="flex items-center gap-2">
              <WebhookIcon className="w-4 h-4" />
              Webhooks ({webhooks.length})
            </div>
          </button>
          <button
            onClick={() => setActiveTab('alerts')}
            className={`px-4 py-2 font-medium transition-colors ${
              activeTab === 'alerts'
                ? 'text-red-600 dark:text-red-400 border-b-2 border-red-600 dark:border-red-400'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              Alert Rules ({alerts.length})
            </div>
          </button>
        </div>

      {/* Webhooks Tab */}
      {activeTab === 'webhooks' && (
        <div>
          <div className="flex justify-between items-center mb-4">
            <p className="text-sm text-muted-foreground">
              Configure Discord and Telegram webhooks for notifications
            </p>
            <Button onClick={handleAddWebhook}>
              <Plus className="w-4 h-4 mr-2" />
              Add Webhook
            </Button>
          </div>

          {webhooks.length === 0 ? (
            <div className="text-center py-12 border-2 border-dashed border-red-200 dark:border-red-800 rounded-lg bg-card">
              <WebhookIcon className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium text-foreground mb-2">No webhooks configured</h3>
              <p className="text-muted-foreground mb-4">Add a webhook to start receiving notifications</p>
              <Button onClick={handleAddWebhook} className="bg-red-600 hover:bg-red-700">
                <Plus className="w-4 h-4 mr-2" />
                Add Your First Webhook
              </Button>
            </div>
          ) : (
            <div className="grid gap-4">
              {webhooks.map((webhook) => (
                <div
                  key={webhook.id}
                  className="border-2 border-red-200 dark:border-red-800 rounded-lg p-4 hover:border-red-500 dark:hover:border-red-600 transition-all bg-card hover:shadow-lg"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="font-semibold text-lg">{webhook.name}</h3>
                        <Badge variant={webhook.type === 'discord' ? 'default' : 'secondary'}>
                          {webhook.type}
                        </Badge>
                        {webhook.enabled ? (
                          <CheckCircle2 className="w-4 h-4 text-green-500 dark:text-green-400" />
                        ) : (
                          <XCircle className="w-4 h-4 text-muted-foreground" />
                        )}
                      </div>
                      {webhook.description && (
                        <p className="text-sm text-muted-foreground mb-2">{webhook.description}</p>
                      )}
                      <p className="text-xs text-muted-foreground font-mono truncate max-w-md">
                        {webhook.url}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleTestWebhook(webhook.id)}
                        disabled={testingWebhook === webhook.id}
                        title="Test webhook"
                      >
                        <TestTube className="w-4 h-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleToggleWebhook(webhook)}
                      >
                        {webhook.enabled ? 'Disable' : 'Enable'}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleEditWebhook(webhook)}
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => handleDeleteWebhook(webhook)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Alert Rules Tab */}
      {activeTab === 'alerts' && (
        <div>
          <div className="flex justify-between items-center mb-4">
            <p className="text-sm text-muted-foreground">
              Configure alert rules to trigger notifications based on metrics
            </p>
            <Button onClick={handleAddAlert}>
              <Plus className="w-4 h-4 mr-2" />
              Add Alert Rule
            </Button>
          </div>

          {alerts.length === 0 ? (
            <div className="text-center py-12 border-2 border-dashed border-red-200 dark:border-red-800 rounded-lg bg-card">
              <AlertTriangle className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium text-foreground mb-2">No alert rules configured</h3>
              <p className="text-muted-foreground mb-4">Create an alert rule to start monitoring your traffic</p>
              <Button onClick={handleAddAlert} className="bg-red-600 hover:bg-red-700">
                <Plus className="w-4 h-4 mr-2" />
                Create Your First Alert Rule
              </Button>
            </div>
          ) : (
            <div className="grid gap-4">
              {alerts.map((alert) => (
                <div
                  key={alert.id}
                  className="border-2 border-red-200 dark:border-red-800 rounded-lg p-4 hover:border-red-500 dark:hover:border-red-600 transition-all bg-card hover:shadow-lg"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="font-semibold text-lg">{alert.name}</h3>
                        <Badge>{alert.trigger_type}</Badge>
                        {alert.interval && <Badge variant="outline">{alert.interval}</Badge>}
                        {alert.enabled ? (
                          <CheckCircle2 className="w-4 h-4 text-green-500 dark:text-green-400" />
                        ) : (
                          <XCircle className="w-4 h-4 text-muted-foreground" />
                        )}
                      </div>
                      {alert.description && (
                        <p className="text-sm text-muted-foreground mb-2">{alert.description}</p>
                      )}
                      <div className="flex gap-2 text-xs text-muted-foreground">
                        <span>{alert.webhook_ids.length} webhook(s)</span>
                        <span>•</span>
                        <span>{alert.parameters.filter(p => p.enabled).length} parameter(s)</span>
                        {alert.agent_id && (
                          <>
                            <span>•</span>
                            <span>Agent: {alert.agent_id}</span>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleTestAlert(alert)}
                        disabled={testingAlert === alert.id || !alert.enabled}
                        title={!alert.enabled ? 'Enable alert to test' : 'Test alert'}
                      >
                        <TestTube className="w-4 h-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleToggleAlert(alert)}
                      >
                        {alert.enabled ? 'Disable' : 'Enable'}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleEditAlert(alert)}
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => handleDeleteAlert(alert)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Modals */}
      <WebhookFormModal
        isOpen={showWebhookModal}
        onClose={() => setShowWebhookModal(false)}
        onSave={handleSaveWebhook}
        webhook={editingWebhook}
      />

      <AlertRuleFormModal
        isOpen={showAlertModal}
        onClose={() => setShowAlertModal(false)}
        onSave={handleSaveAlert}
        alert={editingAlert}
        webhooks={webhooks}
        agents={agents}
      />
      </div>
    </div>
  );
}
