import { Request, Response, Router } from 'express';
import net from 'net';
import https from 'https';
import http from 'http';

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
  country?: string;
  country_code?: string;
  city?: string;
  latitude?: number;
  longitude?: number;
}

const router = Router();

const DEFAULT_PROVIDER_BASE_URL = 'https://ipwho.is';
const UNKNOWN_COUNTRY = 'Unknown';
const PRIVATE_COUNTRY = 'Private';

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

const locationLookupConfig = {
  enabled: parseBooleanEnv('GEOIP_LOOKUP_ENABLED', true),
  providerBaseUrl: (process.env.GEOIP_PROVIDER_BASE_URL || DEFAULT_PROVIDER_BASE_URL).replace(/\/+$/, ''),
  timeoutMs: parseIntEnv({ name: 'GEOIP_LOOKUP_TIMEOUT_MS', fallback: 3500, min: 250, max: 15000 }),
  maxIpsPerRequest: parseIntEnv({ name: 'GEOIP_LOOKUP_MAX_IPS', fallback: 256, min: 1, max: 2000 }),
  maxConcurrentLookups: parseIntEnv({ name: 'GEOIP_LOOKUP_CONCURRENCY', fallback: 10, min: 1, max: 64 }),
  cacheTTLMS: parseIntEnv({ name: 'GEOIP_LOOKUP_CACHE_TTL_MS', fallback: 60 * 60 * 1000, min: 1000, max: 24 * 60 * 60 * 1000 }),
  maxCacheEntries: parseIntEnv({ name: 'GEOIP_LOOKUP_CACHE_MAX_ENTRIES', fallback: 10000, min: 100, max: 200000 }),
} as const;

const locationCache = new Map<string, GeoLocationCacheEntry>();

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
  locationCache.set(ipAddress, {
    value,
    updatedAt: now,
    expiresAt: now + locationLookupConfig.cacheTTLMS,
  });
  pruneOversizedCacheEntries();
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
    const req = client.get(url, { headers: { Accept: 'application/json' }, timeout: timeoutMs }, (res) => {
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
  if (payload.success === false) {
    return createUnknownLocation(ipAddress);
  }

  const countryCode = getTrimmedString(payload.country_code);
  const countryName = getTrimmedString(payload.country);
  const country = countryCode?.toUpperCase() || countryName || UNKNOWN_COUNTRY;
  const city = getTrimmedString(payload.city);

  return {
    ipAddress,
    country,
    city,
    latitude: isFiniteNumber(payload.latitude) ? payload.latitude : undefined,
    longitude: isFiniteNumber(payload.longitude) ? payload.longitude : undefined,
  };
}

async function lookupLocationByProvider(ipAddress: string): Promise<GeoLocationLookup> {
  if (!locationLookupConfig.enabled || !locationLookupConfig.providerBaseUrl) {
    return createUnknownLocation(ipAddress);
  }

  const lookupUrl = `${locationLookupConfig.providerBaseUrl}/${encodeURIComponent(ipAddress)}`;

  // Try fetch() first
  const controller = new AbortController();
  const timeoutID = setTimeout(() => controller.abort(), locationLookupConfig.timeoutMs);

  try {
    const response = await fetch(lookupUrl, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });

    if (!response.ok) {
      console.warn(`[location] fetch returned HTTP ${response.status} for ${ipAddress}`);
      return createUnknownLocation(ipAddress);
    }

    const payload = (await response.json()) as IPWhoIsResponse;
    return parseProviderPayload(payload, ipAddress);
  } catch (fetchErr) {
    console.warn(`[location] fetch failed for ${ipAddress}: ${fetchErr instanceof Error ? fetchErr.message : fetchErr}, trying node http fallback`);
  } finally {
    clearTimeout(timeoutID);
  }

  // Fallback to Node.js built-in http/https module
  try {
    const body = await lookupWithNodeHttp(lookupUrl, locationLookupConfig.timeoutMs);
    const payload = JSON.parse(body) as IPWhoIsResponse;
    return parseProviderPayload(payload, ipAddress);
  } catch (httpErr) {
    console.error(`[location] http fallback also failed for ${ipAddress}:`, httpErr instanceof Error ? httpErr.message : httpErr);
    return createUnknownLocation(ipAddress);
  }
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
  pruneExpiredCacheEntries(Date.now());

  res.json({
    enabled: locationLookupConfig.enabled,
    available: locationLookupConfig.enabled,
    provider: locationLookupConfig.providerBaseUrl || null,
    timeout_ms: locationLookupConfig.timeoutMs,
    max_ips_per_request: locationLookupConfig.maxIpsPerRequest,
    max_concurrent_lookups: locationLookupConfig.maxConcurrentLookups,
    cache_ttl_ms: locationLookupConfig.cacheTTLMS,
    cache_entries: locationCache.size,
    max_cache_entries: locationLookupConfig.maxCacheEntries,
  });
});

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

  const uniqueIPs = new Set<string>();
  const normalizedIPs: string[] = [];
  for (const value of body.ips) {
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
    res.json({ locations: [], count: 0 });
    return;
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

      const resolved = await lookupLocationByProvider(ipAddress);
      setCachedLocation(ipAddress, resolved, Date.now());
      return resolved;
    },
  );

  res.json({
    locations,
    count: locations.length,
  });
});

// Startup connectivity check
if (locationLookupConfig.enabled) {
  lookupLocationByProvider('8.8.8.8')
    .then((r) => console.log(`[location] provider check: ${r.country !== UNKNOWN_COUNTRY ? 'OK' : 'FAILED'} (country=${r.country})`))
    .catch((e) => console.error('[location] provider check failed:', e instanceof Error ? e.message : e));
}

export default router;
