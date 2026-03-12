import { describe, expect, it } from 'vitest';
import { deriveGeoDiagnostic } from './useGeoLocation';

describe('deriveGeoDiagnostic', () => {
  it('returns no_logs when there are no total logs', () => {
    const result = deriveGeoDiagnostic({
      totalLogs: 0,
      visibleLogs: 0,
      filteredCount: 0,
      hideInternalTraffic: true,
      uniquePublicIPs: 0,
      resolvedLocations: 0,
      status: null,
    });

    expect(result?.reason).toBe('no_logs');
  });

  it('returns all_filtered_by_internal_rules when internal filtering hides everything', () => {
    const result = deriveGeoDiagnostic({
      totalLogs: 25,
      visibleLogs: 0,
      filteredCount: 25,
      hideInternalTraffic: true,
      uniquePublicIPs: 0,
      resolvedLocations: 0,
      status: null,
    });

    expect(result?.reason).toBe('all_filtered_by_internal_rules');
  });

  it('returns provider_unavailable when lookup providers are down and no local db is loaded', () => {
    const result = deriveGeoDiagnostic({
      totalLogs: 25,
      visibleLogs: 25,
      filteredCount: 0,
      hideInternalTraffic: false,
      uniquePublicIPs: 10,
      resolvedLocations: 0,
      status: {
        enabled: true,
        available: false,
        providerAvailable: false,
        localDBLoaded: false,
        providerError: 'HTTP 403',
      },
    });

    expect(result?.reason).toBe('provider_unavailable');
    expect(result?.providerHint).toContain('Geo provider error');
  });

  it('returns null when locations resolve correctly', () => {
    const result = deriveGeoDiagnostic({
      totalLogs: 25,
      visibleLogs: 25,
      filteredCount: 0,
      hideInternalTraffic: false,
      uniquePublicIPs: 10,
      resolvedLocations: 2,
      status: {
        enabled: true,
        available: true,
        providerAvailable: true,
        localDBLoaded: false,
      },
    });

    expect(result).toBeNull();
  });
});
