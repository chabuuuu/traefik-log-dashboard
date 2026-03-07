'use client';

import { memo } from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import type { TraefikLog } from '@/utils/types';

interface LogDetailSheetProps {
  log: TraefikLog | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function getStatusVariant(status: number): 'success' | 'info' | 'warning' | 'destructive' | 'secondary' {
  if (status >= 200 && status < 300) return 'success';
  if (status >= 300 && status < 400) return 'info';
  if (status >= 400 && status < 500) return 'warning';
  if (status >= 500) return 'destructive';
  return 'secondary';
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

function formatDuration(ns: number): string {
  if (!ns || ns === 0) return '-';
  if (ns < 1000) return `${ns}ns`;
  if (ns < 1000000) return `${(ns / 1000).toFixed(1)}µs`;
  if (ns < 1000000000) return `${(ns / 1000000).toFixed(1)}ms`;
  return `${(ns / 1000000000).toFixed(2)}s`;
}

function Field({ label, value }: { label: string; value: string | number | undefined }) {
  if (!value && value !== 0) return null;
  return (
    <div className="flex items-start justify-between gap-4 py-1.5">
      <span className="text-xs text-muted-foreground shrink-0">{label}</span>
      <span className="text-xs font-mono text-right break-all">{String(value)}</span>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">{title}</h4>
      <div className="rounded-lg border bg-muted/30 px-3 py-1">
        {children}
      </div>
    </div>
  );
}

function LogDetailSheet({ log, open, onOpenChange }: LogDetailSheetProps) {
  if (!log) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[400px] sm:w-[480px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Badge className={`${getMethodColor(log.RequestMethod)}`}>{log.RequestMethod}</Badge>
            <Badge variant={getStatusVariant(log.DownstreamStatus)}>{log.DownstreamStatus}</Badge>
          </SheetTitle>
          <SheetDescription className="font-mono text-xs break-all">
            {log.RequestPath}
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-4 mt-6">
          <Section title="Request">
            <Field label="Method" value={log.RequestMethod} />
            <Field label="Path" value={log.RequestPath} />
            <Field label="Host" value={log.RequestHost} />
            <Field label="Protocol" value={log.RequestProtocol} />
            <Field label="Scheme" value={log.RequestScheme} />
            <Field label="Port" value={log.RequestPort} />
            <Field label="Content Size" value={log.RequestContentSize ? `${log.RequestContentSize} bytes` : undefined} />
          </Section>

          <Section title="Response">
            <Field label="Status" value={log.DownstreamStatus} />
            <Field label="Duration" value={formatDuration(log.Duration)} />
            <Field label="Content Size" value={log.DownstreamContentSize ? `${(log.DownstreamContentSize / 1024).toFixed(1)} KB` : undefined} />
            <Field label="Content Type" value={log["downstream_Content-Type"]} />
          </Section>

          <Section title="Routing">
            <Field label="Router" value={log.RouterName} />
            <Field label="Service" value={log.ServiceName} />
            <Field label="Service Address" value={log.ServiceAddr} />
            <Field label="Service URL" value={log.ServiceURL} />
            <Field label="Entry Point" value={log.entryPointName} />
          </Section>

          <Section title="Client">
            <Field label="Address" value={log.ClientAddr} />
            <Field label="Host" value={log.ClientHost} />
            <Field label="Port" value={log.ClientPort} />
            <Field label="Username" value={log.ClientUsername} />
            <Field label="Country" value={log.geoCountry} />
            <Field label="City" value={log.geoCity} />
          </Section>

          <Section title="Timing">
            <Field label="Start (Local)" value={log.StartLocal} />
            <Field label="Start (UTC)" value={log.StartUTC} />
            <Field label="Duration" value={formatDuration(log.Duration)} />
          </Section>
        </div>
      </SheetContent>
    </Sheet>
  );
}

export default memo(LogDetailSheet);
