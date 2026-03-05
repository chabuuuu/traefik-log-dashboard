'use client';

import { memo } from 'react';
import { Route, Server, CheckCircle, AlertCircle, Activity } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Progress } from '@/components/ui/progress';
import { DashboardMetrics } from '@/utils/types';
import { formatNumber } from '@/utils/utils';
import { useConfig } from '@/utils/contexts/ConfigContext';

interface TrafficSectionProps {
  metrics: DashboardMetrics;
}

function TrafficSection({ metrics }: TrafficSectionProps) {
  const { config } = useConfig();
  const topItemsLimit = Math.max(3, config.trafficTopItemsLimit || 10);
  const topRoutes = metrics.topRoutes.slice(0, topItemsLimit);
  const topServices = metrics.backends.slice(0, topItemsLimit);
  const topRouters = metrics.routers.slice(0, topItemsLimit);

  const maxRouteCount = Math.max(...topRoutes.map(r => r.count), 1);
  const maxServiceCount = Math.max(...topServices.map(b => b.requests), 1);
  const maxRouterCount = Math.max(...topRouters.map(r => r.requests), 1);

  // Backend health calculation
  const healthyBackends = metrics.backends.filter(b => b.errorRate < 5).length;
  const warningBackends = metrics.backends.filter(b => b.errorRate >= 5 && b.errorRate < 10).length;
  const criticalBackends = metrics.backends.filter(b => b.errorRate >= 10).length;

  return (
    <div className="space-y-6">
      {/* Backend Health Summary */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="bg-success-muted border-success/30">
          <CardContent className="p-4 text-center">
            <div className="text-3xl font-bold text-success">{healthyBackends}</div>
            <div className="text-sm text-muted-foreground mt-1">Healthy</div>
          </CardContent>
        </Card>
        <Card className="bg-warning-muted border-warning/30">
          <CardContent className="p-4 text-center">
            <div className="text-3xl font-bold text-warning">{warningBackends}</div>
            <div className="text-sm text-muted-foreground mt-1">Warning</div>
          </CardContent>
        </Card>
        <Card className="bg-destructive-muted border-destructive/30">
          <CardContent className="p-4 text-center">
            <div className="text-3xl font-bold text-destructive">{criticalBackends}</div>
            <div className="text-sm text-muted-foreground mt-1">Critical</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Routes */}
        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-semibold uppercase tracking-wide">Top Routes</CardTitle>
            <Route className="h-5 w-5 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="space-y-3 max-h-80 overflow-y-auto">
              {topRoutes.map((route, idx) => (
                <div key={idx} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <code className="text-xs bg-muted px-2 py-1 rounded truncate max-w-[200px]" title={route.path}>
                      {route.method && <span className="text-primary font-semibold mr-1">{route.method}</span>}
                      {route.path}
                    </code>
                    <span className="font-semibold">{formatNumber(route.count)}</span>
                  </div>
                  <Progress value={(route.count / maxRouteCount) * 100} className="h-1.5" />
                  <p className="text-xs text-muted-foreground">Avg: {route.avgDuration.toFixed(0)}ms</p>
                </div>
              ))}
              {metrics.topRoutes.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">No route data available</p>
              )}
              {metrics.topRoutes.length > topItemsLimit && (
                <p className="text-xs text-muted-foreground text-center pt-2">
                  Showing top {topItemsLimit} of {metrics.topRoutes.length} routes
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Top Services */}
        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-semibold uppercase tracking-wide">Top Services</CardTitle>
            <Server className="h-5 w-5 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="space-y-3 max-h-80 overflow-y-auto">
              {topServices.map((service, idx) => (
                <div key={idx} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium truncate max-w-[200px]" title={service.name}>
                      {service.name}
                    </span>
                    <span className="font-semibold">{formatNumber(service.requests)}</span>
                  </div>
                  <Progress value={(service.requests / maxServiceCount) * 100} className="h-1.5" />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Avg: {service.avgDuration.toFixed(0)}ms</span>
                    <span className={service.errorRate > 5 ? 'text-destructive' : ''}>
                      Error: {service.errorRate.toFixed(1)}%
                    </span>
                  </div>
                </div>
              ))}
              {metrics.backends.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">No service data available</p>
              )}
              {metrics.backends.length > topItemsLimit && (
                <p className="text-xs text-muted-foreground text-center pt-2">
                  Showing top {topItemsLimit} of {metrics.backends.length} services
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Backends Detail */}
      <Card className="hover:shadow-md transition-shadow">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-semibold uppercase tracking-wide">Backend Services</CardTitle>
          <Server className="h-5 w-5 text-primary" />
        </CardHeader>
        <CardContent>
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {topServices.map((backend, idx) => {
              const status = backend.errorRate < 5
                ? { icon: CheckCircle, color: 'text-success', bg: 'bg-success-muted', border: 'border-success/30', label: 'Healthy' }
                : backend.errorRate < 10
                  ? { icon: AlertCircle, color: 'text-warning', bg: 'bg-warning-muted', border: 'border-warning/30', label: 'Warning' }
                  : { icon: AlertCircle, color: 'text-destructive', bg: 'bg-destructive-muted', border: 'border-destructive/30', label: 'Critical' };
              const StatusIcon = status.icon;
              const totalRequests = metrics.backends.reduce((sum, b) => sum + b.requests, 0);
              const percentage = totalRequests > 0 ? (backend.requests / totalRequests) * 100 : 0;

              return (
                <div key={idx} className={`p-3 rounded-lg border ${status.border} ${status.bg}`}>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-start gap-2 flex-1 min-w-0">
                      <StatusIcon className={`w-5 h-5 ${status.color} flex-shrink-0 mt-0.5`} />
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-sm truncate text-foreground" title={backend.name}>
                          {backend.name}
                        </div>
                        {backend.url && (
                          <div className="text-xs text-muted-foreground truncate mt-0.5" title={backend.url}>
                            {backend.url}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className={`text-xs font-semibold px-2 py-1 rounded ${status.bg} ${status.color}`}>
                      {status.label}
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2 mt-3">
                    <div className="text-center">
                      <div className="text-xs text-muted-foreground">Requests</div>
                      <div className="text-sm font-bold text-foreground">{formatNumber(backend.requests)}</div>
                      <div className="text-xs text-muted-foreground">{percentage.toFixed(1)}%</div>
                    </div>
                    <div className="text-center">
                      <div className="text-xs text-muted-foreground">Avg Time</div>
                      <div className="text-sm font-bold text-foreground">{backend.avgDuration.toFixed(0)}ms</div>
                    </div>
                    <div className="text-center">
                      <div className="text-xs text-muted-foreground">Error Rate</div>
                      <div className={`text-sm font-bold ${status.color}`}>{backend.errorRate.toFixed(1)}%</div>
                    </div>
                  </div>
                </div>
              );
            })}
            {metrics.backends.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-8">No backend data available</p>
            )}
            {metrics.backends.length > topItemsLimit && (
              <p className="text-xs text-muted-foreground text-center pt-2">
                Showing top {topItemsLimit} of {metrics.backends.length} backend services
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Routers */}
      <Card className="hover:shadow-md transition-shadow">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-semibold uppercase tracking-wide">Routers</CardTitle>
          <Activity className="h-5 w-5 text-primary" />
        </CardHeader>
        <CardContent>
          <div className="space-y-3 max-h-80 overflow-y-auto">
            {topRouters.map((router, idx) => (
              <div key={idx} className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <div className="flex-1 min-w-0">
                    <span className="font-medium truncate block" title={router.name}>
                      {router.name}
                    </span>
                    {router.service && (
                      <span className="text-xs text-muted-foreground">→ {router.service}</span>
                    )}
                  </div>
                  <span className="font-semibold ml-2">{formatNumber(router.requests)}</span>
                </div>
                <Progress value={(router.requests / maxRouterCount) * 100} className="h-1.5" />
                <p className="text-xs text-muted-foreground">Avg: {router.avgDuration.toFixed(0)}ms</p>
              </div>
            ))}
            {metrics.routers.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">No router data available</p>
            )}
            {metrics.routers.length > topItemsLimit && (
              <p className="text-xs text-muted-foreground text-center pt-2">
                Showing top {topItemsLimit} of {metrics.routers.length} routers
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default memo(TrafficSection);
