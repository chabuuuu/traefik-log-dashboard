import { describe, expect, it } from 'vitest';
import { buildAggregatedMetrics, thresholdValueForParameter } from './metrics';
import type { AlertParameterConfig } from './types';

function enabledThresholdParameter(
  parameter: AlertParameterConfig['parameter'],
  threshold: number,
): AlertParameterConfig {
  return {
    parameter,
    enabled: true,
    threshold,
  };
}

describe('alert metrics parser ratios', () => {
  it('includes parser ratio metrics when requested', () => {
    const metrics = buildAggregatedMetrics({
      logs: [],
      windowMs: 5 * 60_000,
      parameters: [
        enabledThresholdParameter('parser_unknown_ratio', 10),
        enabledThresholdParameter('parser_error_ratio', 1),
      ],
      parserRatios: {
        unknownRatio: 0.1234,
        errorRatio: 0.0312,
      },
    });

    expect(metrics.parser_unknown_ratio).toBeCloseTo(12.34, 2);
    expect(metrics.parser_error_ratio).toBeCloseTo(3.12, 2);
  });

  it('maps parser ratios in threshold selector', () => {
    const metrics = {
      parser_unknown_ratio: 8.5,
      parser_error_ratio: 1.25,
    };

    expect(thresholdValueForParameter('parser_unknown_ratio', metrics)).toBe(8.5);
    expect(thresholdValueForParameter('parser_error_ratio', metrics)).toBe(1.25);
  });
});
