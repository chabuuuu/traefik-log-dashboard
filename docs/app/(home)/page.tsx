import Image from 'next/image';
import Link from 'next/link';
import type { Metadata } from 'next';
import {
  ArrowRight,
  BookOpen,
  ChartNoAxesCombined,
  Clock3,
  Server,
  ShieldCheck,
  TerminalSquare,
} from 'lucide-react';
import {
  absoluteUrl,
  DISCORD_URL,
  GITHUB_URL,
  SITE_DESCRIPTION,
  SITE_NAME,
} from '@/lib/site';

const screenshotUrls = {
  dashboard:
    'https://github.com/user-attachments/assets/711a026b-c779-4b56-8be6-8471b9a7c144',
  client:
    'https://github.com/user-attachments/assets/8b3e9c85-00bb-473d-a0d8-695829b8e7d0',
  traffic:
    'https://github.com/user-attachments/assets/0077490c-4677-4c5a-87d2-d1ea25c42899',
  system:
    'https://github.com/user-attachments/assets/d769d9be-5232-4360-9d40-605ead33a7e4',
  overview:
    'https://github.com/user-attachments/assets/e9abfc8b-cea3-4913-86db-e8efdd8879e8',
  maps: 'https://github.com/user-attachments/assets/1ddfa5fd-eb15-43fd-a36a-39341d8c22ae',
};

const trustItems = ['Traefik', 'Docker', 'Go', 'Vite', 'SQLite', 'Discord Webhooks'];

const capabilityCards = [
  {
    title: 'Live traffic intelligence',
    description:
      'See request volume, latency, status codes, and top routes in one continuous stream.',
    image: screenshotUrls.traffic,
    href: '/docs/features',
  },
  {
    title: 'Global request visibility',
    description: 'Track request origins with map and globe views for fast operational context.',
    image: screenshotUrls.maps,
    href: '/docs/usage',
  },
  {
    title: 'System and agent health',
    description: 'Monitor CPU, memory, and disk from each connected agent without extra tooling.',
    image: screenshotUrls.system,
    href: '/docs/components/agent',
  },
  {
    title: 'Focused troubleshooting',
    description:
      'Filter by status ranges, routes, geography, and custom conditions to isolate incidents quickly.',
    image: screenshotUrls.client,
    href: '/docs/troubleshooting',
  },
];

const deploymentCards = [
  {
    title: 'Agent',
    description: 'High-performance Go API for parsing and serving Traefik logs near the source.',
    icon: Server,
    href: '/docs/components/agent',
    bullets: ['JSON and CLF support', 'Position tracking', 'Bearer token authentication'],
  },
  {
    title: 'Dashboard',
    description: 'Web analytics surface for teams that need always-on observability and quick filtering.',
    icon: ChartNoAxesCombined,
    href: '/docs/components/dashboard',
    bullets: ['Live charts and maps', 'Advanced filters', 'Background alerting workflows'],
  },
  {
    title: 'CLI',
    description:
      'Terminal-first monitoring with responsive panels for operators who prefer keyboard workflows.',
    icon: TerminalSquare,
    href: '/docs/components/cli',
    bullets: ['Real-time metrics', 'Demo mode', 'Fast keyboard navigation'],
  },
];

const faqItems = [
  {
    question: 'How quickly can I get a first dashboard running?',
    answer:
      'Most teams can run the Quick Start in under 5 minutes with Docker Compose and one authentication token.',
  },
  {
    question: 'Can I monitor multiple Traefik instances at once?',
    answer:
      'Yes. The dashboard supports multi-agent deployments so you can aggregate logs across cloud, edge, and datacenter environments.',
  },
  {
    question: 'Do I need to configure GeoIP before using maps?',
    answer:
      'No. HTTP-based provider mode works out of the box. You can optionally add a local MMDB for higher reliability.',
  },
  {
    question: 'Can I keep alerts active when the dashboard UI is closed?',
    answer:
      'Yes. Background alerting and webhook delivery are handled server-side so summaries and threshold alerts continue running.',
  },
  {
    question: 'Where do I find environment variable references?',
    answer:
      'Use the configuration docs for complete variable lists and examples for agent and dashboard deployments.',
  },
];

