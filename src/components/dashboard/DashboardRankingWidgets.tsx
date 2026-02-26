import { getPerformanceGrade } from "./dashboardHelpers";

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

// ─── Grade Badge (S/A/B/C/D) ───
export function GradeBadge({ xp, size = "md" }: { xp: number; size?: "sm" | "md" | "lg" }) {
  const g = getPerformanceGrade(xp);
  const sizeClasses = {
    sm: "px-1.5 py-0.5 text-[8px] gap-0.5",
    md: "px-2 py-0.5 text-[10px] gap-1",
    lg: "px-3 py-1 text-xs gap-1",
  };
  const circleSize = { sm: "w-4 h-4 text-[8px]", md: "w-5 h-5 text-xs", lg: "w-6 h-6 text-sm" };
  return (
    <span
      className={`inline-flex items-center rounded-md font-black uppercase tracking-wider ${sizeClasses[size]}`}
      style={{
        background: g.glow,
        color: g.color,
        border: `1px solid ${g.color}50`,
        boxShadow: `0 0 8px ${g.glow}`,
        textShadow: `0 0 6px ${g.glow}`,
      }}
    >
      <span
        className={`inline-flex items-center justify-center rounded-full font-bold ${circleSize[size]}`}
        style={{ backgroundColor: g.color, color: "#1a1a2e" }}
      >
        {g.grade}
      </span>
      {g.grade}
    </span>
  );
}
