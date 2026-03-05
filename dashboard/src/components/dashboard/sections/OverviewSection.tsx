'use client';

import { memo } from 'react';
import { Activity, Clock, Server, TrendingUp, TrendingDown } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Progress } from '@/components/ui/progress';
import { DashboardMetrics } from '@/utils/types';
import { formatNumber } from '@/utils/utils';
import TimeSeriesChart from '@/components/charts/TimeSeriesChart';

interface OverviewSectionProps {
  metrics: DashboardMetrics;
}

function OverviewSection({ metrics }: OverviewSectionProps) {
  const total = metrics.statusCodes.status2xx + metrics.statusCodes.status3xx +
                metrics.statusCodes.status4xx + metrics.statusCodes.status5xx;
  const successRate = total > 0 ? ((metrics.statusCodes.status2xx + metrics.statusCodes.status3xx) / total) * 100 : 0;

  const stats = [
    {
      title: 'Total Requests',
      value: formatNumber(metrics.requests.total),
      description: `${metrics.requests.perSecond.toFixed(2)} req/s`,
      icon: Activity,
      color: 'text-info',
      bgColor: 'bg-info-muted',
    },
    {
      title: 'Response Time',
      value: `${metrics.responseTime.average.toFixed(0)}ms`,
      description: metrics.responseTime.samples > 0
        ? `P99: ${metrics.responseTime.p99.toFixed(0)}ms`
        : 'Duration unavailable for current log mix',
      icon: Clock,
      color: metrics.responseTime.average < 200 ? 'text-success' : metrics.responseTime.average < 500 ? 'text-warning' : 'text-destructive',
      bgColor: metrics.responseTime.average < 200 ? 'bg-success-muted' : metrics.responseTime.average < 500 ? 'bg-warning-muted' : 'bg-destructive-muted',
    },
    {
      title: 'Success Rate',
      value: `${successRate.toFixed(1)}%`,
      description: `${formatNumber(metrics.statusCodes.status2xx + metrics.statusCodes.status3xx)} successful`,
      icon: successRate >= 95 ? TrendingUp : TrendingDown,
      color: successRate >= 95 ? 'text-success' : successRate >= 90 ? 'text-warning' : 'text-destructive',
      bgColor: successRate >= 95 ? 'bg-success-muted' : successRate >= 90 ? 'bg-warning-muted' : 'bg-destructive-muted',
    },
    {
      title: 'Active Services',
      value: metrics.backends.length.toString(),
      description: 'Services with traffic',
      icon: Server,
      color: 'text-accent-foreground',
      bgColor: 'bg-accent',
    },
  ];

  const statusCodes = [
    { label: '2xx Success', value: metrics.statusCodes.status2xx, total, color: 'bg-success' },
    { label: '3xx Redirect', value: metrics.statusCodes.status3xx, total, color: 'bg-info' },
    { label: '4xx Client Error', value: metrics.statusCodes.status4xx, total, color: 'bg-warning' },
    { label: '5xx Server Error', value: metrics.statusCodes.status5xx, total, color: 'bg-destructive' },
  ];

  return (
    <div className="space-y-6">
      {/* Stats Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat, idx) => (
          <Card key={idx} className="hover:shadow-md transition-shadow">
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">{stat.title}</p>
                  <p className={`text-2xl font-bold mt-1 ${stat.color}`}>{stat.value}</p>
                  <p className="text-xs text-muted-foreground mt-1">{stat.description}</p>
                </div>
                <div className={`p-2 rounded-lg ${stat.bgColor}`}>
                  <stat.icon className={`h-5 w-5 ${stat.color}`} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Timeline Chart */}
      <Card className="hover:shadow-md transition-shadow">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold uppercase tracking-wide">
            Request Timeline
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64">
            <TimeSeriesChart data={metrics.timeline} />
          </div>
        </CardContent>
      </Card>

      {/* Status Code Distribution */}
      <Card className="hover:shadow-md transition-shadow">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold uppercase tracking-wide">
            Status Code Distribution
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {statusCodes.map((status, idx) => {
              const percentage = total > 0 ? (status.value / total) * 100 : 0;
              return (
                <div key={idx} className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{status.label}</span>
                    <span className="font-semibold">{formatNumber(status.value)}</span>
                  </div>
                  <Progress value={percentage} className="h-2" />
                  <p className="text-xs text-muted-foreground text-right">{percentage.toFixed(1)}%</p>
                </div>
              );
            })}
          </div>
          <div className="mt-4 pt-4 border-t flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Error Rate</span>
            <span className={`text-lg font-bold ${metrics.statusCodes.errorRate > 5 ? 'text-destructive' : 'text-success'}`}>
              {metrics.statusCodes.errorRate.toFixed(2)}%
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Response Time Details */}
      <Card className="hover:shadow-md transition-shadow">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold uppercase tracking-wide">
            Response Time Percentiles
          </CardTitle>
          {metrics.responseTime.samples === 0 && (
            <p className="text-xs text-muted-foreground mt-1 normal-case tracking-normal">
              Duration is unavailable for this interval (generic CLF lines may omit it).
            </p>
          )}
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { label: 'Average', value: metrics.responseTime.average, desc: 'Mean response time' },
              { label: 'P95', value: metrics.responseTime.p95, desc: '95% of requests' },
              { label: 'P99', value: metrics.responseTime.p99, desc: '99% of requests' },
            ].map((item, idx) => {
              const getColor = (ms: number) => {
                if (ms < 100) return 'text-success';
                if (ms < 300) return 'text-warning';
                if (ms < 1000) return 'text-warning';
                return 'text-destructive';
              };
              const getBg = (ms: number) => {
                if (ms < 100) return 'bg-success-muted border-success/30';
                if (ms < 300) return 'bg-warning-muted border-warning/30';
                if (ms < 1000) return 'bg-warning-muted border-warning/30';
                return 'bg-destructive-muted border-destructive/30';
              };
              return (
                <div key={idx} className={`p-4 rounded-lg border ${getBg(item.value)}`}>
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <p className="text-sm font-semibold text-foreground">{item.label}</p>
                      <p className="text-xs text-muted-foreground">{item.desc}</p>
                    </div>
                    <p className={`text-2xl font-bold ${getColor(item.value)}`}>
                      {item.value.toFixed(0)}
                      <span className="text-sm ml-1">ms</span>
                    </p>
                  </div>
                  <Progress
                    value={Math.min((item.value / 2000) * 100, 100)}
                    className="h-1.5"
                  />
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default memo(OverviewSection);
