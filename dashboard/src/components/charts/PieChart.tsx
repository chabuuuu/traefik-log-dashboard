'use client';

import React from 'react';
import {
  PieChart as RechartsPieChart,
  Pie,
  Cell,
} from 'recharts';
import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend, ChartLegendContent } from '@/components/ui/chart';
import type { ChartConfig } from '@/components/ui/chart';

interface PieChartProps {
  labels: string[];
  data: number[];
  backgroundColor?: string[];
  height?: number;
}

const defaultColors = [
  'var(--primary)',
  'var(--chart-2)',
  'var(--chart-3)',
  'var(--chart-4)',
  'var(--chart-5)',
  'var(--muted)',
];

function PieChart({
  labels,
  data,
  backgroundColor = defaultColors,
  height = 300,
}: PieChartProps) {
  const chartData = labels.map((label, index) => ({
    name: label,
    value: data[index] || 0,
  }));

  const chartConfig = labels.reduce<ChartConfig>((acc, label, idx) => {
    acc[label] = {
      label,
      color: backgroundColor[idx % backgroundColor.length],
    };
    return acc;
  }, {});

  return (
    <ChartContainer config={chartConfig} className="w-full" style={{ height }}>
      <RechartsPieChart>
        <Pie
          data={chartData}
          cx="50%"
          cy="50%"
          innerRadius={60}
          outerRadius={80}
          paddingAngle={2}
          dataKey="value"
          nameKey="name"
        >
          {chartData.map((_, index) => (
            <Cell
              key={`cell-${index}`}
              fill={backgroundColor[index % backgroundColor.length]}
            />
          ))}
        </Pie>
        <ChartTooltip content={<ChartTooltipContent />} />
        <ChartLegend
          layout="vertical"
          align="right"
          verticalAlign="middle"
          content={<ChartLegendContent nameKey="name" />}
        />
      </RechartsPieChart>
    </ChartContainer>
  );
}

export default React.memo(PieChart);
