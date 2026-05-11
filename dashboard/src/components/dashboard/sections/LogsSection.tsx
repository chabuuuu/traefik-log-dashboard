'use client';

import { memo, useState } from 'react';
import { AlertCircle, Clock, Calendar, Search } from 'lucide-react';
import { type ColumnDef } from '@tanstack/react-table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DataTable } from '@/components/dashboard/cards/DataTable';
import LogDetailSheet from '@/components/dashboard/cards/LogDetailSheet';
import { TraefikLog, ErrorLog } from '@/utils/types';
import { formatNumber } from '@/utils/utils';

interface LogsSectionProps {
  logs: TraefikLog[];
  errors: ErrorLog[];
  agentId?: string;
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
    // Show full date and time in the user's local timezone
    return new Date(dateStr).toLocaleString();
  } catch {
    return dateStr;
  }
}

const columns: ColumnDef<TraefikLog, unknown>[] = [
  {
    accessorFn: (row) => row.StartLocal || row.StartUTC,
    id: 'time',
    header: 'Time',
    size: 150,
    cell: ({ getValue }) => (
      <span className="text-xs text-muted-foreground tabular-nums whitespace-nowrap">
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
      <span className="font-mono text-xs truncate block w-full" title={getValue() as string}>
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
      <span className="text-xs truncate block w-full" title={(getValue() as string) || ''}>
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
      <span className="text-xs truncate block w-full" title={(getValue() as string) || ''}>
        {(getValue() as string) || '-'}
      </span>
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
      <span className="text-xs truncate block w-full" title={(getValue() as string) || ''}>
        {(getValue() as string) || '-'}
      </span>
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

function LogsSection({ logs, errors, agentId }: LogsSectionProps) {
  const [selectedLog, setSelectedLog] = useState<TraefikLog | null>(null);
  
  // Custom query state
  const [isCustomMode, setIsCustomMode] = useState(false);
  const [fromDate, setFromDate] = useState<string>('');
  const [toDate, setToDate] = useState<string>('');
  const [limit, setLimit] = useState<string>('100');
  const [customLogs, setCustomLogs] = useState<TraefikLog[]>([]);
  const [isLoadingCustom, setIsLoadingCustom] = useState(false);
  const [customError, setCustomError] = useState<string | null>(null);

  const fetchCustomLogs = async () => {
    setIsLoadingCustom(true);
    setCustomError(null);
    try {
      const { apiClient } = await import('@/utils/api-client');
      const response = await apiClient.getAccessLogs({
        agentId: agentId || '',
        from: fromDate ? new Date(fromDate).toISOString() : undefined,
        to: toDate ? new Date(toDate).toISOString() : undefined,
        lines: parseInt(limit) || 100,
      });
      setCustomLogs(response.logs || []);
    } catch (err: any) {
      setCustomError(err.message || 'Failed to fetch custom logs');
    } finally {
      setIsLoadingCustom(false);
    }
  };

  const setQuickRange = (minutesAgo: number) => {
    const now = new Date();
    const from = new Date(now.getTime() - minutesAgo * 60000);
    
    const formatForInput = (d: Date) => {
      return new Date(d.getTime() - (d.getTimezoneOffset() * 60000))
        .toISOString()
        .slice(0, 16);
    };
    
    setFromDate(formatForInput(from));
    setToDate(formatForInput(now));
  };

  const displayLogs = isCustomMode ? customLogs : logs;

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
        <CardHeader className="flex flex-col space-y-4 pb-4 border-b border-border/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <CardTitle className="text-sm font-semibold uppercase tracking-wide">Access Logs</CardTitle>
              <Badge variant="outline" className="text-xs tabular-nums">
                {formatNumber(displayLogs.length)} entries
              </Badge>
              {!isCustomMode ? (
                <div className="flex items-center gap-1.5">
                  <div className="relative">
                    <div className="w-2 h-2 bg-success rounded-full" />
                    <div className="absolute inset-0 w-2 h-2 bg-success rounded-full animate-ping opacity-75" />
                  </div>
                  <span className="text-xs font-medium text-success">Live</span>
                </div>
              ) : (
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 bg-primary rounded-full" />
                  <span className="text-xs font-medium text-primary">Custom Query</span>
                </div>
              )}
            </div>
            <Button
              variant={isCustomMode ? "default" : "outline"}
              size="sm"
              onClick={() => setIsCustomMode(!isCustomMode)}
              className="gap-2 h-8"
            >
              <Calendar className="h-3.5 w-3.5" />
              {isCustomMode ? "Back to Live" : "Custom Range"}
            </Button>
          </div>
          
          {isCustomMode && (
            <div className="flex flex-wrap items-end gap-3 pt-2">
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Quick Range</label>
                <select 
                  className="h-8 text-xs rounded-md border border-input bg-background px-3 py-1 flex w-full"
                  onChange={(e) => {
                    if (e.target.value) setQuickRange(Number(e.target.value));
                    e.target.value = ''; // reset after selection
                  }}
                  defaultValue=""
                >
                  <option value="" disabled>Select...</option>
                  <option value="15">Last 15 minutes</option>
                  <option value="60">Last 1 hour</option>
                  <option value="1440">Last 24 hours</option>
                  <option value="10080">Last 7 days</option>
                  <option value="43200">Last 30 days</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">From</label>
                <Input
                  type="datetime-local"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  className="h-8 text-xs w-[190px]"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">To</label>
                <Input
                  type="datetime-local"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  className="h-8 text-xs w-[190px]"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Limit</label>
                <Input
                  type="number"
                  value={limit}
                  onChange={(e) => setLimit(e.target.value)}
                  className="h-8 text-xs w-[80px]"
                  min="1"
                  max="10000"
                />
              </div>
              <Button 
                onClick={fetchCustomLogs} 
                disabled={isLoadingCustom}
                size="sm"
                className="h-8 gap-2"
              >
                {isLoadingCustom ? (
                  <div className="w-3.5 h-3.5 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Search className="h-3.5 w-3.5" />
                )}
                Fetch
              </Button>
              {customError && (
                <span className="text-xs text-destructive ml-2 flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  {customError}
                </span>
              )}
            </div>
          )}
        </CardHeader>
        <CardContent className="pt-4">
          <DataTable
            columns={columns}
            data={displayLogs}
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
