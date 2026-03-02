import type { ReactNode } from 'react';

interface FeatureCardProps {
  icon: ReactNode;
  title: string;
  description: string;
  features: string[];
}

export function FeatureCard({ icon, title, description, features }: FeatureCardProps) {
  return (
    <div className="p-6 rounded-2xl border border-white/10 bg-white/[0.02] hover:bg-white/[0.04] hover:border-white/25 transition-all">
      <div className="w-12 h-12 rounded-xl bg-white/[0.05] flex items-center justify-center mb-4 text-white/60">
        {icon}
      </div>
      <h3 className="text-lg font-semibold text-white/90 mb-2">{title}</h3>
      <p className="text-white/60 text-sm mb-4">{description}</p>
      <ul className="space-y-1.5 text-sm text-white/50">
        {features.map((feature, i) => (
          <li key={i} className="flex items-center gap-2">
            <span className="w-1 h-1 rounded-full bg-white/40" />
            {feature}
          </li>
        ))}
      </ul>
    </div>
  );
}