export const metadata: Metadata = {
  title: 'Traefik Observability Docs',
  description:
    'OpenPanel-inspired docs landing page for Traefik Log Dashboard with deployment guides, observability workflows, and production-ready references.',
  alternates: {
    canonical: absoluteUrl('/'),
  },
  openGraph: {
    title: `${SITE_NAME} Documentation`,
    description: SITE_DESCRIPTION,
    url: absoluteUrl('/'),
    images: [
      {
        url: screenshotUrls.dashboard,
        width: 1920,
        height: 1440,
        alt: 'Traefik Log Dashboard overview',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: `${SITE_NAME} Documentation`,
    description: SITE_DESCRIPTION,
    images: [screenshotUrls.dashboard],
  },
};

export default function HomePage() {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'SoftwareApplication',
        name: SITE_NAME,
        description: SITE_DESCRIPTION,
        applicationCategory: 'DeveloperApplication',
        operatingSystem: 'Linux, macOS, Windows',
        url: absoluteUrl('/'),
        sameAs: [GITHUB_URL],
      },
      {
        '@type': 'WebSite',
        name: `${SITE_NAME} Docs`,
        url: absoluteUrl('/'),
        description: SITE_DESCRIPTION,
      },
    ],
  };

  return (
    <main className="home-page home-grid-pattern relative overflow-hidden">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <div className="relative mx-auto max-w-7xl px-6 py-16 md:py-24">
        <section className="grid items-center gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:gap-12">
          <div className="home-reveal space-y-6">
            <p className="home-kicker">Traefik log observability platform</p>
            <h1 className="home-display text-4xl font-semibold leading-tight text-[var(--home-text-heading)] md:text-6xl">
              The open-source analytics workspace for Traefik operations.
            </h1>
            <p className="max-w-2xl text-base leading-7 text-[var(--home-text-body)] md:text-lg">
              Understand traffic patterns, diagnose errors faster, and keep distributed edge systems
              stable with one dashboard that connects your agents, metrics, and alerts.
            </p>

            <div className="flex flex-wrap gap-3">
              <Link
                href="/docs/quickstart"
                className="home-button-primary inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold"
              >
                Start Quick Guide
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/docs"
                className="home-button-secondary inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold"
              >
                <BookOpen className="h-4 w-4" />
                Read Documentation
              </Link>
            </div>

            <div className="flex flex-wrap gap-2 pt-2">
              {trustItems.map((item) => (
                <span key={item} className="home-chip rounded-full px-3 py-1 text-xs font-medium">
                  {item}
                </span>
              ))}
            </div>
          </div>

          <div className="home-reveal home-reveal-delay-1">
            <div className="home-surface overflow-hidden rounded-3xl p-3">
              <Image
                src={screenshotUrls.dashboard}
                alt="Traefik Log Dashboard analytics overview"
                width={1920}
                height={1440}
                className="h-auto w-full rounded-2xl border border-[var(--home-border-light)]"
                priority
              />
            </div>
          </div>
        </section>

        <section className="home-reveal home-reveal-delay-1 mt-16 md:mt-20">
          <div className="home-surface rounded-3xl px-5 py-5 md:px-8">
            <p className="home-kicker mb-4">Everything you need to understand your edge traffic</p>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {capabilityCards.map((card) => (
                <Link
                  key={card.title}
                  href={card.href}
                  className="home-surface-strong group rounded-2xl p-4 transition-transform hover:-translate-y-1"
                >
                  <div className="overflow-hidden rounded-xl border border-[var(--home-border-light)]">
                    <Image
                      src={card.image}
                      alt={card.title}
                      width={1920}
                      height={1440}
                      className="h-28 w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                    />
                  </div>
                  <h3 className="mt-4 text-base font-semibold text-[var(--home-text-heading)]">
                    {card.title}
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-[var(--home-text-body)]">{card.description}</p>
                  <span className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-[var(--home-accent)]">
                    Learn more <ArrowRight className="h-3.5 w-3.5" />
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </section>

        <section className="home-reveal home-reveal-delay-2 mt-16 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          <article className="home-surface rounded-2xl p-5">
            <p className="text-3xl font-semibold text-[var(--home-text-heading)]">100k+</p>
            <p className="mt-1 text-sm font-semibold text-[var(--home-text-heading)]">Logs/second processed</p>
            <p className="mt-2 text-sm text-[var(--home-text-muted)]">Optimized ingestion for busy edge gateways.</p>
          </article>
          <article className="home-surface rounded-2xl p-5">
            <p className="text-3xl font-semibold text-[var(--home-text-heading)]">3</p>
            <p className="mt-1 text-sm font-semibold text-[var(--home-text-heading)]">Core components</p>
            <p className="mt-2 text-sm text-[var(--home-text-muted)]">Agent, Dashboard, and CLI tuned for operations teams.</p>
          </article>
          <article className="home-surface rounded-2xl p-5">
            <p className="text-3xl font-semibold text-[var(--home-text-heading)]">50MB</p>
            <p className="mt-1 text-sm font-semibold text-[var(--home-text-heading)]">Agent footprint</p>
            <p className="mt-2 text-sm text-[var(--home-text-muted)]">Lightweight deployment profile for constrained environments.</p>
          </article>
          <article className="home-surface rounded-2xl p-5">
            <p className="text-3xl font-semibold text-[var(--home-text-heading)]">24/7</p>
            <p className="mt-1 text-sm font-semibold text-[var(--home-text-heading)]">Background alerting</p>
            <p className="mt-2 text-sm text-[var(--home-text-muted)]">Webhook summaries and incident notifications when you are offline.</p>
          </article>
        </section>

        <section className="home-reveal home-reveal-delay-2 mt-16 grid gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
          <div className="space-y-4">
            <p className="home-kicker">Turn data into action</p>
            <h2 className="home-display text-3xl font-semibold text-[var(--home-text-heading)] md:text-4xl">
              Reduce mean-time-to-diagnosis with high-signal dashboards.
            </h2>
            <p className="text-base leading-7 text-[var(--home-text-body)]">
              Spot regressions early with response-time trends, status code drift, and route-level
              anomalies. Move from broad traffic trends to exact failing endpoints in a few clicks.
            </p>
            <ul className="space-y-2 text-sm text-[var(--home-text-body)]">
              <li className="inline-flex items-center gap-2">
                <Clock3 className="h-4 w-4 text-[var(--home-accent)]" />
                Time-series monitoring with latency context
              </li>
              <li className="inline-flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-[var(--home-accent)]" />
                Geo-aware filtering for noisy traffic suppression
              </li>
              <li className="inline-flex items-center gap-2">
                <Server className="h-4 w-4 text-[var(--home-accent)]" />
                Multi-agent topology for distributed deployments
              </li>
            </ul>
          </div>

          <div className="home-surface rounded-3xl p-6">
            <div className="mb-6 overflow-hidden rounded-2xl border border-[var(--home-border-light)]">
              <Image
                src={screenshotUrls.overview}
                alt="Overview dashboard panel"
                width={1920}
                height={1440}
                className="h-56 w-full object-cover"
              />
            </div>
            <div className="grid h-32 grid-cols-6 items-end gap-2">
              {[34, 56, 41, 70, 52, 78].map((height, index) => (
                <div
                  key={height}
                  className="rounded-t-md bg-[var(--home-accent)]/80"
                  style={{ height: `${height}%`, opacity: 0.54 + index * 0.06 }}
                />
              ))}
            </div>
          </div>
        </section>

        <section className="home-reveal home-reveal-delay-3 mt-16">
          <div className="mb-6 flex items-end justify-between gap-4">
            <div>
              <p className="home-kicker">Deployment options</p>
              <h2 className="home-display text-3xl font-semibold text-[var(--home-text-heading)] md:text-4xl">
                Built for teams that ship and measure
              </h2>
            </div>
            <Link
              href="/docs/features"
              className="text-sm font-semibold text-[var(--home-accent)] hover:underline"
            >
              Explore feature docs
            </Link>
          </div>

          <div className="grid gap-5 lg:grid-cols-3">
            {deploymentCards.map((card) => {
              const Icon = card.icon;

              return (
                <article key={card.title} className="home-surface rounded-2xl p-6">
                  <div className="mb-4 inline-flex rounded-xl border border-[var(--home-border-light)] bg-[var(--home-fill-subtle)] p-2.5">
                    <Icon className="h-5 w-5 text-[var(--home-accent)]" />
                  </div>
                  <h3 className="text-xl font-semibold text-[var(--home-text-heading)]">{card.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-[var(--home-text-body)]">{card.description}</p>
                  <ul className="mt-4 space-y-2 text-sm text-[var(--home-text-muted)]">
                    {card.bullets.map((bullet) => (
                      <li key={bullet} className="flex items-center gap-2">
                        <span className="h-1.5 w-1.5 rounded-full bg-[var(--home-accent)]" />
                        {bullet}
                      </li>
                    ))}
                  </ul>
                  <Link
                    href={card.href}
                    className="mt-5 inline-flex items-center gap-1 text-sm font-semibold text-[var(--home-accent)] hover:underline"
                  >
                    Learn more <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </article>
              );
            })}
          </div>
        </section>

        <section className="home-reveal home-reveal-delay-3 mt-16 grid gap-6 lg:grid-cols-[0.75fr_1.25fr]">
          <div>
            <p className="home-kicker mb-2">FAQ</p>
            <h2 className="home-display text-3xl font-semibold text-[var(--home-text-heading)] md:text-4xl">Get started in minutes</h2>
            <p className="mt-3 text-sm leading-6 text-[var(--home-text-body)]">
              These are common setup and operations questions from teams adopting Traefik Log Dashboard.
            </p>
          </div>

          <div className="space-y-3">
            {faqItems.map((item) => (
              <details
                key={item.question}
                className="home-surface group rounded-2xl px-5 py-4 open:border-[var(--home-border-strong)]"
              >
                <summary className="cursor-pointer list-none text-sm font-semibold text-[var(--home-text-heading)]">
                  <span className="inline-flex items-center gap-2">
                    <ArrowRight className="h-4 w-4 text-[var(--home-accent)] transition-transform group-open:rotate-90" />
                    {item.question}
                  </span>
                </summary>
                <p className="pt-3 text-sm leading-6 text-[var(--home-text-body)]">{item.answer}</p>
              </details>
            ))}
          </div>
        </section>

        <section className="home-reveal home-reveal-delay-3 mt-16 rounded-3xl border border-[var(--home-border-medium)] bg-[var(--home-accent)] px-6 py-12 text-[#fff3e9] md:px-10">
          <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div className="max-w-2xl">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#f8d6c3]">Ready to deploy</p>
              <h2 className="mt-3 home-display text-3xl font-semibold text-[#fff7f2] md:text-4xl">
                Track Traefik traffic with production-ready observability.
              </h2>
              <p className="mt-3 text-sm leading-6 text-[#ffe7da]">
                Start with Quick Start, then expand into filtering, alerting, and multi-agent monitoring.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Link
                href="/docs/quickstart"
                className="inline-flex items-center gap-2 rounded-full bg-[#fff6ef] px-5 py-2.5 text-sm font-semibold text-[var(--home-accent-strong)]"
              >
                Launch Quick Start
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/docs"
                className="inline-flex items-center gap-2 rounded-full border border-[#f8d6c3] px-5 py-2.5 text-sm font-semibold text-[#fff5ec]"
              >
                Full Documentation
              </Link>
            </div>
          </div>
        </section>

        <footer className="mt-12 flex flex-wrap items-center justify-between gap-4 border-t border-[var(--home-border-light)] pt-6 text-sm text-[var(--home-text-muted)]">
          <p>Made for teams operating Traefik at scale.</p>
          <div className="flex items-center gap-4">
            <a href={GITHUB_URL} target="_blank" rel="noreferrer" className="hover:text-[var(--home-accent)]">
              GitHub
            </a>
            <a href={DISCORD_URL} target="_blank" rel="noreferrer" className="hover:text-[var(--home-accent)]">
              Discord
            </a>
            <Link href="/docs" className="inline-flex items-center gap-1 hover:text-[var(--home-accent)]">
              Docs <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </footer>
      </div>
    </main>
  );
}
