# Traefik Log Dashboard Documentation

Official documentation for Traefik Log Dashboard, built with [Fumadocs](https://fumadocs.dev/).

##  Quick Start

### Development

```bash
npm install
npm run dev
```

Open http://localhost:3000 to view the documentation.

Set `SITE_URL` in your environment for canonical URLs, Open Graph metadata, and sitemap host values in production.

### Production Build

```bash
npm run build
npm run start
```

##  Structure

```
docs/
├── app/
│   ├── (home)/              # Landing page
│   ├── docs/                # Documentation pages
│   └── api/                 # API routes (search, etc.)
├── content/docs/            # MDX documentation files
│   ├── index.mdx           # Introduction
│   ├── quickstart.mdx      # Quick start guide
│   ├── features.mdx        # Features overview
│   ├── usage.mdx           # Usage guide
│   ├── troubleshooting.mdx # Troubleshooting
│   ├── changelog.mdx       # Release notes
│   ├── components/         # Component docs (agent, cli, dashboard)
│   └── configuration/      # Configuration docs (env vars, settings)
├── lib/                     # Source configuration
└── public/                  # Static assets
```

##  Writing Documentation

### Creating Pages

Create MDX files in `content/docs/`:

```mdx
---
title: Page Title
description: SEO description
icon: IconName  # Lucide icon
---

import { Callout } from 'fumadocs-ui/components/callout';

# Content Here

<Callout type="info">
Important note
</Callout>
```

### Available Components

- **Callouts**: `<Callout type="info|warn|error|success">`
- **Steps**: `<Steps>` and `<Step>`
- **Tabs**: `<Tabs>` and `<Tab>`
- **Cards**: `<Cards>` and `<Card>`
- **Code blocks**: ` ```language title="filename" `

### Icons

Use [Lucide icons](https://lucide.dev/) in frontmatter:

```mdx
---
icon: Home
---
```

## 🔍 Features

- Full-text search
- Dark mode
- Mobile responsive
- Mermaid diagrams
- Syntax highlighting
- Auto-generated navigation
- SEO metadata defaults with canonical URLs
- Auto-generated `sitemap.xml` and `robots.txt`

##  Deployment

Deploy to Vercel, Netlify, or any static hosting:

```bash
npm run build
```

Output in `.next/` directory.

### Alert worker (self-hosted)

- Start the headless scheduler without opening the UI: `npm run alert-worker` (honors `ENABLE_BACKGROUND_SCHEDULER`; default is on).
- Optional cron trigger: POST to `/api/services/trigger-alerts` with header `x-cron-secret: $CRON_SECRET` when `CRON_SECRET` is set.
- Check status at `/api/services/status` to confirm scheduler `isRunning`, `lastRunTime`, and `runCount`.
- Ensure agents are configured (env or DB) so the worker can fetch logs and build snapshots for daily/12h summaries.

##  Testing

```bash
# Type checking
npm run types:check

# Build test
npm run build
```

##  Learn More

- [Fumadocs Documentation](https://fumadocs.dev/)
- [Next.js Documentation](https://nextjs.org/docs)
- [MDX Documentation](https://mdxjs.com/)
