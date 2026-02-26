import { getRankTier } from './dashboardHelpers';

// ─── XP Progress Bar ───
export function XpBar({ xp, maxXp, color }: { xp: number; maxXp: number; color: string }) {
  const pct = maxXp > 0 ? Math.min(100, Math.round((xp / maxXp) * 100)) : 0;
  return (
    <div className="relative h-2.5 w-full overflow-hidden rounded-full border border-white/[0.08] bg-white/[0.04]">
      <div
        className="xp-bar-fill h-full rounded-full transition-all duration-1000 ease-out"
        style={{
          width: `${pct}%`,
          background: `linear-gradient(90deg, ${color}88, ${color})`,
          boxShadow: `0 0 8px ${color}60`,
        }}
      />
    </div>
  );
}

// ─── Rank Badge ───
export function RankBadge({ xp, size = 'md' }: { xp: number; size?: 'sm' | 'md' | 'lg' }) {
  const tier = getRankTier(xp);
  const sizeClasses = {
    sm: 'px-1.5 py-0.5 text-[8px] gap-0.5',
    md: 'px-2 py-0.5 text-[10px] gap-1',
    lg: 'px-3 py-1 text-xs gap-1',
  };
  return (
    <span
      className={`inline-flex items-center rounded-md font-black uppercase tracking-wider ${sizeClasses[size]}`}
      style={{
        background: tier.glow,
        color: tier.color,
        border: `1px solid ${tier.color}50`,
        boxShadow: `0 0 8px ${tier.glow}`,
        textShadow: `0 0 6px ${tier.glow}`,
      }}
    >
      <span className="inline-flex items-center justify-center w-5 h-5 rounded-full text-xs font-bold" style={{ backgroundColor: tier.color, color: '#1a1a2e' }}>{tier.label}</span> {tier.name}
    </span>
  );
}
