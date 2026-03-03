/**
 * Agent configuration loaded at runtime
 * This ensures environment variables are read when the API routes execute,
 * not baked in at build time
 */

import { getRuntimeConfig } from './config/runtime-config';

export function getAgentConfig() {
  const runtime = getRuntimeConfig();
  return {
    url: runtime.defaultAgentUrl || 'http://traefik-agent:5000',
    token: runtime.defaultAgentToken || '',
  };
}
