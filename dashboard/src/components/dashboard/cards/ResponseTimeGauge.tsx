'use client';

import { memo } from 'react';
import { RadialBarChart, RadialBar, PolarAngleAxis } from 'recharts';
import { ChartContainer } from '@/components/ui/chart';
import type { ChartConfig } from '@/components/ui/chart';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';

interface ResponseTimeGaugeProps {
  average: number;
  p95: number;
  p99: number;
  samples: number;
}

function getColor(ms: number): string {
  if (ms < 100) return 'var(--success)';
  if (ms < 500) return 'var(--warning)';
  return 'var(--destructive)';
}

function getTextColor(ms: number): string {
  if (ms < 100) return 'text-success';
  if (ms < 500) return 'text-warning';
  return 'text-destructive';
}

const MAX_MS = 2000;

function GaugeItem({ label, description, value }: { label: string; description: string; value: number }) {
  const color = getColor(value);
  const textColor = getTextColor(value);
  const percentage = Math.min((value / MAX_MS) * 100, 100);

  const chartConfig = {
    value: { label, color },
  } satisfies ChartConfig;

  const data = [{ name: label, value: percentage, fill: color }];

  return (
    <div className="flex flex-col items-center">
      <ChartContainer config={chartConfig} className="h-28 w-28">
        <RadialBarChart
          cx="50%"
          cy="50%"
          innerRadius="70%"
          outerRadius="100%"
          startAngle={180}
          endAngle={0}
          data={data}
          barSize={8}
        >
          <PolarAngleAxis type="number" domain={[0, 100]} angleAxisId={0} tick={false} />
          <RadialBar
            dataKey="value"
            cornerRadius={4}
            background={{ fill: 'var(--muted)' }}
          />
          <text x="50%" y="55%" textAnchor="middle" dominantBaseline="middle">
            <tspan className={`text-xl font-bold fill-current ${textColor}`} style={{ fill: color }}>
              {value.toFixed(0)}
            </tspan>
            <tspan className="text-xs fill-muted-foreground" dx="2">ms</tspan>
          </text>
        </RadialBarChart>
      </ChartContainer>
      <div className="text-center -mt-4">
        <p className="text-sm font-semibold">{label}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}

function ResponseTimeGauge({ average, p95, p99, samples }: ResponseTimeGaugeProps) {
  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold uppercase tracking-wide">
          Response Time Percentiles
        </CardTitle>
        {samples === 0 && (
          <p className="text-xs text-muted-foreground mt-1 normal-case tracking-normal">
            Duration is unavailable for this interval (generic CLF lines may omit it).
          </p>
        )}
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-3 gap-2">
          <GaugeItem label="Average" description="Mean response time" value={average} />
          <GaugeItem label="P95" description="95% of requests" value={p95} />
          <GaugeItem label="P99" description="99% of requests" value={p99} />
        </div>
      </CardContent>
    </Card>
  );
}

export default memo(ResponseTimeGauge);
