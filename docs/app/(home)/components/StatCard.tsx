interface StatCardProps {
  value: string;
  label: string;
  sublabel?: string;
}

export function StatCard({ value, label, sublabel }: StatCardProps) {
  return (
    <div className="px-4 py-3 rounded-xl border border-white/10 bg-white/[0.02]">
      <div className="text-2xl font-semibold text-white/90">{value}</div>
      <div className="text-sm text-white/60">{label}</div>
      {sublabel && <div className="text-xs text-white/40 mt-0.5">{sublabel}</div>}
    </div>
  );
}
