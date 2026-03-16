'use client';

import { memo } from 'react';
import { Radio } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { TraefikLog } from '@/utils/types';

interface LiveEventFeedProps {
  logs: TraefikLog[];
  maxItems?: number;
}

function getMethodColor(method: string): string {
  switch (method?.toUpperCase()) {
    case 'GET': return 'bg-info-muted text-info';
    case 'POST': return 'bg-success-muted text-success';
    case 'PUT': return 'bg-warning-muted text-warning';
    case 'DELETE': return 'bg-destructive-muted text-destructive';
    case 'PATCH': return 'bg-accent text-accent-foreground';
    default: return 'bg-muted text-muted-foreground';
  }
}

function getStatusVariant(status: number): 'success' | 'info' | 'warning' | 'destructive' | 'secondary' {
  if (status >= 200 && status < 300) return 'success';
  if (status >= 300 && status < 400) return 'info';
  if (status >= 400 && status < 500) return 'warning';
  if (status >= 500) return 'destructive';
  return 'secondary';
}

function formatTime(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  } catch {
    return dateStr;
  }
}

function formatDuration(ns: number): string {
  if (!ns || ns === 0) return '-';
  if (ns < 1000) return `${ns}ns`;
  if (ns < 1000000) return `${(ns / 1000).toFixed(1)}µs`;
  if (ns < 1000000000) return `${(ns / 1000000).toFixed(1)}ms`;
  return `${(ns / 1000000000).toFixed(2)}s`;
}

function LiveEventFeed({ logs, maxItems = 10 }: LiveEventFeedProps) {
  const recentLogs = logs.slice(0, maxItems);

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="pb-2">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="relative">
              <div className="w-2 h-2 bg-success rounded-full" />
              <div className="absolute inset-0 w-2 h-2 bg-success rounded-full animate-ping opacity-75" />
            </div>
            <span className="text-xs font-semibold uppercase text-success">Live</span>
          </div>
          <CardTitle className="text-sm font-semibold uppercase tracking-wide">
            Event Feed
          </CardTitle>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {recentLogs.length === 0 ? (
          <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
            <Radio className="h-5 w-5 mr-2 opacity-50" />
            Waiting for events...
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-24">Time</TableHead>
                <TableHead className="w-16">Method</TableHead>
                <TableHead>Path</TableHead>
                <TableHead className="w-16">Status</TableHead>
                <TableHead className="w-20 text-right">Duration</TableHead>
                <TableHead className="w-28">Service</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recentLogs.map((log, idx) => (
                <TableRow key={`${log.StartLocal || log.StartUTC}-${idx}`} className="text-xs">
                  <TableCell className="text-muted-foreground tabular-nums py-2">
                    {formatTime(log.StartLocal || log.StartUTC)}
                  </TableCell>
                  <TableCell className="py-2">
                    <Badge className={`text-[10px] px-1.5 py-0 ${getMethodColor(log.RequestMethod)}`}>
                      {log.RequestMethod}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-mono truncate max-w-[300px] py-2" title={log.RequestPath}>
                    {log.RequestPath}
                  </TableCell>
                  <TableCell className="py-2">
                    <Badge variant={getStatusVariant(log.DownstreamStatus)} className="text-[10px] px-1.5 py-0">
                      {log.DownstreamStatus}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground tabular-nums py-2">
                    {formatDuration(log.Duration)}
                  </TableCell>
                  <TableCell className="truncate max-w-[120px] text-muted-foreground py-2" title={log.ServiceName}>
                    {log.ServiceName || '-'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

export default memo(LiveEventFeed);
