/* eslint-disable no-restricted-syntax, react-hooks/exhaustive-deps */
import { useEffect, EffectCallback } from 'react';

/**
 * Executes a side effect only once when the component mounts.
 *
 * In this codebase, direct use of `useEffect` is banned to prevent
 * infinite loops, dependency hell, and race conditions.
 *
 * Good use cases:
 * - DOM integration (focus, scroll)
 * - Third-party widget lifecycles (e.g., Maps, Video Players)
 * - Browser API subscriptions (e.g., ResizeObserver setup)
 *
 * Bad use cases (use alternatives instead):
 * - Data fetching (use API client hooks or event handlers)
 * - Deriving state (calculate it directly in the component body)
 * - Event handling (do it in the onClick/onSubmit handler)
 *
 * @param effect - Imperative function that executes on mount. Can optionally return a cleanup function.
 */
export function useMountEffect(effect: EffectCallback): void {
  useEffect(effect, []);
}
