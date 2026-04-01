import { Request, Response, Router } from 'express';
import net from 'net';
import https from 'https';
import http from 'http';
import fs from 'fs';

interface LocationLookupRequestBody {
  ips?: unknown;
}

interface GeoLocationLookup {
  ipAddress: string;
  country: string;
  city?: string;
  latitude?: number;
  longitude?: number;
}

interface GeoLocationCacheEntry {
  value: GeoLocationLookup;
  expiresAt: number;
  updatedAt: number;
}

interface IPWhoIsResponse {
  success?: boolean;
  status?: string;
  country?: string;
  country_code?: string;
  countryCode?: string;
  country_name?: string;
  city?: string;
  latitude?: number;
  longitude?: number;
  lat?: number;
  lon?: number;
}

interface LocalMMDBPayload {
  country?: {
    iso_code?: string;
    names?: {
      en?: string;
    };
  };
  city?: {
    names?: {
      en?: string;
    };
  };
  location?: {
    latitude?: number;
    longitude?: number;
  };
}

interface LocalMMDBReader {
  get(ipAddress: string): LocalMMDBPayload | null;
}

interface MaxMindModule {
  open?: (databasePath: string) => Promise<LocalMMDBReader>;
}

export interface GeoProviderState {
  baseUrl: string;
  consecutiveFailures: number;
  successCount: number;
  failureCount: number;
  cooldownUntil: number;
  lastError: string | null;
}

const router = Router();

const DEFAULT_PROVIDER_BASE_URL = 'https://ipwho.is';
const UNKNOWN_COUNTRY = 'Unknown';
const PRIVATE_COUNTRY = 'Private';
const PROVIDER_COOLDOWN_MS = 5 * 60 * 1000;
const PROVIDER_FAILURE_THRESHOLD = 2;
const LOOKUP_USER_AGENT = 'traefik-log-dashboard/2.5 (+https://github.com/hhftechnology/traefik-log-dashboard)';

function parseBooleanEnv(name: string, fallback: boolean): boolean {
  const value = process.env[name];
  if (!value) return fallback;
  const normalized = value.trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
  return fallback;
}

function parseIntEnv(input: { name: string; fallback: number; min: number; max: number }): number {
  const raw = process.env[input.name];
  if (!raw) return input.fallback;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed)) return input.fallback;
  if (parsed < input.min) return input.min;
  if (parsed > input.max) return input.max;
  return parsed;
}

export function parseProviderBaseURLs(input: {
  providerURLsValue?: string;
  providerBaseURLValue?: string;
  fallback: string;
}): string[] {
  const fromList = (input.providerURLsValue || '')
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);

  const rawURLs = fromList.length > 0
    ? fromList
    : [(input.providerBaseURLValue || input.fallback).trim()];

  const uniqueURLs = new Set<string>();
  for (const rawURL of rawURLs) {
    const normalized = rawURL.replace(/\/+$/, '');
    if (!/^https?:\/\//i.test(normalized)) {
      continue;
    }
    uniqueURLs.add(normalized);
  }

  if (uniqueURLs.size === 0) {
    const normalizedFallback = input.fallback.replace(/\/+$/, '');
    if (/^https?:\/\//i.test(normalizedFallback)) {
      uniqueURLs.add(normalizedFallback);
    }
  }

  return [...uniqueURLs];
}

const locationLookupConfig = {
  enabled: parseBooleanEnv('GEOIP_LOOKUP_ENABLED', true),
  providerBaseUrl: (process.env.GEOIP_PROVIDER_BASE_URL || DEFAULT_PROVIDER_BASE_URL).replace(/\/+$/, ''),
  providerBaseUrls: parseProviderBaseURLs({
    providerURLsValue: process.env.GEOIP_PROVIDER_URLS,
    providerBaseURLValue: process.env.GEOIP_PROVIDER_BASE_URL,
    fallback: DEFAULT_PROVIDER_BASE_URL,
  }),
  localDBPath: (process.env.GEOIP_LOCAL_DB_PATH || '').trim(),
  timeoutMs: parseIntEnv({ name: 'GEOIP_LOOKUP_TIMEOUT_MS', fallback: 3500, min: 250, max: 15000 }),
  maxIpsPerRequest: parseIntEnv({ name: 'GEOIP_LOOKUP_MAX_IPS', fallback: 256, min: 1, max: 2000 }),
  maxConcurrentLookups: parseIntEnv({ name: 'GEOIP_LOOKUP_CONCURRENCY', fallback: 10, min: 1, max: 64 }),
  cacheTTLMS: parseIntEnv({ name: 'GEOIP_LOOKUP_CACHE_TTL_MS', fallback: 60 * 60 * 1000, min: 1000, max: 24 * 60 * 60 * 1000 }),
  unknownCacheTTLMS: parseIntEnv({ name: 'GEOIP_UNKNOWN_CACHE_TTL_MS', fallback: 5 * 60 * 1000, min: 1000, max: 24 * 60 * 60 * 1000 }),
  maxCacheEntries: parseIntEnv({ name: 'GEOIP_LOOKUP_CACHE_MAX_ENTRIES', fallback: 10000, min: 100, max: 200000 }),
} as const;

