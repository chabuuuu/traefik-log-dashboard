import Link from 'next/link';
import { Github, Settings, Shield, Lock } from 'lucide-react';
import { StatCard, QuickLinksPanel, FeatureCard } from './components';

function DiscordIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515a.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0a12.64 12.64 0 0 0-.617-1.25a.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057a19.9 19.9 0 0 0 5.993 3.03a.078.078 0 0 0 .084-.028a14.09 14.09 0 0 0 1.226-1.994a.076.076 0 0 0-.041-.106a13.107 13.107 0 0 1-1.872-.892a.077.077 0 0 1-.008-.128a10.2 10.2 0 0 0 .372-.292a.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127a12.299 12.299 0 0 1-1.873.892a.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028a19.839 19.839 0 0 0 6.002-3.03a.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.956-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42c0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.955-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42c0 1.333-.946 2.418-2.157 2.418z" />
    </svg>
  );
}

export default function HomePage() {
  return (
    <main
      className="relative min-h-screen flex flex-col"
      style={{ backgroundColor: '#050505' }}
    >
      {/* Gradient overlay */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'linear-gradient(to bottom, rgba(255,255,255,0.03) 0%, transparent 40%, transparent 100%)',
        }}
      />

      {/* Content wrapper */}
      <div className="relative z-10 flex-1 w-full px-6 py-16 md:py-20 lg:py-24">
        <div className="max-w-7xl mx-auto">
          {/* Hero Section */}
          <section className="grid lg:grid-cols-[1.2fr_0.8fr] gap-12 lg:gap-16 items-start">
            {/* Left Column - Hero Content */}
            <div className="flex flex-col">
              {/* Badge */}
              <span className="inline-block uppercase text-xs tracking-[0.28em] text-white/40 mb-6">
                Middleware Manager &middot; Traefik &amp; Pangolin
              </span>

              {/* Heading */}
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-semibold tracking-tight text-white/90 leading-tight mb-6">
                Ship safer edge traffic with a single source of truth for Traefik.
              </h1>

              {/* Description */}
              <p className="text-lg text-white/60 max-w-2xl mb-8">
                Discover resources, apply middleware chains with priorities, install plugins, and
                enforce mTLS&mdash;all without touching raw YAML. Built for operators who need
                confidence and clarity at the edge.
              </p>

              {/* CTA Buttons */}
              <div className="flex flex-wrap gap-4 mb-8">
                <Link
                  href="/docs/quickstart"
                  className="px-5 py-2.5 bg-white text-black font-medium rounded-full hover:bg-white/90 transition-colors"
                >
                  Start the Guide
                </Link>
                <Link
                  href="/docs"
                  className="px-5 py-2.5 border border-white/15 text-white/80 font-medium rounded-full hover:bg-white/[0.05] hover:border-white/40 hover:text-white transition-colors"
                >
                  Browse Docs
                </Link>
              </div>

              {/* Social Links */}
              <div className="flex gap-6 mb-10">
                <a
                  href="https://github.com/hhftechnology/middleware-manager"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-white/40 hover:text-white/80 transition-colors"
                >
                  <Github className="w-5 h-5" />
                  <span className="text-sm">GitHub</span>
                </a>
                <a
                  href="https://discord.gg/PEGcTJPfJ2"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-white/40 hover:text-white/80 transition-colors"
                >
                  <DiscordIcon className="w-5 h-5" />
                  <span className="text-sm">Discord</span>
                </a>
              </div>

              {/* Stat Trio */}
              <div className="grid grid-cols-3 gap-4">
                <StatCard value="3" label="Components" sublabel="Agent, Dashboard, CLI" />
                <StatCard value="100k+" label="Logs/Second" sublabel="Processing Speed" />
                <StatCard value="50MB" label="Memory" sublabel="Agent Footprint" />
              </div>
            </div>

            {/* Right Column - Quick Links Panel */}
            <div className="lg:pt-12">
              <QuickLinksPanel />
            </div>
          </section>

          {/* Feature Highlights */}
          <section className="mt-20 lg:mt-24">
            <div className="grid md:grid-cols-3 gap-6">
              <FeatureCard
                icon={<Settings className="w-6 h-6" />}
                title="Unified Control Plane"
                description="Manage all Traefik resources from one interface."
                features={['Middlewares & chains', 'Routers & services', 'Plugins & mTLS']}
              />
              <FeatureCard
                icon={<Shield className="w-6 h-6" />}
                title="Safe Overrides"
                description="Apply changes with confidence and rollback."
                features={['Priority management', 'Service overrides', 'File-provider regen']}
              />
              <FeatureCard
                icon={<Lock className="w-6 h-6" />}
                title="Security First"
                description="Enterprise-grade security controls."
                features={['mTLS via mtlswhitelist', 'Access logging', 'Plugin hygiene']}
              />
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
