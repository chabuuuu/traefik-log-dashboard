'use client';

import { Moon, Sun, Wifi, WifiOff, Pause, Play, RefreshCw, FilterX, RotateCcw, Palette } from 'lucide-react';
import { useTheme } from 'next-themes';
import { SidebarTrigger } from '@/components/ui/ui-sidebar';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
} from '@/components/ui/breadcrumb';
import { Badge } from '@/components/ui/badge';
import AgentSelector from '@/components/ui/AgentSelector';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface DashboardHeaderProps {
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

export function DashboardHeader({
  title = 'Dashboard',
  connected = true,
  lastUpdate,
  isPaused = false,
  onTogglePause,
  logsCount,
  showControls = false,
  agentName,
  hideInternalTraffic = false,
  onToggleHideInternalTraffic,
  onLoadRecent,
  dedupeDebug,
}: DashboardHeaderProps) {
  const { theme, setTheme } = useTheme();

  return (
    <header className="flex h-14 shrink-0 items-center gap-3 border-b px-4">
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="mr-1 h-4" />
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbPage className="font-medium no-underline decoration-transparent">{title}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="ml-auto flex items-center gap-2">
        {showControls && (
          <>
            {/* Connection Status */}
            <div className="flex items-center gap-2">
              {connected ? (
                <Badge variant="outline" className="gap-1.5 text-success border-success/30 bg-success-muted">
                  <Wifi className="h-3 w-3" />
                  <span className="hidden sm:inline">Connected</span>
                </Badge>
              ) : (
                <Badge variant="outline" className="gap-1.5 text-destructive border-destructive/30 bg-destructive-muted">
                  <WifiOff className="h-3 w-3" />
                  <span className="hidden sm:inline">Disconnected</span>
                </Badge>
              )}
            </div>

            {/* Agent Name */}
            {agentName && (
              <Badge variant="secondary" className="hidden md:flex">
                {agentName}
              </Badge>
            )}

            {/* Logs Count */}
            {logsCount !== undefined && logsCount > 0 && (
              <Badge variant="outline" className="hidden sm:flex">
                {logsCount.toLocaleString()} logs
              </Badge>
            )}

            {import.meta.env.DEV && dedupeDebug && dedupeDebug.received > 0 && (
              <Badge variant="outline" className="hidden xl:flex text-warning border-warning/30 bg-warning-muted">
                Dedupe drop {dedupeDebug.dropRate.toFixed(1)}% ({dedupeDebug.dropped}/{dedupeDebug.received})
              </Badge>
            )}

            {/* Last Update */}
            {lastUpdate && (
              <span className="text-xs text-muted-foreground hidden lg:flex items-center gap-1">
                <RefreshCw className="h-3 w-3" />
                {lastUpdate.toLocaleTimeString()}
              </span>
            )}

            {/* Load Recent Button */}
            {onLoadRecent && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onLoadRecent}
                className="h-8 gap-1.5"
                title="Load recent logs (reset position and fetch tail)"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                <span className="hidden lg:inline">Load recent</span>
              </Button>
            )}

            {/* Pause/Resume Button */}
            {onTogglePause && (
              <Button
                variant="ghost"
                size="icon"
                onClick={onTogglePause}
                className="h-8 w-8"
                title={isPaused ? 'Resume updates' : 'Pause updates'}
              >
                {isPaused ? (
                  <Play className="h-4 w-4 text-success" />
                ) : (
                  <Pause className="h-4 w-4" />
                )}
              </Button>
            )}

            {onToggleHideInternalTraffic && (
              <Button
                variant={hideInternalTraffic ? 'default' : 'outline'}
                size="sm"
                onClick={onToggleHideInternalTraffic}
                className="h-8 gap-1.5"
                title={hideInternalTraffic ? 'Showing only non-internal traffic' : 'Hide dashboard and agent internal traffic'}
              >
                <FilterX className="h-3.5 w-3.5" />
                <span className="hidden lg:inline">
                  {hideInternalTraffic ? 'Internal Hidden' : 'Hide Internal'}
                </span>
              </Button>
            )}

            <Separator orientation="vertical" className="h-4" />
          </>
        )}

        {/* Agent Selector */}
        <AgentSelector />

        {/* Theme Toggle */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <Palette className="h-4 w-4" />
              <span className="sr-only">Select theme</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => setTheme('light')}>Light</DropdownMenuItem>
            <DropdownMenuItem onClick={() => setTheme('dark')}>Dark</DropdownMenuItem>
            <DropdownMenuItem onClick={() => setTheme('dracula')}>Dracula</DropdownMenuItem>
            <DropdownMenuItem onClick={() => setTheme('onedarkpro')}>One Dark Pro</DropdownMenuItem>
            <DropdownMenuItem onClick={() => setTheme('monokai')}>Monokai</DropdownMenuItem>
            <DropdownMenuItem onClick={() => setTheme('github-dark')}>GitHub Dark</DropdownMenuItem>
            <DropdownMenuItem onClick={() => setTheme('solarized-dark')}>Solarized Dark</DropdownMenuItem>
            <DropdownMenuItem onClick={() => setTheme('system')}>System</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
