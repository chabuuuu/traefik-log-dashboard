'use client';

import { memo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/badge';

interface Segment {
  label: string;
  count: number;
  color: string;
  variant: 'success' | 'warning' | 'destructive';
}

interface HealthBarProps {
  label: string;
  segments: Segment[];
}

function HealthBar({ label, segments }: HealthBarProps) {
  const total = segments.reduce((sum, s) => sum + s.count, 0);
  const healthPercentage = total > 0
    ? Math.round((segments.find(s => s.variant === 'success')?.count || 0) / total * 100)
    : 100;

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold uppercase tracking-wide">{label}</CardTitle>
          <span className={`text-lg font-bold tabular-nums ${
            healthPercentage >= 80 ? 'text-success' :
            healthPercentage >= 50 ? 'text-warning' :
            'text-destructive'
          }`}>
            {healthPercentage}%
          </span>
        </div>
      </CardHeader>
      <CardContent>
        {/* Segmented bar */}
        <div className="flex h-3 w-full overflow-hidden rounded-full bg-muted">
          {total > 0 && segments.map((segment) => {
            if (segment.count === 0) return null;
            const width = (segment.count / total) * 100;
            return (
              <div
                key={segment.label}
                className="h-full transition-all duration-500"
                style={{
                  width: `${width}%`,
                  backgroundColor: segment.color,
                }}
              />
            );
          })}
        </div>

        {/* Segment badges */}
        <div className="flex items-center gap-3 mt-3">
          {segments.map((segment) => (
            <Badge key={segment.label} variant={segment.variant} className="gap-1.5 text-xs">
              {segment.count} {segment.label}
            </Badge>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export default memo(HealthBar);
