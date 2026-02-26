import { Clock, Bell, Rocket } from "lucide-react";
import type { LangText } from "../../i18n";

interface DashboardGameHeaderProps {
  companyName: string;
  time: string;
  date: string;
  briefing: string;
  reviewQueue: number;
  numberFormatter: Intl.NumberFormat;
  primaryCtaLabel: string;
  primaryCtaEyebrow: string;
  primaryCtaDescription: string;
  onPrimaryCtaClick: () => void;
  t: (obj: LangText) => string;
}

export default function DashboardGameHeader({
  companyName,
  time,
  date,
  briefing,
  reviewQueue,
  numberFormatter,
  primaryCtaLabel,
  primaryCtaEyebrow,
  primaryCtaDescription,
  onPrimaryCtaClick,
  t,
}: DashboardGameHeaderProps) {
  return (
    <div className="game-panel relative overflow-hidden p-5">
      <div className="pointer-events-none absolute inset-0 bg-[repeating-linear-gradient(0deg,transparent,transparent_2px,rgba(0,0,0,0.03)_2px,rgba(0,0,0,0.03)_4px)]" />
      <div className="relative flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1.5">
          <div className="flex items-center gap-3">
            <h1 className="dashboard-title-gradient text-2xl font-black tracking-tight sm:text-3xl">{companyName}</h1>
            <span className="flex items-center gap-1.5 rounded-full border border-emerald-400/40 bg-emerald-500/15 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-widest text-emerald-300">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
              {t({ ko: "실시간", en: "LIVE" })}
            </span>
          </div>
          <p className="text-xs" style={{ color: "var(--th-text-muted)" }}>
            {t({
              ko: "에이전트들이 실시간으로 미션을 수행 중입니다",
              en: "Agents are executing missions in real time",
            })}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <div className="flex items-center gap-2 rounded-xl border border-cyan-400/20 bg-cyan-500/[0.06] px-4 py-2">
            <Clock width={14} height={14} className="text-cyan-400/60" aria-hidden />
            <span className="dashboard-time-display font-mono text-xl font-bold tracking-tight">{time}</span>
          </div>
          <div className="flex flex-wrap items-center gap-1.5 rounded-lg border border-white/[0.06] bg-white/[0.03] px-2.5 py-1.5 text-[10px]">
            <span className="text-slate-400">{date}</span>
            <span className="text-slate-600" aria-hidden>
              ·
            </span>
            <span className="text-cyan-300">{briefing}</span>
          </div>
          {reviewQueue > 0 && (
            <span
              className="flex items-center gap-1.5 rounded-lg border border-orange-400/30 bg-orange-500/15 px-3 py-1.5 text-xs font-bold text-orange-300 animate-neon-pulse-orange"
              role="status"
              aria-label={t({ ko: `리뷰 대기 ${reviewQueue}건`, en: `${reviewQueue} in review queue` })}
            >
              <Bell width={14} height={14} className="inline -mt-0.5" aria-hidden />
              {t({ ko: "대기", en: "Queued" })} {numberFormatter.format(reviewQueue)}
              {t({ ko: "건", en: "" })}
            </span>
          )}
        </div>
      </div>
      <div className="relative mt-4 rounded-xl border border-cyan-400/40 bg-gradient-to-r from-cyan-500/20 via-blue-500/15 to-emerald-500/20 p-4 shadow-[0_0_20px_rgba(34,211,238,0.12)]">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-cyan-200/85">{primaryCtaEyebrow}</p>
            <p className="mt-1 text-xs sm:text-sm" style={{ color: "var(--th-text-primary)" }}>
              {primaryCtaDescription}
            </p>
          </div>
          <button
            type="button"
            onClick={onPrimaryCtaClick}
            className="animate-cta-glow group inline-flex w-full items-center justify-center gap-2 rounded-xl border-0 bg-gradient-to-r from-cyan-500 to-blue-500 px-6 py-3 text-sm font-black tracking-tight text-white shadow-[0_4px_20px_rgba(34,211,238,0.35)] transition-all duration-200 hover:-translate-y-0.5 hover:from-cyan-400 hover:to-blue-400 hover:shadow-[0_8px_30px_rgba(34,211,238,0.5)] active:translate-y-0 sm:w-auto sm:min-w-[200px]"
          >
            <Rocket width={16} height={16} aria-hidden="true" />
            <span>{primaryCtaLabel}</span>
            <span
              className="text-xs text-white/80 transition-transform duration-200 group-hover:translate-x-0.5"
              aria-hidden="true"
            >
              →
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
