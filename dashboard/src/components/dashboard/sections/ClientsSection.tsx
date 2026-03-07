'use client';

import { memo, useMemo } from 'react';
import { Users, Globe, Network, Monitor } from 'lucide-react';
import { Bar, BarChart, XAxis, YAxis } from 'recharts';
import { PieChart, Pie, Cell, Label } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import type { ChartConfig } from '@/components/ui/chart';
import { DashboardMetrics } from '@/utils/types';
import { formatNumber } from '@/utils/utils';

interface ClientsSectionProps {
  metrics: DashboardMetrics;
}

const barChartConfig = {
  count: { label: 'Requests', color: 'var(--primary)' },
} satisfies ChartConfig;

const UA_COLORS = [
  'var(--primary)',
  'var(--chart-2)',
  'var(--chart-3)',
  'var(--chart-4)',
  'var(--chart-5)',
  'var(--muted-foreground)',
];

function ClientsSection({ metrics }: ClientsSectionProps) {
  const ipData = useMemo(() =>
    metrics.topClientIPs.slice(0, 12).map(c => ({
      name: c.ip.length > 18 ? c.ip.slice(0, 18) + '...' : c.ip,
      fullName: c.ip,
      count: c.count,
    })),
    [metrics.topClientIPs]
  );

  const hostData = useMemo(() =>
    metrics.topRequestHosts.slice(0, 12).map(h => ({
      name: h.host.length > 22 ? h.host.slice(0, 22) + '...' : h.host,
      fullName: h.host,
      count: h.count,
    })),
    [metrics.topRequestHosts]
  );

  const addressData = useMemo(() =>
    metrics.topRequestAddresses.slice(0, 12).map(a => ({
      name: a.addr.length > 18 ? a.addr.slice(0, 18) + '...' : a.addr,
      fullName: a.addr,
      count: a.count,
    })),
    [metrics.topRequestAddresses]
  );

  const totalUserAgentRequests = metrics.userAgents.reduce((sum, ua) => sum + ua.count, 0);

  const topUA = metrics.userAgents.slice(0, 6);
  const uaChartConfig = useMemo(() =>
    topUA.reduce<ChartConfig>((acc, ua, idx) => {
      acc[ua.browser] = { label: ua.browser, color: UA_COLORS[idx % UA_COLORS.length] };
      return acc;
    }, {}),
    [topUA]
  );

  const uaPieData = useMemo(() =>
    topUA.map(ua => ({ name: ua.browser, value: ua.count })),
    [topUA]
  );

  return (
    <div className="space-y-6">
      {/* Client Data Tabs with horizontal bar charts */}
      <Card className="hover:shadow-md transition-shadow">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold uppercase tracking-wide">Client Analysis</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="ips" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="ips" className="gap-2">
                <Users className="h-4 w-4" />
                <span className="hidden sm:inline">Client IPs</span>
              </TabsTrigger>
              <TabsTrigger value="hosts" className="gap-2">
                <Globe className="h-4 w-4" />
                <span className="hidden sm:inline">Hosts</span>
              </TabsTrigger>
              <TabsTrigger value="addresses" className="gap-2">
                <Network className="h-4 w-4" />
                <span className="hidden sm:inline">Addresses</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="ips" className="mt-4">
              {ipData.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">No client IP data available</p>
              ) : (
                <ChartContainer config={barChartConfig} className="w-full" style={{ height: Math.max(200, ipData.length * 32) }}>
                  <BarChart data={ipData} layout="vertical" margin={{ top: 0, right: 20, left: 0, bottom: 0 }}>
                    <XAxis type="number" axisLine={false} tickLine={false} />
                    <YAxis type="category" dataKey="name" width={140} axisLine={false} tickLine={false} tick={{ fontSize: 11 }} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Bar dataKey="count" fill="var(--color-count)" radius={[0, 4, 4, 0]} barSize={20} />
                  </BarChart>
                </ChartContainer>
              )}
            </TabsContent>

            <TabsContent value="hosts" className="mt-4">
              {hostData.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">No host data available</p>
              ) : (
                <ChartContainer config={barChartConfig} className="w-full" style={{ height: Math.max(200, hostData.length * 32) }}>
                  <BarChart data={hostData} layout="vertical" margin={{ top: 0, right: 20, left: 0, bottom: 0 }}>
                    <XAxis type="number" axisLine={false} tickLine={false} />
                    <YAxis type="category" dataKey="name" width={170} axisLine={false} tickLine={false} tick={{ fontSize: 11 }} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Bar dataKey="count" fill="var(--color-count)" radius={[0, 4, 4, 0]} barSize={20} />
                  </BarChart>
                </ChartContainer>
              )}
            </TabsContent>

            <TabsContent value="addresses" className="mt-4">
              {addressData.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">No address data available</p>
              ) : (
                <ChartContainer config={barChartConfig} className="w-full" style={{ height: Math.max(200, addressData.length * 32) }}>
                  <BarChart data={addressData} layout="vertical" margin={{ top: 0, right: 20, left: 0, bottom: 0 }}>
                    <XAxis type="number" axisLine={false} tickLine={false} />
                    <YAxis type="category" dataKey="name" width={140} axisLine={false} tickLine={false} tick={{ fontSize: 11 }} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Bar dataKey="count" fill="var(--color-count)" radius={[0, 4, 4, 0]} barSize={20} />
                  </BarChart>
                </ChartContainer>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* User Agents - Donut + List */}
      <Card className="hover:shadow-md transition-shadow">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-semibold uppercase tracking-wide">User Agents</CardTitle>
          <Monitor className="h-5 w-5 text-primary" />
        </CardHeader>
        <CardContent>
          {metrics.userAgents.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No user agent data available</p>
          ) : (
            <div className="flex flex-col lg:flex-row items-start gap-6">
              {/* Donut chart */}
              <ChartContainer config={uaChartConfig} className="h-48 w-48 shrink-0 mx-auto lg:mx-0">
                <PieChart>
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Pie
                    data={uaPieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={70}
                    paddingAngle={2}
                    dataKey="value"
                    nameKey="name"
                  >
                    {uaPieData.map((_, index) => (
                      <Cell key={index} fill={UA_COLORS[index % UA_COLORS.length]} />
                    ))}
                    <Label
                      content={({ viewBox }) => {
                        if (viewBox && 'cx' in viewBox && 'cy' in viewBox) {
                          return (
                            <text x={viewBox.cx} y={viewBox.cy} textAnchor="middle" dominantBaseline="middle">
                              <tspan x={viewBox.cx} y={viewBox.cy} className="fill-foreground text-xl font-bold">
                                {topUA.length}
                              </tspan>
                              <tspan x={viewBox.cx} y={(viewBox.cy || 0) + 16} className="fill-muted-foreground text-xs">
                                browsers
                              </tspan>
                            </text>
                          );
                        }
                      }}
                    />
                  </Pie>
                </PieChart>
              </ChartContainer>

              {/* User agent list */}
              <div className="flex-1 space-y-2 w-full">
                {metrics.userAgents.slice(0, 10).map((ua, idx) => {
                  const percentage = totalUserAgentRequests > 0 ? (ua.count / totalUserAgentRequests) * 100 : 0;
                  return (
                    <div key={idx} className="flex items-center gap-3 text-sm">
                      <div
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: idx < UA_COLORS.length ? UA_COLORS[idx] : 'var(--muted)' }}
                      />
                      <span className="flex-1 truncate font-medium" title={ua.browser}>{ua.browser}</span>
                      <span className="font-semibold tabular-nums">{formatNumber(ua.count)}</span>
                      <span className="text-muted-foreground tabular-nums w-12 text-right">{percentage.toFixed(1)}%</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          {metrics.userAgents.length > 10 && (
            <p className="text-xs text-muted-foreground text-center mt-4">
              Showing top 10 of {metrics.userAgents.length} user agents
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default memo(ClientsSection);
