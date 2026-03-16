'use client';

import { memo } from 'react';
import { Route, Server, Activity } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { DashboardMetrics } from '@/utils/types';
import { formatNumber } from '@/utils/utils';
import { useConfig } from '@/utils/contexts/ConfigContext';
import HealthBar from '@/components/dashboard/cards/HealthBar';

interface TrafficSectionProps {
  metrics: DashboardMetrics;
}

function getMethodBg(method: string): string {
  switch (method?.toUpperCase()) {
    case 'GET': return 'bg-info-muted text-info';
    case 'POST': return 'bg-success-muted text-success';
    case 'PUT': return 'bg-warning-muted text-warning';
    case 'DELETE': return 'bg-destructive-muted text-destructive';
    default: return 'bg-muted text-muted-foreground';
  }
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

  const healthyBackends = metrics.backends.filter(b => b.errorRate < 5).length;
  const warningBackends = metrics.backends.filter(b => b.errorRate >= 5 && b.errorRate < 10).length;
  const criticalBackends = metrics.backends.filter(b => b.errorRate >= 10).length;

  return (
    <div className="space-y-6">
      {/* Backend Health Bar */}
      <HealthBar
        label="Backend Health"
        segments={[
          { label: 'Healthy', count: healthyBackends, color: 'var(--success)', variant: 'success' },
          { label: 'Warning', count: warningBackends, color: 'var(--warning)', variant: 'warning' },
          { label: 'Critical', count: criticalBackends, color: 'var(--destructive)', variant: 'destructive' },
        ]}
      />

      {/* Top Routes + Top Services */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Routes */}
        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-semibold uppercase tracking-wide">Top Routes</CardTitle>
            <Route className="h-5 w-5 text-primary" />
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-80">
              <div className="space-y-1">
                {topRoutes.map((route, idx) => {
                  const barWidth = (route.count / maxRouteCount) * 100;
                  return (
                    <div key={idx} className="relative flex items-center gap-3 px-3 py-2 rounded-md hover:bg-muted/50 transition-colors">
                      <div
                        className="absolute inset-y-0 left-0 bg-primary/5 rounded-md transition-all"
                        style={{ width: `${barWidth}%` }}
                      />
                      <div className="relative flex items-center gap-2 flex-1 min-w-0">
                        {route.method && (
                          <Badge className={`text-[10px] px-1.5 py-0 shrink-0 ${getMethodBg(route.method)}`}>
                            {route.method}
                          </Badge>
                        )}
                        <span className="font-mono text-xs truncate" title={route.path}>
                          {route.path}
                        </span>
                      </div>
                      <div className="relative text-right shrink-0">
                        <span className="text-sm font-semibold tabular-nums">{formatNumber(route.count)}</span>
                        <p className="text-[10px] text-muted-foreground">{route.avgDuration.toFixed(0)}ms</p>
                      </div>
                    </div>
                  );
                })}
                {metrics.topRoutes.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-8">No route data available</p>
                )}
              </div>
            </ScrollArea>
            {metrics.topRoutes.length > topItemsLimit && (
              <p className="text-xs text-muted-foreground text-center pt-2">
                Showing top {topItemsLimit} of {metrics.topRoutes.length} routes
              </p>
            )}
          </CardContent>
        </Card>

        {/* Top Services */}
        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-semibold uppercase tracking-wide">Top Services</CardTitle>
            <Server className="h-5 w-5 text-primary" />
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-80">
              <div className="space-y-1">
                {topServices.map((service, idx) => {
                  const barWidth = (service.requests / maxServiceCount) * 100;
                  const severityColor = service.errorRate >= 10 ? 'bg-destructive'
                    : service.errorRate >= 5 ? 'bg-warning' : 'bg-success';
                  return (
                    <div key={idx} className="relative flex items-center gap-3 px-3 py-2 rounded-md hover:bg-muted/50 transition-colors">
                      <div
                        className="absolute inset-y-0 left-0 bg-primary/5 rounded-md"
                        style={{ width: `${barWidth}%` }}
                      />
                      <div className={`relative w-1 h-8 rounded-full ${severityColor} shrink-0`} />
                      <div className="relative flex-1 min-w-0">
                        <span className="text-sm font-medium truncate block" title={service.name}>
                          {service.name}
                        </span>
                        <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                          <span>{service.avgDuration.toFixed(0)}ms avg</span>
                          <span className={service.errorRate > 5 ? 'text-destructive font-medium' : ''}>
                            {service.errorRate.toFixed(1)}% error
                          </span>
                        </div>
                      </div>
                      <span className="relative text-sm font-semibold tabular-nums shrink-0">
                        {formatNumber(service.requests)}
                      </span>
                    </div>
                  );
                })}
                {metrics.backends.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-8">No service data available</p>
                )}
              </div>
            </ScrollArea>
            {metrics.backends.length > topItemsLimit && (
              <p className="text-xs text-muted-foreground text-center pt-2">
                Showing top {topItemsLimit} of {metrics.backends.length} services
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Backend Services Detail */}
      <Card className="hover:shadow-md transition-shadow">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-semibold uppercase tracking-wide">Backend Services</CardTitle>
          <Server className="h-5 w-5 text-primary" />
        </CardHeader>
        <CardContent>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {topServices.map((backend, idx) => {
              const severityVariant = backend.errorRate >= 10 ? 'destructive' as const
                : backend.errorRate >= 5 ? 'warning' as const : 'success' as const;
              const severityColor = backend.errorRate >= 10 ? 'bg-destructive'
                : backend.errorRate >= 5 ? 'bg-warning' : 'bg-success';
              const totalRequests = metrics.backends.reduce((sum, b) => sum + b.requests, 0);
              const percentage = totalRequests > 0 ? (backend.requests / totalRequests) * 100 : 0;

              return (
                <div key={idx} className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted/30 transition-colors">
                  <div className={`w-1 self-stretch rounded-full ${severityColor} shrink-0`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold text-sm truncate" title={backend.name}>{backend.name}</span>
                      <Badge variant={severityVariant} className="text-[10px] px-1.5 py-0">
                        {backend.errorRate < 5 ? 'Healthy' : backend.errorRate < 10 ? 'Warning' : 'Critical'}
                      </Badge>
                    </div>
                    {backend.url && (
                      <p className="text-xs text-muted-foreground truncate" title={backend.url}>{backend.url}</p>
                    )}
                  </div>
                  <div className="grid grid-cols-3 gap-4 text-center shrink-0">
                    <div>
                      <div className="text-xs text-muted-foreground">Requests</div>
                      <div className="text-sm font-bold tabular-nums">{formatNumber(backend.requests)}</div>
                      <div className="text-[10px] text-muted-foreground">{percentage.toFixed(1)}%</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">Avg Time</div>
                      <div className="text-sm font-bold tabular-nums">{backend.avgDuration.toFixed(0)}ms</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">Error Rate</div>
                      <div className={`text-sm font-bold tabular-nums ${
                        backend.errorRate >= 10 ? 'text-destructive' :
                        backend.errorRate >= 5 ? 'text-warning' : 'text-success'
                      }`}>{backend.errorRate.toFixed(1)}%</div>
                    </div>
                  </div>
                </div>
              );
            })}
            {metrics.backends.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-8">No backend data available</p>
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
          <ScrollArea className="h-72">
            <div className="space-y-1">
              {topRouters.map((router, idx) => {
                const barWidth = (router.requests / maxRouterCount) * 100;
                return (
                  <div key={idx} className="relative flex items-center gap-3 px-3 py-2 rounded-md hover:bg-muted/50 transition-colors">
                    <div
                      className="absolute inset-y-0 left-0 bg-primary/5 rounded-md"
                      style={{ width: `${barWidth}%` }}
                    />
                    <div className="relative flex-1 min-w-0">
                      <span className="text-sm font-medium truncate block" title={router.name}>{router.name}</span>
                      {router.service && (
                        <span className="text-xs text-muted-foreground">→ {router.service}</span>
                      )}
                    </div>
                    <div className="relative text-right shrink-0">
                      <span className="text-sm font-semibold tabular-nums">{formatNumber(router.requests)}</span>
                      <p className="text-[10px] text-muted-foreground">{router.avgDuration.toFixed(0)}ms</p>
                    </div>
                  </div>
                );
              })}
              {metrics.routers.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-8">No router data available</p>
              )}
            </div>
          </ScrollArea>
          {metrics.routers.length > topItemsLimit && (
            <p className="text-xs text-muted-foreground text-center pt-2">
              Showing top {topItemsLimit} of {metrics.routers.length} routers
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default memo(TrafficSection);
