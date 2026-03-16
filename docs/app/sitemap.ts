import type { MetadataRoute } from 'next';
import { source } from '@/lib/source';
import { absoluteUrl } from '@/lib/site';

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const routeSet = new Set<string>(['/', '/docs']);

  for (const page of source.getPages()) {
    const docsPath = page.slugs.length > 0 ? `/docs/${page.slugs.join('/')}` : '/docs';
    routeSet.add(docsPath);
  }

  return Array.from(routeSet)
    .sort((a, b) => a.localeCompare(b))
    .map((path) => ({
      url: absoluteUrl(path),
      lastModified: now,
      changeFrequency: path === '/' ? 'weekly' : 'monthly',
      priority: path === '/' ? 1 : path === '/docs' ? 0.9 : 0.7,
    }));
}
