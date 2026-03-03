import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import DashboardWithFilters from '@/components/dashboard/DashboardWithFilters';
import { DashboardShell } from '@/components/layout/DashboardShell';
import { generateTimeSeriesLogs } from '@/utils/demo';
import { TraefikLog } from '@/utils/types';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { Badge } from '@/components/ui/badge';
import { useConfig } from '@/utils/contexts/ConfigContext';

export default function DemoDashboardClient() {
  const { config } = useConfig();
  const [logs, setLogs] = useState<TraefikLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  useEffect(() => {
    const initialLogs = generateTimeSeriesLogs(60, 10);
    setLogs(initialLogs);
    setLoading(false);

    const interval = setInterval(() => {
      setLogs(prevLogs => {
        const newLogs = generateTimeSeriesLogs(1, 10);
        const updatedLogs = [...newLogs, ...prevLogs].slice(0, config.maxLogsDisplay);
        setLastUpdate(new Date());
        return updatedLogs;
      });
    }, config.refreshIntervalMs);

    return () => clearInterval(interval);
  }, [config.maxLogsDisplay, config.refreshIntervalMs]);

  if (loading) {
    return (
      <DashboardShell title="Demo Mode" showControls={false}>
        <div className="flex items-center justify-center h-[60vh]">
          <div className="text-center">
            <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
            <p className="text-muted-foreground">Loading demo dashboard...</p>
          </div>
        </div>
      </DashboardShell>
    );
  }

  return (
    <DashboardShell
      title="Demo Mode"
      connected={true}
      lastUpdate={lastUpdate}
      logsCount={logs.length}
      showControls={true}
      agentName="Demo Agent"
    >
      <div className="mb-4">
        <Badge variant="secondary" className="gap-2">
          <span className="w-2 h-2 bg-warning rounded-full animate-pulse" />
          Demo Mode - Using simulated data
        </Badge>
      </div>
      <ErrorBoundary>
        <DashboardWithFilters logs={logs} demoMode={true} />
      </ErrorBoundary>
    </DashboardShell>
  );
}
