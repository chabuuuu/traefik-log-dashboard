import { describe, expect, it } from 'vitest';
import { getNextLogCursor } from './log-cursor';

describe('getNextLogCursor', () => {
  it('accepts Go-style lowercase `position`', () => {
    const cursor = getNextLogCursor([{ position: 12345 }]);
    expect(cursor).toBe(12345);
  });

  it('accepts legacy uppercase `Position`', () => {
    const cursor = getNextLogCursor([{ Position: 67890 }]);
    expect(cursor).toBe(67890);
  });

  it('returns null for missing/invalid cursor values', () => {
    expect(getNextLogCursor()).toBeNull();
    expect(getNextLogCursor([])).toBeNull();
    expect(getNextLogCursor([{ position: '42' }])).toBeNull();
    expect(getNextLogCursor([{ Position: null }])).toBeNull();
  });
});

