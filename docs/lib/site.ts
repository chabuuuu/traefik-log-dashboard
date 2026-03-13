const DEFAULT_SITE_URL = 'http://localhost:3000';

export const SITE_NAME = 'Traefik Log Dashboard';
export const SITE_DESCRIPTION =
  'Comprehensive real-time analytics platform for Traefik reverse proxy logs.';
export const GITHUB_URL = 'https://github.com/hhftechnology/traefik-log-dashboard';
export const DISCORD_URL = 'https://discord.gg/HDCt9MjyMJ';

export function getSiteUrl(): string {
  const raw = process.env.SITE_URL?.trim();

  if (!raw) {
    return DEFAULT_SITE_URL;
  }

  try {
    const withProtocol = raw.startsWith('http://') || raw.startsWith('https://') ? raw : `https://${raw}`;
    return new URL(withProtocol).toString().replace(/\/$/, '');
  } catch {
    return DEFAULT_SITE_URL;
  }
}

export function absoluteUrl(pathname: string): string {
  const normalizedPath = pathname.startsWith('/') ? pathname : `/${pathname}`;
  return new URL(normalizedPath, `${getSiteUrl()}/`).toString();
}
