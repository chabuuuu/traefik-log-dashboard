'use client';

import { memo } from 'react';
import { Cpu, HardDrive, MemoryStick, Server } from 'lucide-react';
import { RadialBarChart, RadialBar, PolarAngleAxis } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/badge';
import { ChartContainer } from '@/components/ui/chart';
import type { ChartConfig } from '@/components/ui/chart';
import { ParserMetrics, SystemMonitoringDisabled, SystemStats, SystemStatsResponse } from '@/utils/types';
import SparklineChart from '@/components/charts/SparklineChart';
import HealthBar from '@/components/dashboard/cards/HealthBar';
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

function getColor(percentage: number): string {
  if (percentage < 50) return 'var(--success)';
  if (percentage < 75) return 'var(--warning)';
  return 'var(--destructive)';
}

function getTextColor(percentage: number): string {
  if (percentage < 50) return 'text-success';
  if (percentage < 75) return 'text-warning';
  return 'text-destructive';
}

function getStatusLabel(percentage: number): string {
  if (percentage < 50) return 'Normal';
  if (percentage < 75) return 'Moderate';
  if (percentage < 90) return 'High';
  return 'Critical';
}

function ResourceGauge({ label, percentage, icon: Icon, details }: {
  label: string;
  percentage: number;
  icon: React.ComponentType<{ className?: string }>;
  details: { label: string; value: string }[];
}) {
  const color = getColor(percentage);
  const textColor = getTextColor(percentage);
  const chartConfig = { value: { label, color } } satisfies ChartConfig;
  const data = [{ name: label, value: percentage, fill: color }];

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Icon className={`h-4 w-4 ${textColor}`} />
            <span className="text-sm font-semibold uppercase tracking-wide">{label}</span>
          </div>
          <Badge variant={percentage < 50 ? 'success' : percentage < 75 ? 'warning' : 'destructive'} className="text-[10px] px-1.5 py-0">
            {getStatusLabel(percentage)}
          </Badge>
        </div>
        <div className="flex items-center gap-4">
          <ChartContainer config={chartConfig} className="h-24 w-24 shrink-0">
            <RadialBarChart
              cx="50%"
              cy="50%"
              innerRadius="65%"
              outerRadius="100%"
              startAngle={180}
              endAngle={0}
              data={data}
              barSize={10}
            >
              <PolarAngleAxis type="number" domain={[0, 100]} angleAxisId={0} tick={false} />
              <RadialBar
                dataKey="value"
                cornerRadius={5}
                background={{ fill: 'var(--muted)' }}
              />
              <text x="50%" y="55%" textAnchor="middle" dominantBaseline="middle">
                <tspan className="text-lg font-bold" style={{ fill: color }}>
                  {percentage.toFixed(1)}%
                </tspan>
              </text>
            </RadialBarChart>
          </ChartContainer>
          <div className="flex-1 space-y-1.5">
            {details.map((detail) => (
              <div key={detail.label} className="flex justify-between text-xs">
                <span className="text-muted-foreground">{detail.label}</span>
                <span className="font-medium tabular-nums">{detail.value}</span>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function getParserHealth(metrics: ParserMetrics): { label: string; variant: 'success' | 'warning' | 'destructive' } {
  const parsedTotal = metrics.json + metrics.traefik_clf + metrics.generic_clf;
  const totalSeen = parsedTotal + metrics.unknown;
  const unknownRate = totalSeen > 0 ? metrics.unknown / totalSeen : 0;
  const errorRate = parsedTotal > 0 ? metrics.errors / parsedTotal : 0;

  if (errorRate > 0.03 || unknownRate > 0.2) return { label: 'Critical', variant: 'destructive' };
  if (errorRate > 0.01 || unknownRate > 0.1) return { label: 'Warning', variant: 'warning' };
  return { label: 'Healthy', variant: 'success' };
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
  if (!parserMetrics && !statusLoading && !statusError) return null;

  const metrics = parserMetrics || { json: 0, traefik_clf: 0, generic_clf: 0, unknown: 0, errors: 0 };
  const parsedTotal = metrics.json + metrics.traefik_clf + metrics.generic_clf;
  const totalSeen = parsedTotal + metrics.unknown;
  const unknownRate = totalSeen > 0 ? metrics.unknown / totalSeen : 0;
  const errorRate = parsedTotal > 0 ? metrics.errors / parsedTotal : 0;
  const health = getParserHealth(metrics);
  const unknownTrend = (parserTrend ?? []).map((p) => p.unknownRatio * 100);
  const errorTrend = (parserTrend ?? []).map((p) => p.errorRatio * 100);

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-semibold uppercase tracking-wide">Parser Health</CardTitle>
        <Badge variant={health.variant} className="text-[10px] px-1.5 py-0">{health.label}</Badge>
      </CardHeader>
      <CardContent>
        {statusError ? (
          <p className="text-sm text-destructive">{statusError}</p>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              {[
                { label: 'JSON', value: metrics.json },
                { label: 'Traefik CLF', value: metrics.traefik_clf },
                { label: 'Generic CLF', value: metrics.generic_clf },
                { label: 'Unknown', value: metrics.unknown, warn: true },
                { label: 'Errors', value: metrics.errors, error: true },
              ].map((item) => (
                <div key={item.label} className={`rounded-md p-3 ${
                  item.error && item.value > 0 ? 'bg-destructive-muted border border-destructive/20' :
                  item.warn && item.value > 0 ? 'bg-warning-muted border border-warning/20' :
                  'bg-muted/40'
                }`}>
                  <p className="text-[10px] text-muted-foreground uppercase">{item.label}</p>
                  <p className="text-lg font-semibold tabular-nums">{item.value}</p>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Unknown ratio</span>
                <span className="font-medium tabular-nums">{(unknownRate * 100).toFixed(1)}%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Error ratio</span>
                <span className="font-medium tabular-nums">{(errorRate * 100).toFixed(1)}%</span>
              </div>
            </div>
            {(unknownTrend.length > 1 || errorTrend.length > 1) && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {unknownTrend.length > 1 && (
                  <div className="rounded-md border border-warning/20 bg-warning-muted/50 p-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] text-muted-foreground uppercase">Unknown ratio trend</span>
                      <span className="text-xs font-semibold tabular-nums">{(unknownRate * 100).toFixed(2)}%</span>
                    </div>
                    <SparklineChart data={unknownTrend} color="var(--warning)" height={40} />
                  </div>
                )}
                {errorTrend.length > 1 && (
                  <div className="rounded-md border border-destructive/20 bg-destructive-muted/50 p-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] text-muted-foreground uppercase">Error ratio trend</span>
                      <span className="text-xs font-semibold tabular-nums">{(errorRate * 100).toFixed(2)}%</span>
                    </div>
                    <SparklineChart data={errorTrend} color="var(--destructive)" height={40} />
                  </div>
                )}
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
    typeof value === 'object' && value !== null && (value as Record<string, unknown>).status === 'disabled';

  if (systemStats && isDisabled(systemStats)) {
    return (
      <div className="space-y-6">
        <Card className="hover:shadow-md transition-shadow">
          <CardContent className="flex items-center justify-center py-12 text-muted-foreground">
            <div className="text-center space-y-2">
              <div className="mx-auto w-12 h-12 bg-muted rounded-full flex items-center justify-center">
                <Server className="h-6 w-6" />
              </div>
              <p className="text-sm font-medium">Monitoring disabled</p>
              <p className="text-xs">{systemStats.message || 'System monitoring is disabled'}</p>
            </div>
          </CardContent>
        </Card>
        <ParserMetricsPanel parserMetrics={parserMetrics} parserTrend={parserTrend} statusLoading={statusLoading} statusError={statusError} statusLastUpdate={statusLastUpdate} />
      </div>
    );
  }

  if (!systemStats) {
    return (
      <div className="space-y-6">
        <Card className="hover:shadow-md transition-shadow">
          <CardContent className="flex items-center justify-center py-12 text-muted-foreground">
            <div className="text-center">
              <Server className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="text-sm">System statistics not available</p>
              <p className="text-xs mt-1">Connect to an agent to view system resources</p>
            </div>
          </CardContent>
        </Card>
        <ParserMetricsPanel parserMetrics={parserMetrics} parserTrend={parserTrend} statusLoading={statusLoading} statusError={statusError} statusLastUpdate={statusLastUpdate} />
      </div>
    );
  }

  const stats = systemStats as SystemStats;
  const cpuPercent = stats.cpu.usage_percent;
  const memoryPercent = stats.memory.used_percent;
  const diskPercent = stats.disk.used_percent;

  // Overall health
  const healthyCount = [cpuPercent, memoryPercent, diskPercent].filter(p => p < 75).length;
  const warningCount = [cpuPercent, memoryPercent, diskPercent].filter(p => p >= 75 && p < 90).length;
  const criticalCount = [cpuPercent, memoryPercent, diskPercent].filter(p => p >= 90).length;

  return (
    <div className="space-y-6">
      {/* Resource Gauges */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <ResourceGauge
          label="CPU"
          percentage={cpuPercent}
          icon={Cpu}
          details={[
            { label: 'Cores', value: String(stats.cpu.cores) },
            ...(stats.cpu.model ? [{ label: 'Model', value: stats.cpu.model.slice(0, 30) }] : []),
          ]}
        />
        <ResourceGauge
          label="Memory"
          percentage={memoryPercent}
          icon={MemoryStick}
          details={[
            { label: 'Used', value: formatBytes(stats.memory.used) },
            { label: 'Total', value: formatBytes(stats.memory.total) },
            { label: 'Available', value: formatBytes(stats.memory.available) },
          ]}
        />
        <ResourceGauge
          label="Disk"
          percentage={diskPercent}
          icon={HardDrive}
          details={[
            { label: 'Used', value: formatBytes(stats.disk.used) },
            { label: 'Total', value: formatBytes(stats.disk.total) },
            { label: 'Free', value: formatBytes(stats.disk.free) },
          ]}
        />
      </div>

      {/* System Health Bar */}
      <HealthBar
        label="System Health"
        segments={[
          { label: 'Normal', count: healthyCount, color: 'var(--success)', variant: 'success' },
          { label: 'Warning', count: warningCount, color: 'var(--warning)', variant: 'warning' },
          { label: 'Critical', count: criticalCount, color: 'var(--destructive)', variant: 'destructive' },
        ]}
      />

      {/* Parser Metrics */}
      <ParserMetricsPanel parserMetrics={parserMetrics} parserTrend={parserTrend} statusLoading={statusLoading} statusError={statusError} statusLastUpdate={statusLastUpdate} />
    </div>
  );
}

export default memo(SystemSection);
