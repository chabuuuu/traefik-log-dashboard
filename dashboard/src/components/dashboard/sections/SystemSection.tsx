'use client';

import { memo } from 'react';
import { Cpu, HardDrive, MemoryStick, Activity, Server } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Progress } from '@/components/ui/progress';
import { ParserMetrics, SystemMonitoringDisabled, SystemStats, SystemStatsResponse } from '@/utils/types';
import SparklineChart from '@/components/charts/SparklineChart';
import type { ParserRatioTrendPoint } from '@/hooks/useAgentStatus';

interface SystemSectionProps {
  systemStats: SystemStatsResponse | null | undefined;
  parserMetrics?: ParserMetrics;
  parserTrend?: ParserRatioTrendPoint[];
  statusLoading?: boolean;
  statusError?: string | null;
  statusLastUpdate?: Date | null;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function getStatusColor(percentage: number): string {
  if (percentage < 50) return 'text-success';
  if (percentage < 75) return 'text-warning';
  if (percentage < 90) return 'text-warning';
  return 'text-destructive';
}

function getStatusBg(percentage: number): string {
  if (percentage < 50) return 'bg-success-muted border-success/30';
  if (percentage < 75) return 'bg-warning-muted border-warning/30';
  if (percentage < 90) return 'bg-warning-muted border-warning/30';
  return 'bg-destructive-muted border-destructive/30';
}

function getStatusLabel(percentage: number): string {
  if (percentage < 50) return 'Normal';
  if (percentage < 75) return 'Moderate';
  if (percentage < 90) return 'High';
  return 'Critical';
}

function getParserHealth(metrics: ParserMetrics): { label: string; className: string } {
  const parsedTotal = metrics.json + metrics.traefik_clf + metrics.generic_clf;
  const totalSeen = parsedTotal + metrics.unknown;
  const unknownRate = totalSeen > 0 ? metrics.unknown / totalSeen : 0;
  const errorRate = parsedTotal > 0 ? metrics.errors / parsedTotal : 0;

  if (errorRate > 0.03 || unknownRate > 0.2) {
    return { label: 'Critical', className: 'text-destructive' };
  }
  if (errorRate > 0.01 || unknownRate > 0.1) {
    return { label: 'Warning', className: 'text-warning' };
  }
  return { label: 'Healthy', className: 'text-success' };
}

function asPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

function ParserMetricsPanel({
  parserMetrics,
  parserTrend,
  statusLoading,
  statusError,
  statusLastUpdate,
}: {
  parserMetrics?: ParserMetrics;
  parserTrend?: ParserRatioTrendPoint[];
  statusLoading?: boolean;
  statusError?: string | null;
  statusLastUpdate?: Date | null;
}) {
  if (!parserMetrics && !statusLoading && !statusError) {
    return null;
  }

  const metrics = parserMetrics || {
    json: 0,
    traefik_clf: 0,
    generic_clf: 0,
    unknown: 0,
    errors: 0,
  };
  const parsedTotal = metrics.json + metrics.traefik_clf + metrics.generic_clf;
  const totalSeen = parsedTotal + metrics.unknown;
  const unknownRate = totalSeen > 0 ? metrics.unknown / totalSeen : 0;
  const errorRate = parsedTotal > 0 ? metrics.errors / parsedTotal : 0;
  const health = getParserHealth(metrics);
  const unknownTrend = (parserTrend ?? []).map((point) => point.unknownRatio * 100);
  const errorTrend = (parserTrend ?? []).map((point) => point.errorRatio * 100);

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-semibold uppercase tracking-wide">Parser Health</CardTitle>
        <Server className="h-5 w-5 text-primary" />
      </CardHeader>
      <CardContent>
        {statusError ? (
          <p className="text-sm text-destructive">{statusError}</p>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Status</span>
              <span className={`text-sm font-semibold ${health.className}`}>{health.label}</span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <div className="bg-muted/40 rounded-md p-3">
                <p className="text-xs text-muted-foreground">JSON</p>
                <p className="text-lg font-semibold">{metrics.json}</p>
              </div>
              <div className="bg-muted/40 rounded-md p-3">
                <p className="text-xs text-muted-foreground">Traefik CLF</p>
                <p className="text-lg font-semibold">{metrics.traefik_clf}</p>
              </div>
              <div className="bg-muted/40 rounded-md p-3">
                <p className="text-xs text-muted-foreground">Generic CLF</p>
                <p className="text-lg font-semibold">{metrics.generic_clf}</p>
              </div>
              <div className="bg-warning-muted rounded-md p-3 border border-warning/30">
                <p className="text-xs text-muted-foreground">Unknown</p>
                <p className="text-lg font-semibold">{metrics.unknown}</p>
              </div>
              <div className="bg-destructive-muted rounded-md p-3 border border-destructive/30">
                <p className="text-xs text-muted-foreground">Errors</p>
                <p className="text-lg font-semibold">{metrics.errors}</p>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Unknown ratio</span>
                <span className="font-medium">{asPercent(unknownRate)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Error ratio</span>
                <span className="font-medium">{asPercent(errorRate)}</span>
              </div>
            </div>
            {(unknownTrend.length > 1 || errorTrend.length > 1) && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="rounded-md border border-warning/30 bg-warning-muted p-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-muted-foreground">Unknown ratio trend</span>
                    <span className="text-xs font-semibold text-foreground">{unknownRate * 100 > 0 ? `${(unknownRate * 100).toFixed(2)}%` : '0.00%'}</span>
                  </div>
                  <SparklineChart data={unknownTrend} color="var(--warning)" height={44} />
                </div>
                <div className="rounded-md border border-destructive/30 bg-destructive-muted p-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-muted-foreground">Error ratio trend</span>
                    <span className="text-xs font-semibold text-foreground">{errorRate * 100 > 0 ? `${(errorRate * 100).toFixed(2)}%` : '0.00%'}</span>
                  </div>
                  <SparklineChart data={errorTrend} color="var(--destructive)" height={44} />
                </div>
              </div>
            )}
            <div className="text-xs text-muted-foreground">
              {statusLoading ? 'Refreshing parser status...' : `Last update: ${statusLastUpdate?.toLocaleTimeString() || 'n/a'}`}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function SystemSection({ systemStats, parserMetrics, parserTrend, statusLoading, statusError, statusLastUpdate }: SystemSectionProps) {
  const isDisabled = (value: SystemStatsResponse): value is SystemMonitoringDisabled =>
    typeof value === 'object' && value !== null && (value as any).status === 'disabled';

  if (systemStats && isDisabled(systemStats)) {
    const message = systemStats.message || 'System monitoring is disabled';
    return (
      <div className="space-y-6">
        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-semibold uppercase tracking-wide">System Resources</CardTitle>
            <Server className="h-5 w-5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              <div className="text-center space-y-2">
                <div className="mx-auto w-12 h-12 bg-muted rounded-full flex items-center justify-center">
                  <Server className="h-6 w-6" />
                </div>
                <p className="text-sm font-medium">Monitoring disabled</p>
                <p className="text-xs">{message}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <ParserMetricsPanel
          parserMetrics={parserMetrics}
          parserTrend={parserTrend}
          statusLoading={statusLoading}
          statusError={statusError}
          statusLastUpdate={statusLastUpdate}
        />
      </div>
    );
  }

  if (!systemStats) {
    return (
      <div className="space-y-6">
        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-semibold uppercase tracking-wide">System Resources</CardTitle>
            <Server className="h-5 w-5 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              <div className="text-center">
                <Server className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p className="text-sm">System statistics not available</p>
                <p className="text-xs mt-1">Connect to an agent to view system resources</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <ParserMetricsPanel
          parserMetrics={parserMetrics}
          parserTrend={parserTrend}
          statusLoading={statusLoading}
          statusError={statusError}
          statusLastUpdate={statusLastUpdate}
        />
      </div>
    );
  }

  const stats = systemStats as SystemStats;
  const cpuPercent = stats.cpu.usage_percent;
  const memoryPercent = stats.memory.used_percent;
  const diskPercent = stats.disk.used_percent;

  return (
    <div className="space-y-6">
      {/* Resource Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* CPU Card */}
        <Card className={`hover:shadow-md transition-shadow border ${getStatusBg(cpuPercent)}`}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-semibold uppercase tracking-wide">CPU</CardTitle>
            <Cpu className={`h-5 w-5 ${getStatusColor(cpuPercent)}`} />
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-end justify-between">
                <span className={`text-4xl font-bold ${getStatusColor(cpuPercent)}`}>
                  {cpuPercent.toFixed(1)}%
                </span>
                <span className={`text-sm font-medium ${getStatusColor(cpuPercent)}`}>
                  {getStatusLabel(cpuPercent)}
                </span>
              </div>
              <Progress value={cpuPercent} className="h-2" />
              <div className="text-sm text-muted-foreground">
                <div className="flex justify-between">
                  <span>Cores</span>
                  <span className="font-medium text-foreground">{stats.cpu.cores}</span>
                </div>
                {stats.cpu.model && (
                  <div className="flex justify-between mt-1">
                    <span>Model</span>
                    <span className="font-medium text-foreground truncate max-w-[150px]" title={stats.cpu.model}>
                      {stats.cpu.model}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Memory Card */}
        <Card className={`hover:shadow-md transition-shadow border ${getStatusBg(memoryPercent)}`}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-semibold uppercase tracking-wide">Memory</CardTitle>
            <MemoryStick className={`h-5 w-5 ${getStatusColor(memoryPercent)}`} />
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-end justify-between">
                <span className={`text-4xl font-bold ${getStatusColor(memoryPercent)}`}>
                  {memoryPercent.toFixed(1)}%
                </span>
                <span className={`text-sm font-medium ${getStatusColor(memoryPercent)}`}>
                  {getStatusLabel(memoryPercent)}
                </span>
              </div>
              <Progress value={memoryPercent} className="h-2" />
              <div className="text-sm text-muted-foreground">
                <div className="flex justify-between">
                  <span>Used</span>
                  <span className="font-medium text-foreground">{formatBytes(stats.memory.used)}</span>
                </div>
                <div className="flex justify-between mt-1">
                  <span>Total</span>
                  <span className="font-medium text-foreground">{formatBytes(stats.memory.total)}</span>
                </div>
                <div className="flex justify-between mt-1">
                  <span>Available</span>
                  <span className="font-medium text-foreground">{formatBytes(stats.memory.available)}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Disk Card */}
        <Card className={`hover:shadow-md transition-shadow border ${getStatusBg(diskPercent)}`}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-semibold uppercase tracking-wide">Disk</CardTitle>
            <HardDrive className={`h-5 w-5 ${getStatusColor(diskPercent)}`} />
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-end justify-between">
                <span className={`text-4xl font-bold ${getStatusColor(diskPercent)}`}>
                  {diskPercent.toFixed(1)}%
                </span>
                <span className={`text-sm font-medium ${getStatusColor(diskPercent)}`}>
                  {getStatusLabel(diskPercent)}
                </span>
              </div>
              <Progress value={diskPercent} className="h-2" />
              <div className="text-sm text-muted-foreground">
                <div className="flex justify-between">
                  <span>Used</span>
                  <span className="font-medium text-foreground">{formatBytes(stats.disk.used)}</span>
                </div>
                <div className="flex justify-between mt-1">
                  <span>Total</span>
                  <span className="font-medium text-foreground">{formatBytes(stats.disk.total)}</span>
                </div>
                <div className="flex justify-between mt-1">
                  <span>Free</span>
                  <span className="font-medium text-foreground">{formatBytes(stats.disk.free)}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Overall System Health */}
      <Card className="hover:shadow-md transition-shadow">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-semibold uppercase tracking-wide">System Health Overview</CardTitle>
          <Activity className="h-5 w-5 text-primary" />
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <div className={`text-2xl font-bold ${getStatusColor(cpuPercent)}`}>{cpuPercent.toFixed(0)}%</div>
                <div className="text-xs text-muted-foreground">CPU</div>
              </div>
              <div>
                <div className={`text-2xl font-bold ${getStatusColor(memoryPercent)}`}>{memoryPercent.toFixed(0)}%</div>
                <div className="text-xs text-muted-foreground">Memory</div>
              </div>
              <div>
                <div className={`text-2xl font-bold ${getStatusColor(diskPercent)}`}>{diskPercent.toFixed(0)}%</div>
                <div className="text-xs text-muted-foreground">Disk</div>
              </div>
            </div>
            <div className="flex items-center justify-center gap-2 pt-4 border-t">
              <div className={`w-3 h-3 rounded-full ${cpuPercent < 75 && memoryPercent < 75 && diskPercent < 75 ? 'bg-success' : cpuPercent < 90 && memoryPercent < 90 && diskPercent < 90 ? 'bg-warning' : 'bg-destructive'}`} />
              <span className="text-sm font-medium">
                {cpuPercent < 75 && memoryPercent < 75 && diskPercent < 75
                  ? 'System Healthy'
                  : cpuPercent < 90 && memoryPercent < 90 && diskPercent < 90
                    ? 'System Under Load'
                    : 'System Critical'}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      <ParserMetricsPanel
        parserMetrics={parserMetrics}
        parserTrend={parserTrend}
        statusLoading={statusLoading}
        statusError={statusError}
        statusLastUpdate={statusLastUpdate}
      />
    </div>
  );
}

export default memo(SystemSection);
