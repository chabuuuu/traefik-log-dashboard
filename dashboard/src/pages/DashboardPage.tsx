import { ServerOff, Loader2, History, Database } from 'lucide-react';
import { useNavigate } from '@tanstack/react-router';
import { Button } from '@/components/ui/button';
import { useLogContext } from '@/utils/contexts/LogContext';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { DashboardShell } from '@/components/layout/DashboardShell';
import DashboardWithFilters from '@/components/dashboard/DashboardWithFilters';
import { useFilters } from '@/utils/contexts/FilterContext';

export default function DashboardPage() {
  const navigate = useNavigate();
  const { settings, updateSettings } = useFilters();
  const {
    logs,
    loading,
    error,
    connected,
    lastUpdate,
    isPaused,
    setIsPaused,
    agentId,
    agentName,
    dedupeDebug,
    isCatchingUp,
    isCached,
    resetAndLoadRecent,
  } = useLogContext();

  if (loading && logs.length === 0) {
    return (
      <DashboardShell title="Dashboard" showControls={false}>
        <div className="flex items-center justify-center h-[60vh]">
          <div className="text-center">
            {isCatchingUp ? (
              <>
                <History className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
                <p className="text-muted-foreground">Loading log history...</p>
              </>
            ) : (
              <>
                <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
                <p className="text-muted-foreground">Connecting to agent...</p>
              </>
            )}
          </div>
        </div>
      </DashboardShell>
    );
  }

  if (error && !connected && logs.length === 0) {
    const isNoAgentError = error.includes('No agent selected or available');

    return (
      <DashboardShell title="Dashboard" showControls={false}>
        <div className="flex items-center justify-center h-[60vh]">
          <div className="text-center max-w-md mx-auto p-8 bg-card rounded-xl shadow-sm border">
            {isNoAgentError ? (
              <>
                <div className="mx-auto w-16 h-16 bg-destructive/10 rounded-full flex items-center justify-center mb-6">
                  <ServerOff className="w-8 h-8 text-destructive" />
                </div>
                <h2 className="text-2xl font-bold mb-3">
                  No Agents Configured
                </h2>
                <p className="text-muted-foreground mb-6">
                  There are no Traefik agents currently configured or available. Please configure an agent to start collecting logs.
                </p>
                <Button
                  onClick={() => navigate({ to: '/settings/agents' })}
                >
                  Configure Agent
                </Button>
              </>
            ) : (
              <>
                <div className="text-destructive text-6xl mb-4">⚠</div>
                <h2 className="text-2xl font-bold mb-2">
                  Connection Error
                </h2>
                <p className="text-muted-foreground mb-4">{error}</p>
                <p className="text-sm text-muted-foreground">
                  Make sure the agent is running and accessible
                </p>
              </>
            )}
          </div>
        </div>
      </DashboardShell>
    );
  }

  return (
    <DashboardShell
      title="Dashboard"
      connected={connected}
      lastUpdate={lastUpdate}
      isPaused={isPaused}
      onTogglePause={() => setIsPaused(!isPaused)}
      logsCount={logs.length}
      showControls={true}
      agentName={agentName}
      hideInternalTraffic={settings.hideInternalTraffic}
      onToggleHideInternalTraffic={() => {
        updateSettings({ hideInternalTraffic: !settings.hideInternalTraffic });
      }}
      onLoadRecent={resetAndLoadRecent}
      dedupeDebug={dedupeDebug}
    >
      {(isCatchingUp || isCached) && (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-border/50 bg-muted/50 px-4 py-2 text-sm text-muted-foreground">
          {isCatchingUp ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Loading historical logs...</span>
            </>
          ) : isCached ? (
            <>
              <Database className="h-4 w-4" />
              <span>Showing cached logs &mdash; reconnecting for live updates...</span>
            </>
          ) : null}
        </div>
      )}
      <ErrorBoundary>
        <DashboardWithFilters
          logs={logs}
          demoMode={false}
          agentId={agentId || undefined}
          agentName={agentName || undefined}
        />
      </ErrorBoundary>
    </DashboardShell>
  );
}
