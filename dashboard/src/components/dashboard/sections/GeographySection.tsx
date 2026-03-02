import { memo, Suspense, lazy } from 'react';
import { Card, CardContent } from '@/components/ui/Card';
import { Skeleton } from '@/components/ui/skeleton';
import { GeoLocation } from '@/utils/types';

const InteractiveGeoMap = lazy(() => import('../cards/InteractiveGeoMap'));

interface GeographySectionProps {
  locations: GeoLocation[];
  isLoading?: boolean;
}

function GeographySection({ locations, isLoading }: GeographySectionProps) {
  return (
    <div className="space-y-6">
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
