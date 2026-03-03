type CursorPosition = {
  position?: unknown;
  Position?: unknown;
};

/**
 * Extract cursor position from API responses that may expose either
 * `position` (Go JSON tag) or legacy `Position`.
 */
export function getNextLogCursor(positions?: CursorPosition[]): number | null {
  const first = positions?.[0];
  if (!first) return null;

  if (typeof first.position === 'number') {
    return first.position;
  }

  if (typeof first.Position === 'number') {
    return first.Position;
  }

  return null;
}

