import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import type { Request, Response, NextFunction } from 'express';
import { requireMobileApiKey } from './mobile';

function createMockRequest(
  headers: Record<string, string | undefined>,
  method: string = 'GET',
): Request {
  return {
    method,
    header: (name: string) => headers[name.toLowerCase()],
  } as unknown as Request;
}

function createMockResponse(): Response & { statusCode: number; body: unknown } {
  const headers: Record<string, string> = {};
  const res = {
    statusCode: 0,
    body: null as unknown,
    headers,
    status(code: number) {
      res.statusCode = code;
      return res;
    },
    json(data: unknown) {
      res.body = data;
      return res;
    },
    setHeader(name: string, value: string) {
      headers[name.toLowerCase()] = value;
      return res;
    },
    end() {
      return res;
    },
  };
  return res as unknown as Response & { statusCode: number; body: unknown };
}

describe('requireMobileApiKey', () => {
  let originalEnv: string | undefined;

  beforeEach(() => {
    originalEnv = process.env.MOBILE_API_KEY;
  });

  afterEach(() => {
    if (originalEnv !== undefined) {
      process.env.MOBILE_API_KEY = originalEnv;
    } else {
      delete process.env.MOBILE_API_KEY;
    }
  });

  it('returns 503 when MOBILE_API_KEY is not set', () => {
    delete process.env.MOBILE_API_KEY;
    const req = createMockRequest({});
    const res = createMockResponse();
    const next = vi.fn();

    requireMobileApiKey(req, res as unknown as Response, next);

    expect(res.statusCode).toBe(503);
    expect((res.body as { error: string }).error).toBe('Mobile API disabled');
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 401 when API key is missing from headers', () => {
    process.env.MOBILE_API_KEY = 'test-key-123';
    const req = createMockRequest({});
    const res = createMockResponse();
    const next = vi.fn();

    requireMobileApiKey(req, res as unknown as Response, next);

    expect(res.statusCode).toBe(401);
    expect((res.body as { error: string }).error).toBe('Unauthorized');
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 401 when API key is incorrect', () => {
    process.env.MOBILE_API_KEY = 'test-key-123';
    const req = createMockRequest({ 'x-api-key': 'wrong-key' });
    const res = createMockResponse();
    const next = vi.fn();

    requireMobileApiKey(req, res as unknown as Response, next);

    expect(res.statusCode).toBe(401);
    expect((res.body as { error: string }).error).toBe('Unauthorized');
    expect(next).not.toHaveBeenCalled();
  });

  it('calls next() when API key matches via X-API-Key header', () => {
    process.env.MOBILE_API_KEY = 'test-key-123';
    const req = createMockRequest({ 'x-api-key': 'test-key-123' });
    const res = createMockResponse();
    const next = vi.fn();

    requireMobileApiKey(req, res as unknown as Response, next);

    expect(next).toHaveBeenCalled();
    expect(res.statusCode).toBe(0); // status() was never called
  });

  it('calls next() when API key matches via Authorization Bearer header', () => {
    process.env.MOBILE_API_KEY = 'test-key-123';
    const req = createMockRequest({ authorization: 'Bearer test-key-123' });
    const res = createMockResponse();
    const next = vi.fn();

    requireMobileApiKey(req, res as unknown as Response, next);

    expect(next).toHaveBeenCalled();
    expect(res.statusCode).toBe(0);
  });

  it('is case-insensitive for Bearer prefix', () => {
    process.env.MOBILE_API_KEY = 'test-key-123';
    const req = createMockRequest({ authorization: 'bearer test-key-123' });
    const res = createMockResponse();
    const next = vi.fn();

    requireMobileApiKey(req, res as unknown as Response, next);

    expect(next).toHaveBeenCalled();
  });

  it('responds 204 with CORS headers for OPTIONS preflight', () => {
    delete process.env.MOBILE_API_KEY;
    const req = createMockRequest({}, 'OPTIONS');
    const res = createMockResponse();
    const next = vi.fn();

    requireMobileApiKey(req, res as unknown as Response, next);

    expect(res.statusCode).toBe(204);
    expect((res as unknown as { headers: Record<string, string> }).headers['access-control-allow-origin']).toBe('*');
    expect((res as unknown as { headers: Record<string, string> }).headers['access-control-allow-methods']).toBe('GET,POST,OPTIONS');
    expect((res as unknown as { headers: Record<string, string> }).headers['access-control-allow-headers']).toBe(
      'Content-Type, X-API-Key, Authorization, X-Agent-Id',
    );
    expect(next).not.toHaveBeenCalled();
  });

  it('responds 204 with CORS headers for OPTIONS preflight when API key is configured', () => {
    process.env.MOBILE_API_KEY = 'test-api-key-123';
    const req = createMockRequest({}, 'OPTIONS');
    const res = createMockResponse();
    const next = vi.fn();

    requireMobileApiKey(req, res as unknown as Response, next);

    expect(res.statusCode).toBe(204);
    expect((res as unknown as { headers: Record<string, string> }).headers['access-control-allow-origin']).toBe('*');
    expect((res as unknown as { headers: Record<string, string> }).headers['access-control-allow-methods']).toBe('GET,POST,OPTIONS');
    expect((res as unknown as { headers: Record<string, string> }).headers['access-control-allow-headers']).toBe(
      'Content-Type, X-API-Key, Authorization, X-Agent-Id',
    );
    expect(next).not.toHaveBeenCalled();
  });
});