/** Configured max GeoIP cache entries — re-exported for use by other routes (e.g. mobile). */
export const GEOIP_CACHE_MAX_ENTRIES = locationLookupConfig.maxCacheEntries;

const locationCache = new Map<string, GeoLocationCacheEntry>();
export function createProviderState(baseUrl: string): GeoProviderState {
  return {
    baseUrl,
    consecutiveFailures: 0,
    successCount: 0,
    failureCount: 0,
    cooldownUntil: 0,
    lastError: null,
  };
}

const providerStates: GeoProviderState[] = locationLookupConfig.providerBaseUrls.map(createProviderState);
let localMMDBReader: LocalMMDBReader | null = null;
let localDBLoaded = false;
let localDBError: string | null = null;
let localMMDBInitPromise: Promise<void> | null = null;

function createUnknownLocation(ipAddress: string): GeoLocationLookup {
  return { ipAddress, country: UNKNOWN_COUNTRY };
}

function createPrivateLocation(ipAddress: string): GeoLocationLookup {
  return { ipAddress, country: PRIVATE_COUNTRY };
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function getTrimmedString(value: unknown): string | undefined {
  if (!isNonEmptyString(value)) return undefined;
  return value.trim();
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function pruneExpiredCacheEntries(now: number): void {
  for (const [ip, entry] of locationCache.entries()) {
    if (entry.expiresAt <= now) {
      locationCache.delete(ip);
    }
  }
}

function pruneOversizedCacheEntries(): void {
  if (locationCache.size <= locationLookupConfig.maxCacheEntries) {
    return;
  }

  const entriesByAge = [...locationCache.entries()].sort((a, b) => a[1].updatedAt - b[1].updatedAt);
  const overflow = locationCache.size - locationLookupConfig.maxCacheEntries;
  const removeCount = Math.max(overflow, Math.ceil(locationLookupConfig.maxCacheEntries * 0.1));

  for (const [ip] of entriesByAge.slice(0, removeCount)) {
    locationCache.delete(ip);
  }
}

function getCachedLocation(ipAddress: string, now: number): GeoLocationLookup | null {
  const cached = locationCache.get(ipAddress);
  if (!cached) {
    return null;
  }

  if (cached.expiresAt <= now) {
    locationCache.delete(ipAddress);
    return null;
  }

  cached.updatedAt = now;
  return cached.value;
}

function setCachedLocation(ipAddress: string, value: GeoLocationLookup, now: number): void {
  const ttl = getCacheTTLForLocation(value);
  locationCache.set(ipAddress, {
    value,
    updatedAt: now,
    expiresAt: now + ttl,
  });
  pruneOversizedCacheEntries();
}

export function getCacheTTLForLocation(value: GeoLocationLookup): number {
  if (value.country === UNKNOWN_COUNTRY) {
    return locationLookupConfig.unknownCacheTTLMS;
  }
  return locationLookupConfig.cacheTTLMS;
}

function parseLocalMMDBPayload(payload: LocalMMDBPayload, ipAddress: string): GeoLocationLookup | null {
  const countryCode = getTrimmedString(payload.country?.iso_code);
  const countryName = getTrimmedString(payload.country?.names?.en);
  const country = countryCode?.toUpperCase() || countryName || UNKNOWN_COUNTRY;
  if (country === UNKNOWN_COUNTRY) {
    return null;
  }

  const city = getTrimmedString(payload.city?.names?.en);
  const latitude = isFiniteNumber(payload.location?.latitude) ? payload.location?.latitude : undefined;
  const longitude = isFiniteNumber(payload.location?.longitude) ? payload.location?.longitude : undefined;

  return {
    ipAddress,
    country,
    city,
    latitude,
    longitude,
  };
}

function initializeLocalMMDBResolver(): Promise<void> {
  if (localMMDBInitPromise) {
    return localMMDBInitPromise;
  }

  localMMDBInitPromise = (async () => {
    if (!locationLookupConfig.localDBPath) {
      localDBLoaded = false;
      localDBError = null;
      return;
    }

    if (!fs.existsSync(locationLookupConfig.localDBPath)) {
      localDBLoaded = false;
      localDBError = `Local GeoIP DB not found at ${locationLookupConfig.localDBPath}`;
      console.warn(`[location] ${localDBError}`);
      return;
    }

    try {
      // Optional dependency: dashboard can run without local MMDB support.
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const maxmind = require('maxmind') as MaxMindModule;
      if (typeof maxmind.open !== 'function') {
        throw new Error('maxmind.open is unavailable');
      }

      localMMDBReader = await maxmind.open(locationLookupConfig.localDBPath);
      localDBLoaded = true;
      localDBError = null;
      console.log(`[location] local MMDB loaded: ${locationLookupConfig.localDBPath}`);
    } catch (error) {
      localMMDBReader = null;
      localDBLoaded = false;
      localDBError = error instanceof Error ? error.message : String(error);
      console.warn('[location] failed to initialize local MMDB resolver:', localDBError);
    }
  })();

  return localMMDBInitPromise;
}

function lookupLocationByLocalMMDB(ipAddress: string): GeoLocationLookup | null {
  if (!localDBLoaded || !localMMDBReader) {
    return null;
  }

  try {
    const payload = localMMDBReader.get(ipAddress);
    if (!payload) {
      return null;
    }
    return parseLocalMMDBPayload(payload, ipAddress);
  } catch (error) {
    localDBError = error instanceof Error ? error.message : String(error);
    console.warn(`[location] local MMDB lookup failed for ${ipAddress}: ${localDBError}`);
    return null;
  }
}

export function isProviderInCooldown(provider: GeoProviderState, now: number): boolean {
  return provider.cooldownUntil > now;
}

export function markProviderSuccess(provider: GeoProviderState): void {
  provider.successCount += 1;
  provider.consecutiveFailures = 0;
  provider.cooldownUntil = 0;
  provider.lastError = null;
}

export function markProviderFailure(provider: GeoProviderState, input: { statusCode?: number; reason: string; now: number }): void {
  provider.failureCount += 1;
  provider.consecutiveFailures += 1;
  provider.lastError = input.reason;

  const shouldTriggerCircuit =
    input.statusCode === undefined ||
    input.statusCode === 403 ||
    input.statusCode === 429 ||
    input.statusCode >= 500;

  if (shouldTriggerCircuit && provider.consecutiveFailures >= PROVIDER_FAILURE_THRESHOLD) {
    provider.cooldownUntil = input.now + PROVIDER_COOLDOWN_MS;
  }
}

export function normalizeIPAddress(input: string): string | null {
  const raw = input.trim();
  if (!raw) {
    return null;
  }

  const bracketedMatch = raw.match(/^\[([a-fA-F0-9:]+)\](?::\d+)?$/);
  if (bracketedMatch) {
    const ip = bracketedMatch[1];
    return net.isIP(ip) > 0 ? ip : null;
  }

  if (net.isIP(raw) > 0) {
    return raw;
  }

  const ipv4WithPortMatch = raw.match(/^(\d{1,3}(?:\.\d{1,3}){3}):(\d{1,5})$/);
  if (ipv4WithPortMatch && net.isIP(ipv4WithPortMatch[1]) === 4) {
    return ipv4WithPortMatch[1];
  }

  return null;
}

export function isPrivateIPAddress(ipAddress: string): boolean {
  const family = net.isIP(ipAddress);
  if (family === 4) {
    const octets = ipAddress.split('.').map((part) => Number.parseInt(part, 10));
    if (octets.length !== 4 || octets.some((value) => !Number.isFinite(value))) {
      return false;
    }

    if (octets[0] === 10) return true;
    if (octets[0] === 127) return true;
    if (octets[0] === 192 && octets[1] === 168) return true;
    if (octets[0] === 169 && octets[1] === 254) return true;
    if (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31) return true;
    return false;
  }

  if (family === 6) {
    const normalized = ipAddress.toLowerCase();
    if (normalized === '::1') return true;
    if (normalized.startsWith('fc') || normalized.startsWith('fd')) return true;
    if (normalized.startsWith('fe8') || normalized.startsWith('fe9') || normalized.startsWith('fea') || normalized.startsWith('feb')) {
      return true;
    }
    return false;
  }

  return false;
}

function lookupWithNodeHttp(url: string, timeoutMs: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    const req = client.get(url, {
      headers: {
        Accept: 'application/json',
        'User-Agent': LOOKUP_USER_AGENT,
      },
      timeout: timeoutMs,
    }, (res) => {
      if (res.statusCode && (res.statusCode < 200 || res.statusCode >= 300)) {
        res.resume();
        reject(new Error(`HTTP ${res.statusCode}`));
        return;
      }
      const chunks: Buffer[] = [];
      res.on('data', (chunk: Buffer) => chunks.push(chunk));
      res.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
      res.on('error', reject);
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
  });
}

function parseProviderPayload(payload: IPWhoIsResponse, ipAddress: string): GeoLocationLookup {
  if (payload.success === false || payload.status === 'fail') {
    return createUnknownLocation(ipAddress);
  }

  const countryCode = getTrimmedString(payload.country_code || payload.countryCode);
  const countryName = getTrimmedString(payload.country || payload.country_name);
  const country = countryCode?.toUpperCase() || countryName || UNKNOWN_COUNTRY;
  const city = getTrimmedString(payload.city);
  const latitude = payload.latitude ?? payload.lat;
  const longitude = payload.longitude ?? payload.lon;

  return {
    ipAddress,
    country,
    city,
    latitude: isFiniteNumber(latitude) ? latitude : undefined,
    longitude: isFiniteNumber(longitude) ? longitude : undefined,
  };
}

async function lookupLocationByProvider(ipAddress: string, provider: GeoProviderState): Promise<GeoLocationLookup | null> {
  if (!locationLookupConfig.enabled || !provider.baseUrl) {
    return null;
  }

  const now = Date.now();
  if (isProviderInCooldown(provider, now)) {
    return null;
  }

  const lookupURL = `${provider.baseUrl}/${encodeURIComponent(ipAddress)}`;

  const controller = new AbortController();
  const timeoutID = setTimeout(() => controller.abort(), locationLookupConfig.timeoutMs);

  try {
    const response = await fetch(lookupURL, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        'User-Agent': LOOKUP_USER_AGENT,
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      const reason = `HTTP ${response.status}`;
      markProviderFailure(provider, { statusCode: response.status, reason, now: Date.now() });
      console.warn(`[location] provider=${provider.baseUrl} fetch returned HTTP ${response.status} for ${ipAddress}`);
      return null;
    }

    const payload = (await response.json()) as IPWhoIsResponse;
    const parsed = parseProviderPayload(payload, ipAddress);
    markProviderSuccess(provider);
    return parsed;
  } catch (fetchErr) {
    const message = fetchErr instanceof Error ? fetchErr.message : String(fetchErr);
    console.warn(`[location] provider=${provider.baseUrl} fetch failed for ${ipAddress}: ${message}, trying node http fallback`);
  } finally {
    clearTimeout(timeoutID);
  }

  try {
    const body = await lookupWithNodeHttp(lookupURL, locationLookupConfig.timeoutMs);
    const payload = JSON.parse(body) as IPWhoIsResponse;
    const parsed = parseProviderPayload(payload, ipAddress);
    markProviderSuccess(provider);
    return parsed;
  } catch (httpErr) {
    const message = httpErr instanceof Error ? httpErr.message : String(httpErr);
    markProviderFailure(provider, { reason: message, now: Date.now() });
    console.error(`[location] provider=${provider.baseUrl} http fallback failed for ${ipAddress}: ${message}`);
    return null;
  }
}

async function lookupLocationByProviders(ipAddress: string): Promise<GeoLocationLookup> {
  if (!locationLookupConfig.enabled || providerStates.length === 0) {
    return createUnknownLocation(ipAddress);
  }

  let bestUnknown: GeoLocationLookup | null = null;
  for (const provider of providerStates) {
    const resolved = await lookupLocationByProvider(ipAddress, provider);
    if (!resolved) {
      continue;
    }

    if (resolved.country !== UNKNOWN_COUNTRY) {
      return resolved;
    }

    if (!bestUnknown) {
      bestUnknown = resolved;
    }
  }

  return bestUnknown ?? createUnknownLocation(ipAddress);
}

async function resolveLocation(ipAddress: string): Promise<GeoLocationLookup> {
  if (!locationLookupConfig.enabled) {
    return createUnknownLocation(ipAddress);
  }

  await initializeLocalMMDBResolver();

  const local = lookupLocationByLocalMMDB(ipAddress);
  if (local && local.country !== UNKNOWN_COUNTRY) {
    return local;
  }

  return lookupLocationByProviders(ipAddress);
}

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  mapper: (item: T) => Promise<R>,
): Promise<R[]> {
  if (items.length === 0) {
    return [];
  }

  const results = new Array<R>(items.length);
  let nextIndex = 0;

  async function worker(): Promise<void> {
    while (nextIndex < items.length) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      results[currentIndex] = await mapper(items[currentIndex]);
    }
  }

  const workerCount = Math.min(concurrency, items.length);
  await Promise.all(Array.from({ length: workerCount }, () => worker()));
  return results;
}

