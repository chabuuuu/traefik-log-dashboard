import type { BaseLayoutProps } from 'fumadocs-ui/layouts/shared';
import { GITHUB_URL, SITE_NAME } from '@/lib/site';

export function baseOptions(): BaseLayoutProps {
  return {
    nav: {
      title: SITE_NAME,
      transparentMode: 'always',
    },
    githubUrl: GITHUB_URL,
  };
}
