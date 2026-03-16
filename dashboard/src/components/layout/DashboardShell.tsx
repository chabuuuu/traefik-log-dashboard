'use client';

import { SidebarProvider, SidebarInset } from '@/components/ui/ui-sidebar';
import { DashboardSidebar } from './DashboardSidebar';
import { DashboardHeader } from './DashboardHeader';

interface DashboardShellProps {
  children: React.ReactNode;
  title?: string;
  connected?: boolean;
  lastUpdate?: Date | null;
  isPaused?: boolean;
  onTogglePause?: () => void;
  logsCount?: number;
  showControls?: boolean;
  agentName?: string | null;
  hideInternalTraffic?: boolean;
  onToggleHideInternalTraffic?: () => void;
  onLoadRecent?: () => void;
  dedupeDebug?: {
    received: number;
    kept: number;
    dropped: number;
    dropRate: number;
  } | null;
}

export function DashboardShell({
  children,
  title,
  connected,
  lastUpdate,
  isPaused,
  onTogglePause,
  logsCount,
  showControls = false,
  agentName,
  hideInternalTraffic,
  onToggleHideInternalTraffic,
  onLoadRecent,
  dedupeDebug,
}: DashboardShellProps) {
  return (
    <SidebarProvider>
      <DashboardSidebar />
      <SidebarInset>
        <DashboardHeader
          title={title}
          connected={connected}
          lastUpdate={lastUpdate}
          isPaused={isPaused}
          onTogglePause={onTogglePause}
          logsCount={logsCount}
          showControls={showControls}
          agentName={agentName}
          hideInternalTraffic={hideInternalTraffic}
          onToggleHideInternalTraffic={onToggleHideInternalTraffic}
          onLoadRecent={onLoadRecent}
          dedupeDebug={dedupeDebug}
        />
        <div className="flex-1 overflow-auto p-4 md:p-6">
          {children}
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