router.get('/status', (_req: Request, res: Response) => {
  const now = Date.now();
  pruneExpiredCacheEntries(now);

  const providers = providerStates.map((provider) => ({
    base_url: provider.baseUrl,
    available: !isProviderInCooldown(provider, now),
    cooldown_until: provider.cooldownUntil > now ? provider.cooldownUntil : null,
    last_error: provider.lastError,
    consecutive_failures: provider.consecutiveFailures,
    success_count: provider.successCount,
    failure_count: provider.failureCount,
  }));

  const providerAvailable = providers.some((provider) => provider.available);

  res.json({
    enabled: locationLookupConfig.enabled,
    available: locationLookupConfig.enabled && (localDBLoaded || providerAvailable),
    provider: locationLookupConfig.providerBaseUrl || null,
    providers,
    provider_available: providerAvailable,
    local_db_path: locationLookupConfig.localDBPath || null,
    local_db_loaded: localDBLoaded,
    local_db_error: localDBError,
    timeout_ms: locationLookupConfig.timeoutMs,
    max_ips_per_request: locationLookupConfig.maxIpsPerRequest,
    max_concurrent_lookups: locationLookupConfig.maxConcurrentLookups,
    cache_ttl_ms: locationLookupConfig.cacheTTLMS,
    unknown_cache_ttl_ms: locationLookupConfig.unknownCacheTTLMS,
    cache_entries: locationCache.size,
    max_cache_entries: locationLookupConfig.maxCacheEntries,
  });
});

