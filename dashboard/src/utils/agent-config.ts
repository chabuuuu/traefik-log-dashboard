/**
 * Agent configuration loaded at runtime
 * This ensures environment variables are read when the API routes execute,
 * not baked in at build time
 */

import { getRuntimeConfig } from './config/runtime-config';

export function getAgentConfig() {
  const runtime = getRuntimeConfig();
  const sameOrigin =
    typeof window !== 'undefined' && window.location?.origin
      ? window.location.origin
      : 'http://localhost:5000';
  return {
    url: runtime.defaultAgentUrl || sameOrigin,
    token: runtime.defaultAgentToken || '',
  };
}
