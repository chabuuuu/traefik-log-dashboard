'use client';

import React from 'react';
import {
  Bar,
  BarChart as RechartsBarChart,
  XAxis,
  YAxis,
  CartesianGrid,
} from 'recharts';
import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend, ChartLegendContent } from '@/components/ui/chart';
import type { ChartConfig } from '@/components/ui/chart';

interface Dataset {
  label: string;
  data: number[];
  backgroundColor?: string | string[];
  borderColor?: string | string[];
  borderWidth?: number;
}

interface BarChartProps {
  labels: string[];
  datasets: Dataset[];
  height?: number;
}

const defaultColors = [
  'var(--primary)',
  'var(--chart-2)',
  'var(--chart-3)',
  'var(--chart-4)',
  'var(--chart-5)',
];

function BarChart({ labels, datasets, height = 300 }: BarChartProps) {
  const chartData = labels.map((label, index) => {
    const point: Record<string, string | number> = { name: label };
    datasets.forEach(dataset => {
      point[dataset.label] = dataset.data[index] || 0;
    });
    return point;
  });

  const chartConfig = datasets.reduce<ChartConfig>((acc, dataset, idx) => {
    const fill = Array.isArray(dataset.backgroundColor)
      ? dataset.backgroundColor[0]
      : dataset.backgroundColor || defaultColors[idx % defaultColors.length];
    acc[dataset.label] = {
      label: dataset.label,
      color: fill,
    };
    return acc;
  }, {});

  return (
    <ChartContainer config={chartConfig} className="w-full" style={{ height }}>
      <RechartsBarChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
        <CartesianGrid
          strokeDasharray="3 3"
          vertical={false}
        />
        <XAxis
          dataKey="name"
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
        {datasets.length > 1 && (
          <ChartLegend content={<ChartLegendContent />} />
        )}
        {datasets.map((dataset, idx) => (
          <Bar
            key={dataset.label}
            dataKey={dataset.label}
            fill={`var(--color-${dataset.label})`}
            radius={[4, 4, 0, 0]}
          />
        ))}
      </RechartsBarChart>
    </ChartContainer>
  );
}

export default React.memo(BarChart);
