import { memo, Suspense, lazy } from 'react';
import { Card, CardContent } from '@/components/ui/Card';
import { Skeleton } from '@/components/ui/skeleton';
import { GeoLocation } from '@/utils/types';
import { GeoDiagnostic } from '@/hooks/useGeoLocation';
import { Button } from '@/components/ui/button';
import { AlertTriangle, FilterX } from 'lucide-react';

const InteractiveGeoMap = lazy(() => import('../cards/InteractiveGeoMap'));

interface GeographySectionProps {
  locations: GeoLocation[];
  isLoading?: boolean;
  diagnostic?: GeoDiagnostic | null;
  hideInternalTraffic?: boolean;
  onShowInternalTraffic?: () => void;
}

function GeographySection({
  locations,
  isLoading,
  diagnostic,
  hideInternalTraffic,
  onShowInternalTraffic,
}: GeographySectionProps) {
  return (
    <div className="space-y-6">
      {diagnostic && (
        <Card className="border-warning/40 bg-warning-muted">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-4 w-4 mt-0.5 text-warning" />
              <div className="space-y-2 text-sm">
                <p className="font-medium text-warning">{diagnostic.message}</p>
                {diagnostic.providerHint && (
                  <p className="text-warning/80">{diagnostic.providerHint}</p>
                )}
                {diagnostic.reason === 'all_filtered_by_internal_rules' && hideInternalTraffic && onShowInternalTraffic && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 border-warning/40 text-warning hover:bg-warning/10"
                    onClick={onShowInternalTraffic}
                  >
                    <FilterX className="mr-2 h-3.5 w-3.5" />
                    Show Internal Traffic
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Suspense
        fallback={(
          <div className="h-[500px] rounded-lg border bg-card p-6">
            <Skeleton className="h-full w-full" />
          </div>
        )}
      >
        <InteractiveGeoMap locations={locations} />
      </Suspense>

      {isLoading && (
        <Card className="hover:shadow-md transition-shadow">
          <CardContent className="p-4">
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              <span>Loading additional location data...</span>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default memo(GeographySection);
