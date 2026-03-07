'use client';

import { memo, useMemo } from 'react';
import { AlertCircle, AlertTriangle, Zap, Clock } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { ErrorLog, BackendMetrics } from '@/utils/types';

interface ActiveSignalsProps {
  errors: ErrorLog[];
  backends: BackendMetrics[];
}

interface Signal {
  id: string;
  title: string;
  description: string;
  severity: 'critical' | 'warning' | 'info';
  time?: string;
}

const severityConfig = {
  critical: { dot: 'bg-destructive', badge: 'destructive' as const, icon: AlertCircle },
  warning: { dot: 'bg-warning', badge: 'warning' as const, icon: AlertTriangle },
  info: { dot: 'bg-info', badge: 'info' as const, icon: Zap },
};

function ActiveSignals({ errors, backends }: ActiveSignalsProps) {
  const signals = useMemo<Signal[]>(() => {
    const result: Signal[] = [];

    // Derive signals from errors
    errors.slice(0, 5).forEach((error, idx) => {
      result.push({
        id: `error-${idx}`,
        title: error.message.length > 60 ? error.message.slice(0, 60) + '...' : error.message,
        description: `${error.level} error detected`,
        severity: error.level === 'error' ? 'critical' : 'warning',
        time: formatTimeAgo(error.timestamp),
      });
    });

    // Derive signals from unhealthy backends
    backends
      .filter(b => b.errorRate >= 10)
      .slice(0, 3)
      .forEach((backend) => {
        result.push({
          id: `backend-critical-${backend.name}`,
          title: `${backend.name} error rate critical`,
          description: `Error rate at ${backend.errorRate.toFixed(1)}%`,
          severity: 'critical',
        });
      });

    backends
      .filter(b => b.errorRate >= 5 && b.errorRate < 10)
      .slice(0, 3)
      .forEach((backend) => {
        result.push({
          id: `backend-warn-${backend.name}`,
          title: `${backend.name} elevated errors`,
          description: `Error rate at ${backend.errorRate.toFixed(1)}%`,
          severity: 'warning',
        });
      });

    // Slow backends
    backends
      .filter(b => b.avgDuration > 1000)
      .slice(0, 2)
      .forEach((backend) => {
        result.push({
          id: `backend-slow-${backend.name}`,
          title: `${backend.name} slow response`,
          description: `Avg ${backend.avgDuration.toFixed(0)}ms`,
          severity: 'info',
        });
      });

    return result;
  }, [errors, backends]);

  return (
    <Card className="hover:shadow-md transition-shadow h-full">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold uppercase tracking-wide">
            Active Signals
          </CardTitle>
          <Badge variant="outline" className="text-xs tabular-nums">
            {signals.length}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        {signals.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
            <div className="w-10 h-10 rounded-full bg-success-muted flex items-center justify-center mb-3">
              <Zap className="h-5 w-5 text-success" />
            </div>
            <p className="text-sm">All systems normal</p>
          </div>
        ) : (
          <ScrollArea className="h-[220px]">
            <div className="space-y-3">
              {signals.map((signal) => {
                const config = severityConfig[signal.severity];
                return (
                  <div key={signal.id} className="flex items-start gap-3">
                    <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${config.dot}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium leading-tight truncate">{signal.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{signal.description}</p>
                      {signal.time && (
                        <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {signal.time}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}

function formatTimeAgo(timestamp: string): string {
  try {
    const diff = Date.now() - new Date(timestamp).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  } catch {
    return '';
  }
}

export default memo(ActiveSignals);
