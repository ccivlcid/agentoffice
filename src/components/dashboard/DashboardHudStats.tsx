import type { TFunction } from './dashboardHelpers';
import { ClipboardList, CheckCircle2, Bot, Zap, ChevronDown, ChevronUp } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

const HUD_ICON_MAP: Record<string, LucideIcon> = {
  total: ClipboardList,
  clear: CheckCircle2,
  squad: Bot,
  active: Zap,
};

type HudStat = {
  id: string;
  label: string;
  value: number | string;
  sub: string;
  color: string;
};

interface DashboardHudStatsProps {
  hudStats: HudStat[];
  numberFormatter: Intl.NumberFormat;
  folded?: boolean;
  onToggleFold?: () => void;
  t?: TFunction;
}

export function buildHudStats(params: {
  totalTasks: number;
  completedTasks: number;
  completionRate: number;
  activeAgents: number;
  totalAgents: number;
  activeRate: number;
  inProgressTasks: number;
  plannedTasks: number;
  numberFormatter: Intl.NumberFormat;
  t: TFunction;
}): HudStat[] {
  const { totalTasks, completedTasks, completionRate, activeAgents, totalAgents, activeRate, inProgressTasks, plannedTasks, numberFormatter, t } = params;
  return [
    {
      id: 'total',
      label: t({ ko: '미션', en: 'MISSIONS' }),
      value: totalTasks,
      sub: t({ ko: '누적 태스크', en: 'Total tasks' }),
      color: '#3b82f6',
    },
    {
      id: 'clear',
      label: t({ ko: '완료율', en: 'CLEAR RATE' }),
      value: `${completionRate}%`,
      sub: `${numberFormatter.format(completedTasks)} ${t({ ko: '클리어', en: 'cleared' })}`,
      color: '#10b981',
    },
    {
      id: 'squad',
      label: t({ ko: '스쿼드', en: 'SQUAD' }),
      value: `${activeAgents}/${totalAgents}`,
      sub: `${t({ ko: '가동률', en: 'uptime' })} ${activeRate}%`,
      color: '#00f0ff',
    },
    {
      id: 'active',
      label: t({ ko: '진행중', en: 'IN PROGRESS' }),
      value: inProgressTasks,
      sub: `${t({ ko: '계획', en: 'planned' })} ${numberFormatter.format(plannedTasks)}${t({ ko: '건', en: '' })}`,
      color: '#f59e0b',
    },
  ];
}

export default function DashboardHudStats({
  hudStats,
  numberFormatter,
  folded = false,
  onToggleFold,
  t = (m) => m.en,
}: DashboardHudStatsProps) {
  const toggleLabel = folded
    ? t({ ko: 'KPI 펼치기', en: 'Expand KPI' })
    : t({ ko: 'KPI 접기', en: 'Collapse KPI' });

  if (folded) {
    return (
      <div className="game-panel flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-600/50 px-4 py-3">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-1">
          {hudStats.map((stat) => (
            <span key={stat.id} className="flex items-baseline gap-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--th-text-muted)' }}>
                {stat.label}
              </span>
              <span className="font-bold tracking-tight" style={{ color: stat.color }}>
                {typeof stat.value === 'number' ? numberFormatter.format(stat.value) : stat.value}
              </span>
            </span>
          ))}
        </div>
        {onToggleFold && (
          <button
            type="button"
            onClick={onToggleFold}
            className="rounded-lg p-1.5 transition hover:bg-white/10"
            aria-label={toggleLabel}
            title={toggleLabel}
          >
            <ChevronDown width={18} height={18} style={{ color: 'var(--th-text-muted)' }} aria-hidden />
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="relative">
      {onToggleFold && (
        <div className="mb-2 flex justify-end">
          <button
            type="button"
            onClick={onToggleFold}
            className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[10px] transition hover:bg-white/10"
            aria-label={toggleLabel}
            title={toggleLabel}
          >
            <ChevronUp width={14} height={14} style={{ color: 'var(--th-text-muted)' }} aria-hidden />
            <span style={{ color: 'var(--th-text-muted)' }}>{t({ ko: '접기', en: 'Collapse' })}</span>
          </button>
        </div>
      )}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {hudStats.map((stat) => (
          <div
            key={stat.id}
            className="game-panel group relative overflow-hidden p-4 transition-all duration-300 hover:-translate-y-0.5"
            style={{ borderColor: `${stat.color}25` }}
          >
            <div
              className="absolute top-0 left-0 right-0 h-[2px] opacity-60"
              style={{ background: `linear-gradient(90deg, transparent, ${stat.color}, transparent)` }}
            />
            <div className="relative flex items-center justify-between">
              <div>
                <p className="text-[9px] font-bold uppercase tracking-[0.15em]" style={{ color: 'var(--th-text-muted)' }}>{stat.label}</p>
                <p className="mt-1 text-3xl font-black tracking-tight" style={{ color: stat.color, textShadow: `0 0 20px ${stat.color}40` }}>
                  {typeof stat.value === 'number' ? numberFormatter.format(stat.value) : stat.value}
                </p>
                <p className="mt-0.5 text-[10px]" style={{ color: 'var(--th-text-muted)' }}>{stat.sub}</p>
              </div>
              {(() => {
                const IconComp = HUD_ICON_MAP[stat.id];
                return IconComp ? (
                  <IconComp
                    width={32} height={32}
                    className="opacity-20 transition-all duration-300 group-hover:opacity-40 group-hover:scale-110"
                    style={{ color: stat.color, filter: `drop-shadow(0 0 8px ${stat.color}40)` }}
                  />
                ) : null;
              })()}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
