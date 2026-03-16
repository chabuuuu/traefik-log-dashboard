/**
 * Traefik log utility functions.
 *
 * Parsing is now performed server-side by the Go agent.
 * This module retains helper utilities used by the dashboard.
 */

/**
 * Extract client IP from various address formats
 */
export function extractIP(clientAddr: string): string {
  if (!clientAddr || clientAddr === '') {
    return 'unknown';
  }

  // Handle IPv6 addresses in brackets
  if (clientAddr.startsWith('[')) {
    const match = clientAddr.indexOf(']');
    if (match !== -1) {
      return clientAddr.substring(1, match);
    }
  }

  // Handle IPv4 with port
  if (clientAddr.includes('.') && clientAddr.includes(':')) {
    const lastColon = clientAddr.lastIndexOf(':');
    if (lastColon !== -1) {
      return clientAddr.substring(0, lastColon);
    }
  }

  // Handle IPv6 without brackets
  if (clientAddr.includes(':') && !clientAddr.includes('.')) {
    return clientAddr;
  }

  return clientAddr;
}
