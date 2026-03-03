// dashboard/lib/utils/base-url.ts
// Helpers for base domain/base path aware URLs (reverse proxy friendly)

import { getRuntimeConfig } from '@/utils/config/runtime-config';

function normalizeBasePath(raw: string): string {
  const trimmed = raw.trim();
  return trimmed ? `/${trimmed.replace(/^\/|\/$/g, '')}` : '';
}

function normalizeBaseDomain(raw: string): string {
  return raw.trim().replace(/\/$/, '');
}

function normalizePath(path: string): string {
  return path.startsWith('/') ? path : `/${path}`;
}

/**
 * Return configured basePath (always starts with "/" or empty string)
 */
export function getBasePath(): string {
  const runtime = getRuntimeConfig();
  return normalizeBasePath(runtime.basePath ?? '');
}

/**
 * Return configured base domain (no trailing slash), if provided
 */
export function getBaseDomain(): string {
  const runtime = getRuntimeConfig();
  return normalizeBaseDomain(runtime.baseDomain ?? '');
}

/**
 * Prefix a path with the configured basePath, if any.
 * Supports paths that already contain query strings.
 */
export function withBasePath(path: string, basePath: string = getBasePath()): string {
  const resolvedBasePath = basePath || getBasePath();
  const [pathname, search = ''] = normalizePath(path).split('?');

  if (!resolvedBasePath) {
    return search ? `${pathname}?${search}` : pathname;
  }

  if (pathname.startsWith(`${resolvedBasePath}/`) || pathname === resolvedBasePath) {
    return search ? `${pathname}?${search}` : pathname;
  }

  const combined = `${resolvedBasePath}${pathname}`;
  return search ? `${combined}?${search}` : combined;
}

/**
 * Resolve the origin for absolute URLs. Falls back to window origin on the client.
 */
export function getBaseOrigin(): string {
  const baseDomain = getBaseDomain();
  if (baseDomain) {
    return baseDomain;
  }

  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin;
  }

  // When no domain is configured and origin is unavailable (SSR without request),
  // return empty string so callers still get path-only URLs.
  return '';
}

/**
 * Build an absolute (or path-relative) URL that respects base domain and base path.
 */
export function buildUrl(path: string): string {
  const origin = getBaseOrigin();
  const withPath = withBasePath(path);
  return `${origin}${withPath}`;
}
