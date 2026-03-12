import { describe, expect, it } from 'vitest';
import {
  createProviderState,
  getCacheTTLForLocation,
  isPrivateIPAddress,
  isProviderInCooldown,
  markProviderFailure,
  markProviderSuccess,
  normalizeIPAddress,
  parseProviderBaseURLs,
} from './location';

describe('normalizeIPAddress', () => {
  it('normalizes raw IPv4 values', () => {
    expect(normalizeIPAddress('8.8.8.8')).toBe('8.8.8.8');
    expect(normalizeIPAddress(' 1.1.1.1 ')).toBe('1.1.1.1');
  });

  it('normalizes IPv4 with port', () => {
    expect(normalizeIPAddress('8.8.8.8:443')).toBe('8.8.8.8');
  });

  it('normalizes bracketed IPv6 with and without port', () => {
    expect(normalizeIPAddress('[2001:4860:4860::8888]')).toBe('2001:4860:4860::8888');
    expect(normalizeIPAddress('[2001:4860:4860::8888]:443')).toBe('2001:4860:4860::8888');
  });

  it('returns null for invalid values', () => {
    expect(normalizeIPAddress('')).toBeNull();
    expect(normalizeIPAddress('not-an-ip')).toBeNull();
    expect(normalizeIPAddress('999.999.999.999')).toBeNull();
  });
});

describe('isPrivateIPAddress', () => {
  it('detects private IPv4 ranges', () => {
    expect(isPrivateIPAddress('10.0.0.1')).toBe(true);
    expect(isPrivateIPAddress('172.16.5.8')).toBe(true);
    expect(isPrivateIPAddress('172.31.255.255')).toBe(true);
    expect(isPrivateIPAddress('192.168.1.1')).toBe(true);
    expect(isPrivateIPAddress('127.0.0.1')).toBe(true);
    expect(isPrivateIPAddress('169.254.10.12')).toBe(true);
  });

  it('detects private IPv6 ranges', () => {
    expect(isPrivateIPAddress('::1')).toBe(true);
    expect(isPrivateIPAddress('fc00::1')).toBe(true);
    expect(isPrivateIPAddress('fd12:3456:789a:1::1')).toBe(true);
    expect(isPrivateIPAddress('fe80::1')).toBe(true);
  });

  it('returns false for public IP addresses', () => {
    expect(isPrivateIPAddress('8.8.8.8')).toBe(false);
    expect(isPrivateIPAddress('1.1.1.1')).toBe(false);
    expect(isPrivateIPAddress('2001:4860:4860::8888')).toBe(false);
  });
});

describe('parseProviderBaseURLs', () => {
  it('uses GEOIP_PROVIDER_URLS when provided and preserves order', () => {
    const parsed = parseProviderBaseURLs({
      providerURLsValue: ' https://one.example ,https://two.example/ ',
      providerBaseURLValue: 'https://legacy.example',
      fallback: 'https://fallback.example',
    });

    expect(parsed).toEqual(['https://one.example', 'https://two.example']);
  });

  it('falls back to legacy provider env when provider list is missing', () => {
    const parsed = parseProviderBaseURLs({
      providerBaseURLValue: 'https://legacy.example/',
      fallback: 'https://fallback.example',
    });

    expect(parsed).toEqual(['https://legacy.example']);
  });
});

describe('getCacheTTLForLocation', () => {
  it('assigns shorter ttl for unknown countries', () => {
    const unknownTTL = getCacheTTLForLocation({
      ipAddress: '8.8.8.8',
      country: 'Unknown',
    });

    const successTTL = getCacheTTLForLocation({
      ipAddress: '8.8.8.8',
      country: 'US',
      city: 'Mountain View',
    });

    expect(unknownTTL).toBeLessThan(successTTL);
  });
});

describe('provider circuit state', () => {
  it('enters cooldown after repeated provider failures', () => {
    const provider = createProviderState('https://ipwho.is');
    const now = Date.now();

    markProviderFailure(provider, { statusCode: 403, reason: 'HTTP 403', now });
    expect(isProviderInCooldown(provider, now)).toBe(false);

    markProviderFailure(provider, { statusCode: 403, reason: 'HTTP 403', now });
    expect(isProviderInCooldown(provider, now)).toBe(true);
  });

  it('clears cooldown and failure streak after success', () => {
    const provider = createProviderState('https://ipwho.is');
    const now = Date.now();

    markProviderFailure(provider, { statusCode: 429, reason: 'HTTP 429', now });
    markProviderFailure(provider, { statusCode: 429, reason: 'HTTP 429', now });
    expect(isProviderInCooldown(provider, now)).toBe(true);

    markProviderSuccess(provider);
    expect(provider.consecutiveFailures).toBe(0);
    expect(isProviderInCooldown(provider, Date.now())).toBe(false);
  });
});