export async function resolveLocationsBatch(ips: string[]): Promise<GeoLocationLookup[]> {
  const uniqueIPs = new Set<string>();
  const normalizedIPs: string[] = [];
  for (const value of ips) {
    if (!isNonEmptyString(value)) {
      continue;
    }

    const normalized = normalizeIPAddress(value);
    if (!normalized || uniqueIPs.has(normalized)) {
      continue;
    }

    uniqueIPs.add(normalized);
    normalizedIPs.push(normalized);
  }

  if (normalizedIPs.length === 0) {
    return [];
  }

  const now = Date.now();
  pruneExpiredCacheEntries(now);

  const locations = await mapWithConcurrency(
    normalizedIPs,
    locationLookupConfig.maxConcurrentLookups,
    async (ipAddress) => {
      if (isPrivateIPAddress(ipAddress)) {
        const privateLocation = createPrivateLocation(ipAddress);
        setCachedLocation(ipAddress, privateLocation, Date.now());
        return privateLocation;
      }

      const currentTime = Date.now();
      const cached = getCachedLocation(ipAddress, currentTime);
      if (cached) {
        return cached;
      }

      const resolved = await resolveLocation(ipAddress);
      setCachedLocation(ipAddress, resolved, Date.now());
      return resolved;
    },
  );

  return locations;
}

router.post('/lookup', async (req: Request, res: Response) => {
  const body = (req.body || {}) as LocationLookupRequestBody;
  if (!Array.isArray(body.ips)) {
    res.status(400).json({ error: 'Invalid request body: "ips" must be an array of IP strings' });
    return;
  }

  if (body.ips.length > locationLookupConfig.maxIpsPerRequest) {
    res.status(400).json({
      error: `Too many IPs: maximum is ${locationLookupConfig.maxIpsPerRequest} per request`,
    });
    return;
  }

  const locations = await resolveLocationsBatch(body.ips);

  res.json({
    locations,
    count: locations.length,
  });
});

// Startup connectivity check
void initializeLocalMMDBResolver();

if (locationLookupConfig.enabled && process.env.NODE_ENV !== 'test') {
  lookupLocationByProviders('8.8.8.8')
    .then((result) => {
      console.log(`[location] provider check: ${result.country !== UNKNOWN_COUNTRY ? 'OK' : 'FAILED'} (country=${result.country})`);
    })
    .catch((error) => {
      console.error('[location] provider check failed:', error instanceof Error ? error.message : error);
    });
}

export default router;
