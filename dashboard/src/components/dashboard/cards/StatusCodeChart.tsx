'use client';

import { memo } from 'react';
import { PieChart, Pie, Cell, Label } from 'recharts';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import type { ChartConfig } from '@/components/ui/chart';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { formatNumber } from '@/utils/utils';

interface StatusCodeChartProps {
  status2xx: number;
  status3xx: number;
  status4xx: number;
  status5xx: number;
  errorRate: number;
}

const chartConfig = {
  '2xx': { label: '2xx Success', color: 'var(--success)' },
  '3xx': { label: '3xx Redirect', color: 'var(--info)' },
  '4xx': { label: '4xx Client Error', color: 'var(--warning)' },
  '5xx': { label: '5xx Server Error', color: 'var(--destructive)' },
} satisfies ChartConfig;

const COLORS = ['var(--success)', 'var(--info)', 'var(--warning)', 'var(--destructive)'];

function StatusCodeChart({ status2xx, status3xx, status4xx, status5xx, errorRate }: StatusCodeChartProps) {
  const total = status2xx + status3xx + status4xx + status5xx;

  const data = [
    { name: '2xx', value: status2xx },
    { name: '3xx', value: status3xx },
    { name: '4xx', value: status4xx },
    { name: '5xx', value: status5xx },
  ].filter(d => d.value > 0);

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold uppercase tracking-wide">
          Status Code Distribution
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-6">
          <ChartContainer config={chartConfig} className="h-48 w-48 shrink-0">
            <PieChart>
              <ChartTooltip content={<ChartTooltipContent />} />
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={55}
                outerRadius={75}
                paddingAngle={2}
                dataKey="value"
                nameKey="name"
              >
                {data.map((entry, index) => {
                  const originalIndex = ['2xx', '3xx', '4xx', '5xx'].indexOf(entry.name);
                  return (
                    <Cell key={entry.name} fill={COLORS[originalIndex]} />
                  );
                })}
                <Label
                  content={({ viewBox }) => {
                    if (viewBox && 'cx' in viewBox && 'cy' in viewBox) {
                      return (
                        <text x={viewBox.cx} y={viewBox.cy} textAnchor="middle" dominantBaseline="middle">
                          <tspan x={viewBox.cx} y={viewBox.cy} className="fill-foreground text-2xl font-bold">
                            {formatNumber(total)}
                          </tspan>
                          <tspan x={viewBox.cx} y={(viewBox.cy || 0) + 18} className="fill-muted-foreground text-xs">
                            total
                          </tspan>
                        </text>
                      );
                    }
                  }}
                />
              </Pie>
            </PieChart>
          </ChartContainer>
          <div className="flex-1 space-y-3">
            {[
              { label: '2xx Success', value: status2xx, color: 'bg-success', textColor: 'text-success' },
              { label: '3xx Redirect', value: status3xx, color: 'bg-info', textColor: 'text-info' },
              { label: '4xx Client Error', value: status4xx, color: 'bg-warning', textColor: 'text-warning' },
              { label: '5xx Server Error', value: status5xx, color: 'bg-destructive', textColor: 'text-destructive' },
            ].map((item) => {
              const pct = total > 0 ? ((item.value / total) * 100).toFixed(1) : '0.0';
              return (
                <div key={item.label} className="flex items-center gap-3 text-sm">
                  <div className={`w-2.5 h-2.5 rounded-full ${item.color} shrink-0`} />
                  <span className="text-muted-foreground flex-1">{item.label}</span>
                  <span className="font-semibold tabular-nums">{formatNumber(item.value)}</span>
                  <span className="text-muted-foreground tabular-nums w-12 text-right">{pct}%</span>
                </div>
              );
            })}
            <div className="pt-3 border-t flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Error Rate</span>
              <span className={`text-lg font-bold tabular-nums ${errorRate > 5 ? 'text-destructive' : 'text-success'}`}>
                {errorRate.toFixed(2)}%
              </span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default memo(StatusCodeChart);
