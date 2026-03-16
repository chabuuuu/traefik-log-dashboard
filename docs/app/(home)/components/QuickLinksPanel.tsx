import Link from 'next/link';
import { ChevronRight } from 'lucide-react';

const quickLinks = [
  { href: '/docs/quickstart', label: 'Onboarding' },
  { href: '/docs/usage', label: 'Deploy with Pangolin' },
  { href: '/docs/configuration', label: 'Deploy with Traefik' },
  { href: '/docs/features', label: 'Resources & Routers' },
  { href: '/docs/components/dashboard', label: 'Middlewares' },
  { href: '/docs/components/agent', label: 'Plugin Hub' },
  { href: '/docs/troubleshooting', label: 'Security & Risks' },
];

export function QuickLinksPanel() {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-6">
      <h3 className="text-lg font-medium text-white/90 mb-4">Quick paths</h3>
      <div className="grid gap-2">
        {quickLinks.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="group flex items-center gap-3 px-4 py-3 rounded-xl border border-white/10 bg-white/[0.02] hover:bg-white/[0.05] hover:border-white/20 transition-all text-white/70 hover:text-white"
          >
            <ChevronRight className="w-4 h-4 text-white/40 group-hover:text-white/60 transition-colors" />
            <span className="text-sm font-medium">{link.label}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
