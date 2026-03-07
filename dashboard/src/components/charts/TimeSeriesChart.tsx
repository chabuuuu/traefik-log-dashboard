'use client';

import React from 'react';
import {
  Area,
  AreaChart,
  XAxis,
  YAxis,
  CartesianGrid,
} from 'recharts';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import type { ChartConfig } from '@/components/ui/chart';
import { TimeSeriesPoint } from '@/utils/types';

const chartConfig = {
  requests: {
    label: 'Requests',
    color: 'var(--primary)',
  },
} satisfies ChartConfig;

interface TimeSeriesChartProps {
  data: TimeSeriesPoint[];
}

function TimeSeriesChart({ data }: TimeSeriesChartProps) {
  const chartData = data.map(point => ({
    time: new Date(point.timestamp).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    }),
    requests: point.value,
  }));

  return (
    <ChartContainer config={chartConfig} className="h-64 w-full">
      <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="colorRequests" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="var(--color-requests)" stopOpacity={0.3} />
            <stop offset="95%" stopColor="var(--color-requests)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid
          strokeDasharray="3 3"
          vertical={false}
        />
        <XAxis
          dataKey="time"
          axisLine={false}
          tickLine={false}
          tickMargin={8}
        />
        <YAxis
          axisLine={false}
          tickLine={false}
          tickMargin={8}
          allowDecimals={false}
        />
        <ChartTooltip content={<ChartTooltipContent />} />
        <Area
          type="monotone"
          dataKey="requests"
          stroke="var(--color-requests)"
          strokeWidth={2}
          fill="url(#colorRequests)"
          dot={false}
          activeDot={{ r: 4, fill: 'var(--color-requests)' }}
        />
      </AreaChart>
    </ChartContainer>
  );
}

export default React.memo(TimeSeriesChart);
