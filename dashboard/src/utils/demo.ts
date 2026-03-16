import { TraefikLog } from './types';

const METHODS = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'];
const PATHS = [
  '/api/users',
  '/api/products',
  '/api/orders',
  '/api/auth/login',
  '/api/auth/logout',
  '/api/dashboard',
  '/api/settings',
  '/health',
  '/metrics',
  '/api/payments',
];
const ROUTERS = [
  'api-router',
  'web-router',
  'admin-router',
  'public-router',
  'internal-router',
];
const SERVICES = [
  'backend-service',
  'api-service',
  'auth-service',
  'payment-service',
  'notification-service',
];
const SERVICE_URLS = [
  'http://backend:8080',
  'http://api:3000',
  'http://auth:4000',
  'http://payment:5000',
  'http://notification:6000',
];
const ENTRY_POINTS = ['web', 'websecure', 'admin', 'metrics'];
const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15',
];
const REFERERS = [
  'https://google.com',
  'https://github.com',
  'https://stackoverflow.com',
  'direct',
  '',
];

const IP_PREFIXES = [
  '8.8.8',
  '192.168.1',
  '10.0.0',
  '172.16.0',
  '66.249.64',
  '80.12.34',
  '82.45.67',
  '84.23.45',
  '103.21.244',
  '106.12.34',
  '114.45.67',
  '200.123.45',
];

/**
 * Generate random IP address
 */
function randomIP(): string {
  const prefix = IP_PREFIXES[Math.floor(Math.random() * IP_PREFIXES.length)];
  const suffix = Math.floor(Math.random() * 255);
  return `${prefix}.${suffix}`;
}

/**
 * Generate random timestamp within last N minutes
 */
function randomTimestamp(minutesAgo: number = 60): string {
  const now = new Date();
  const past = new Date(now.getTime() - minutesAgo * 60 * 1000);
  const randomTime = new Date(
    past.getTime() + Math.random() * (now.getTime() - past.getTime())
  );
  return randomTime.toISOString();
}

/**
 * Generate random status code with realistic distribution
 */
function randomStatus(): number {
  const rand = Math.random();
  if (rand < 0.7) return 200; // 70% success
  if (rand < 0.85) return 201; // 15% created
  if (rand < 0.90) return 304; // 5% not modified
  if (rand < 0.95) return 404; // 5% not found
  if (rand < 0.98) return 400; // 3% bad request
  return 500; // 2% server error
}

/**
 * Generate random duration with realistic distribution (in nanoseconds)
 */
function randomDuration(): number {
  const rand = Math.random();
  if (rand < 0.5) return Math.floor(Math.random() * 50000000); // 0-50ms (50%)
  if (rand < 0.8) return Math.floor(Math.random() * 150000000) + 50000000; // 50-200ms (30%)
  if (rand < 0.95) return Math.floor(Math.random() * 300000000) + 200000000; // 200-500ms (15%)
  return Math.floor(Math.random() * 2000000000) + 500000000; // 500ms-2s (5%)
}

/**
 * Generate a single demo Traefik log
 */
export function generateDemoLog(timestamp?: string): TraefikLog {
  const ip = randomIP();
  const port = Math.floor(Math.random() * 60000) + 1024;
  const method = METHODS[Math.floor(Math.random() * METHODS.length)];
  const path = PATHS[Math.floor(Math.random() * PATHS.length)];
  const status = randomStatus();
  const duration = randomDuration();
  const originDuration = Math.floor(duration * 0.8);
  const overhead = duration - originDuration;
  const size = Math.floor(Math.random() * 10000);
  const router = ROUTERS[Math.floor(Math.random() * ROUTERS.length)];
  const service = SERVICES[Math.floor(Math.random() * SERVICES.length)];
  const serviceURL = SERVICE_URLS[Math.floor(Math.random() * SERVICE_URLS.length)];
  const entryPoint = ENTRY_POINTS[Math.floor(Math.random() * ENTRY_POINTS.length)];
  const userAgent = USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
  const referer = REFERERS[Math.floor(Math.random() * REFERERS.length)];
  const ts = timestamp || randomTimestamp();

  return {
    ClientAddr: `${ip}:${port}`,
    ClientHost: ip,
    ClientPort: port.toString(),
    ClientUsername: '',
    DownstreamContentSize: size,
    DownstreamStatus: status,
    Duration: duration,
    OriginContentSize: size,
    OriginDuration: originDuration,
    OriginStatus: status,
    Overhead: overhead,
    RequestAddr: `${ip}:${port}`,
    RequestContentSize: method === 'POST' || method === 'PUT' ? Math.floor(Math.random() * 5000) : 0,
    RequestCount: Math.floor(Math.random() * 10) + 1,
    RequestHost: 'example.com',
    RequestMethod: method,
    RequestPath: path,
    RequestPort: '443',
    RequestProtocol: 'HTTP/1.1',
    RequestScheme: 'https',
    RetryAttempts: Math.random() < 0.05 ? Math.floor(Math.random() * 3) : 0,
    RouterName: router,
    ServiceAddr: serviceURL.replace('http://', '').replace('https://', ''),
    ServiceName: service,
    ServiceURL: serviceURL,
    StartLocal: ts,
    StartUTC: ts,
    entryPointName: entryPoint,
    RequestReferer: referer,
    RequestUserAgent: userAgent,
  };
}

/**
 * Generate multiple demo logs
 */
export function generateDemoLogs(count: number = 100): TraefikLog[] {
  const logs: TraefikLog[] = [];
  
  for (let i = 0; i < count; i++) {
    logs.push(generateDemoLog());
  }
  
  // Sort by timestamp (newest first)
  return logs.sort((a, b) => 
    new Date(b.StartUTC).getTime() - new Date(a.StartUTC).getTime()
  );
}

/**
 * Generate time series demo logs (for timeline visualization)
 */
export function generateTimeSeriesLogs(
  points: number = 60,
  logsPerPoint: number = 10
): TraefikLog[] {
  const logs: TraefikLog[] = [];
  const now = new Date();
  
  for (let i = points - 1; i >= 0; i--) {
    const timestamp = new Date(now.getTime() - i * 60 * 1000).toISOString();
    
    for (let j = 0; j < logsPerPoint; j++) {
      logs.push(generateDemoLog(timestamp));
    }
  }
  
  return logs;
}