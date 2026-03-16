'use client';

import { memo } from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/badge';
import SparklineChart from '@/components/charts/SparklineChart';

interface KpiCardProps {
  title: string;
  value: string;
  description?: string;
  trend?: number;
  sparklineData?: number[];
  icon: LucideIcon;
  colorVariant?: 'default' | 'success' | 'warning' | 'destructive' | 'info';
}

const variantStyles = {
  default: { text: 'text-foreground', bg: 'bg-muted', sparkColor: 'var(--primary)' },
  success: { text: 'text-success', bg: 'bg-success-muted', sparkColor: 'var(--success)' },
  warning: { text: 'text-warning', bg: 'bg-warning-muted', sparkColor: 'var(--warning)' },
  destructive: { text: 'text-destructive', bg: 'bg-destructive-muted', sparkColor: 'var(--destructive)' },
  info: { text: 'text-info', bg: 'bg-info-muted', sparkColor: 'var(--info)' },
};

function KpiCard({
  title,
  value,
  description,
  trend,
  sparklineData,
  icon: Icon,
  colorVariant = 'default',
}: KpiCardProps) {
  const styles = variantStyles[colorVariant];

  return (
    <Card className="hover:shadow-md transition-shadow overflow-hidden">
      <CardContent className="p-4 pb-0">
        <div className="flex items-start justify-between mb-1">
          <span className="text-sm font-medium text-muted-foreground">{title}</span>
          <div className={`p-1.5 rounded-md ${styles.bg}`}>
            <Icon className={`h-4 w-4 ${styles.text}`} />
          </div>
        </div>
        <div className="flex items-end gap-2 mb-1">
          <span className={`text-2xl font-bold tracking-tight ${styles.text}`}>{value}</span>
          {trend !== undefined && trend !== 0 && (
            <Badge
              variant={trend > 0 ? 'success' : 'destructive'}
              className="text-[10px] px-1.5 py-0 h-5 gap-0.5"
            >
              {trend > 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
              {trend > 0 ? '+' : ''}{trend.toFixed(1)}%
            </Badge>
          )}
        </div>
        {description && (
          <p className="text-xs text-muted-foreground mb-2">{description}</p>
        )}
      </CardContent>
      {sparklineData && sparklineData.length >= 2 && (
        <div className="px-0 -mb-1">
          <SparklineChart data={sparklineData} color={styles.sparkColor} height={40} />
        </div>
      )}
    </Card>
  );
}

export default memo(KpiCard);
