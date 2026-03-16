'use client';

import { memo, useMemo } from 'react';
import { Activity, Clock, Server, TrendingUp } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { DashboardMetrics } from '@/utils/types';
import { formatNumber } from '@/utils/utils';
import TimeSeriesChart from '@/components/charts/TimeSeriesChart';
import KpiCard from '@/components/dashboard/cards/KpiCard';
import StatusCodeChart from '@/components/dashboard/cards/StatusCodeChart';
import ResponseTimeGauge from '@/components/dashboard/cards/ResponseTimeGauge';
import ActiveSignals from '@/components/dashboard/cards/ActiveSignals';
import LiveEventFeed from '@/components/dashboard/cards/LiveEventFeed';

interface OverviewSectionProps {
  metrics: DashboardMetrics;
}

function OverviewSection({ metrics }: OverviewSectionProps) {
  const total = metrics.statusCodes.status2xx + metrics.statusCodes.status3xx +
                metrics.statusCodes.status4xx + metrics.statusCodes.status5xx;
  const successRate = total > 0 ? ((metrics.statusCodes.status2xx + metrics.statusCodes.status3xx) / total) * 100 : 0;

  const sparklineData = useMemo(() =>
    metrics.timeline.map(p => p.value),
    [metrics.timeline]
  );

  const responseTimeColor = metrics.responseTime.average < 200 ? 'success' as const
    : metrics.responseTime.average < 500 ? 'warning' as const
    : 'destructive' as const;

  const successColor = successRate >= 95 ? 'success' as const
    : successRate >= 90 ? 'warning' as const
    : 'destructive' as const;

  return (
    <div className="space-y-6">
      {/* KPI Cards with sparklines */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          title="Total Requests"
          value={formatNumber(metrics.requests.total)}
          description={`${metrics.requests.perSecond.toFixed(2)} req/s`}
          trend={metrics.requests.change}
          sparklineData={sparklineData}
          icon={Activity}
          colorVariant="info"
        />
        <KpiCard
          title="Response Time"
          value={`${metrics.responseTime.average.toFixed(0)}ms`}
          description={metrics.responseTime.samples > 0
            ? `P99: ${metrics.responseTime.p99.toFixed(0)}ms`
            : 'Duration unavailable for current log mix'}
          trend={metrics.responseTime.change}
          icon={Clock}
          colorVariant={responseTimeColor}
        />
        <KpiCard
          title="Success Rate"
          value={`${successRate.toFixed(1)}%`}
          description={`${formatNumber(metrics.statusCodes.status2xx + metrics.statusCodes.status3xx)} successful`}
          icon={TrendingUp}
          colorVariant={successColor}
        />
        <KpiCard
          title="Active Services"
          value={metrics.backends.length.toString()}
          description="Services with traffic"
          icon={Server}
          colorVariant="default"
        />
      </div>

      {/* Timeline Chart + Active Signals */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="hover:shadow-md transition-shadow lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold uppercase tracking-wide">
              Request Timeline
            </CardTitle>
          </CardHeader>
          <CardContent>
            <TimeSeriesChart data={metrics.timeline} />
          </CardContent>
        </Card>
        <ActiveSignals errors={metrics.errors} backends={metrics.backends} />
      </div>

      {/* Status Code Donut + Response Time Gauges */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <StatusCodeChart
          status2xx={metrics.statusCodes.status2xx}
          status3xx={metrics.statusCodes.status3xx}
          status4xx={metrics.statusCodes.status4xx}
          status5xx={metrics.statusCodes.status5xx}
          errorRate={metrics.statusCodes.errorRate}
        />
        <ResponseTimeGauge
          average={metrics.responseTime.average}
          p95={metrics.responseTime.p95}
          p99={metrics.responseTime.p99}
          samples={metrics.responseTime.samples}
        />
      </div>

      {/* Live Event Feed */}
      <LiveEventFeed logs={metrics.logs} maxItems={12} />
    </div>
  );
}

export default memo(OverviewSection);
