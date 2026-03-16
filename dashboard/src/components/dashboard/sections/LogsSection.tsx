'use client';

import { memo, useState } from 'react';
import { AlertCircle, Clock } from 'lucide-react';
import { type ColumnDef } from '@tanstack/react-table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/badge';
import { DataTable } from '@/components/dashboard/cards/DataTable';
import LogDetailSheet from '@/components/dashboard/cards/LogDetailSheet';
import { TraefikLog, ErrorLog } from '@/utils/types';
import { formatNumber } from '@/utils/utils';

interface LogsSectionProps {
  logs: TraefikLog[];
  errors: ErrorLog[];
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

function formatDuration(ns: number): string {
  if (!ns || ns === 0) return '-';
  if (ns < 1000) return `${ns}ns`;
  if (ns < 1000000) return `${(ns / 1000).toFixed(1)}µs`;
  if (ns < 1000000000) return `${(ns / 1000000).toFixed(1)}ms`;
  return `${(ns / 1000000000).toFixed(2)}s`;
}

function formatTime(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleTimeString();
  } catch {
    return dateStr;
  }
}

const columns: ColumnDef<TraefikLog, unknown>[] = [
  {
    accessorFn: (row) => row.StartLocal || row.StartUTC,
    id: 'time',
    header: 'Time',
    size: 90,
    cell: ({ getValue }) => (
      <span className="text-xs text-muted-foreground tabular-nums">
        {formatTime(getValue() as string)}
      </span>
    ),
  },
  {
    accessorFn: (row) => row.ClientHost || row.ClientAddr,
    id: 'clientIP',
    header: 'Client IP',
    size: 120,
    cell: ({ getValue }) => (
      <span className="font-mono text-xs">{getValue() as string}</span>
    ),
  },
  {
    accessorKey: 'RequestMethod',
    header: 'Method',
    size: 75,
    cell: ({ getValue }) => (
      <Badge className={`text-[10px] px-1.5 py-0 ${getMethodColor(getValue() as string)}`}>
        {getValue() as string}
      </Badge>
    ),
  },
  {
    accessorKey: 'RequestPath',
    header: 'Path',
    size: 250,
    cell: ({ getValue }) => (
      <span className="font-mono text-xs truncate block max-w-[240px]" title={getValue() as string}>
        {getValue() as string}
      </span>
    ),
  },
  {
    accessorKey: 'DownstreamStatus',
    header: 'Status',
    size: 65,
    cell: ({ getValue }) => {
      const status = getValue() as number;
      return (
        <Badge variant={getStatusVariant(status)} className="text-[10px] px-1.5 py-0">
          {status}
        </Badge>
      );
    },
  },
  {
    accessorKey: 'Duration',
    header: 'Duration',
    size: 85,
    cell: ({ getValue }) => (
      <span className="text-xs text-muted-foreground tabular-nums">
        {formatDuration(getValue() as number)}
      </span>
    ),
  },
  {
    accessorKey: 'ServiceName',
    header: 'Service',
    size: 120,
    cell: ({ getValue }) => (
      <span className="text-xs truncate block max-w-[110px]" title={(getValue() as string) || ''}>
        {(getValue() as string) || '-'}
      </span>
    ),
  },
  {
    accessorKey: 'RouterName',
    header: 'Router',
    size: 110,
    enableHiding: true,
    cell: ({ getValue }) => (
      <span className="text-xs truncate block max-w-[100px]">{(getValue() as string) || '-'}</span>
    ),
  },
  {
    accessorKey: 'geoCountry',
    header: 'Country',
    size: 100,
    enableHiding: true,
    cell: ({ getValue }) => (
      <span className="text-xs">{(getValue() as string) || '-'}</span>
    ),
  },
  {
    accessorKey: 'geoCity',
    header: 'City',
    size: 100,
    enableHiding: true,
    cell: ({ getValue }) => (
      <span className="text-xs">{(getValue() as string) || '-'}</span>
    ),
  },
  {
    accessorKey: 'RequestHost',
    header: 'Host',
    size: 110,
    enableHiding: true,
    cell: ({ getValue }) => (
      <span className="text-xs truncate block max-w-[100px]">{(getValue() as string) || '-'}</span>
    ),
  },
  {
    accessorKey: 'DownstreamContentSize',
    header: 'Size',
    size: 80,
    enableHiding: true,
    cell: ({ getValue }) => {
      const size = getValue() as number;
      return (
        <span className="text-xs text-muted-foreground tabular-nums">
          {size ? `${(size / 1024).toFixed(1)}KB` : '-'}
        </span>
      );
    },
  },
];

const defaultHiddenColumns = {
  RouterName: false,
  geoCountry: false,
  geoCity: false,
  RequestHost: false,
  DownstreamContentSize: false,
};

function LogsSection({ logs, errors }: LogsSectionProps) {
  const [selectedLog, setSelectedLog] = useState<TraefikLog | null>(null);

  return (
    <div className="space-y-6">
      {/* Errors Card */}
      <Card className="hover:shadow-md transition-shadow">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-semibold uppercase tracking-wide">Recent Errors</CardTitle>
          <AlertCircle className="h-5 w-5 text-destructive" />
        </CardHeader>
        <CardContent>
          {errors.length === 0 ? (
            <div className="flex items-center justify-center py-6 text-sm text-muted-foreground">
              <div className="text-center">
                <div className="w-10 h-10 rounded-full bg-success-muted flex items-center justify-center mx-auto mb-2">
                  <AlertCircle className="h-5 w-5 text-success" />
                </div>
                <p>No errors recorded</p>
              </div>
            </div>
          ) : (
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {errors.slice(0, 10).map((error, idx) => (
                <div key={idx} className="flex items-start gap-3 p-2.5 rounded-lg bg-destructive-muted/50 border border-destructive/20">
                  <div className="w-1.5 h-1.5 rounded-full bg-destructive mt-1.5 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <Badge variant={error.level === 'error' ? 'destructive' : 'warning'} className="text-[10px] px-1.5 py-0">
                        {error.level}
                      </Badge>
                      <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                        <Clock className="h-2.5 w-2.5" />
                        {formatTime(error.timestamp)}
                      </span>
                    </div>
                    <p className="text-xs font-mono text-foreground truncate">{error.message}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Logs DataTable */}
      <Card className="hover:shadow-md transition-shadow">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <div className="flex items-center gap-3">
            <CardTitle className="text-sm font-semibold uppercase tracking-wide">Recent Logs</CardTitle>
            <Badge variant="outline" className="text-xs tabular-nums">
              {formatNumber(logs.length)} entries
            </Badge>
            <div className="flex items-center gap-1.5">
              <div className="relative">
                <div className="w-2 h-2 bg-success rounded-full" />
                <div className="absolute inset-0 w-2 h-2 bg-success rounded-full animate-ping opacity-75" />
              </div>
              <span className="text-xs font-medium text-success">Live</span>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={columns}
            data={logs}
            searchKey="RequestPath"
            searchPlaceholder="Search by path, IP, service..."
            onRowClick={setSelectedLog}
            defaultColumnVisibility={defaultHiddenColumns}
            virtualizeRows
            rowHeight={40}
            maxHeight="450px"
          />
        </CardContent>
      </Card>

      <LogDetailSheet
        log={selectedLog}
        open={!!selectedLog}
        onOpenChange={(open) => !open && setSelectedLog(null)}
      />
    </div>
  );
}

export default memo(LogsSection);
