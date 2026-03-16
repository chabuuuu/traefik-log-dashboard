// dashboard/components/dashboard/DashboardWithFilters.tsx
'use client';

import { useMemo } from 'react';
import { useFilters } from '@/utils/contexts/FilterContext';
import { useConfig } from '@/utils/contexts/ConfigContext';
import { applyFilters, getActiveFilterSummary } from '@/utils/utils/filter-utils';
import { TraefikLog } from '@/utils/types';
import TabbedDashboard from './TabbedDashboard';
import { Badge } from '@/components/ui/badge';
import { Filter } from 'lucide-react';
import { Link } from '@tanstack/react-router';
import { Button } from '@/components/ui/button';

interface DashboardWithFiltersProps {
  logs: TraefikLog[];
  demoMode?: boolean;
  agentId?: string;
  agentName?: string;
}

export default function DashboardWithFilters({ logs, demoMode = false, agentId, agentName }: DashboardWithFiltersProps) {
  const { settings, updateSettings } = useFilters();
  const { config } = useConfig();

  // Apply filters to logs
  const filteredLogs = useMemo(() => {
    return applyFilters(logs, settings, {
      pathPrefixes: config.internalNoisePathPrefixes,
      servicePatterns: config.internalNoiseServicePatterns,
    });
  }, [config.internalNoisePathPrefixes, config.internalNoiseServicePatterns, logs, settings]);

  // Get active filter summary
  const filterSummary = useMemo(() => {
    return getActiveFilterSummary(settings);
  }, [settings]);

  const hasActiveFilters = filterSummary.length > 0;
  const filteredCount = logs.length - filteredLogs.length;

  return (
    <>
      {/* Filter Status Bar */}
      {hasActiveFilters && (
        <div className="bg-info-muted border-b border-info/30 px-4 py-3">
          <div className="container mx-auto flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-info" />
                <span className="text-sm font-semibold text-info">
                  Active Filters:
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                {filterSummary.map((summary, index) => (
                  <Badge
                    key={index}
                    variant="secondary"
                    className="bg-info/20 text-info border-info/30"
                  >
                    {summary}
                  </Badge>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm text-info">
                {filteredCount > 0 && (
                  <>
                    <span className="font-semibold">{filteredCount}</span> log{filteredCount !== 1 ? 's' : ''} filtered
                  </>
                )}
              </span>
              <Button
                asChild
                variant="outline"
                size="sm"
                className="border-info/30 text-info hover:bg-info/10"
              >
                <Link to="/settings/filters">
                  Manage Filters
                </Link>
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Main Dashboard */}
      <TabbedDashboard
        logs={filteredLogs}
        totalLogs={logs.length}
        filteredCount={filteredCount}
        hideInternalTraffic={settings.hideInternalTraffic}
        onShowInternalTraffic={() => updateSettings({ hideInternalTraffic: false })}
        demoMode={demoMode}
        agentId={agentId}
        agentName={agentName}
      />
    </>
  );
}
