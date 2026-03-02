import type { BaseLayoutProps } from 'fumadocs-ui/layouts/shared';

export function baseOptions(): BaseLayoutProps {
  return {
    nav: {
      title: 'Middleware Manager',
      transparentMode: 'always',
    },
    githubUrl: 'https://github.com/hhftechnology/middleware-manager',
  };
}
