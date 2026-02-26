import { useState, useEffect } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import type { CliUsageEntry, CliUsageWindow } from "../../api";
import type { SupportedLocale } from "./officeViewTypes";
import type { LangText } from "../../i18n";
import { LOCALE_TEXT } from "./officeViewPalette";
import { formatReset } from "./officeViewHelpers";

const CLI_PANEL_COLLAPSED_KEY = "climpire.office.cliUsageCollapsed";

/* ================================================================== */
/*  CLI Usage Panel component                                          */
/* ================================================================== */

interface ConnectedCli {
  key: string;
  name: string;
  icon: React.ReactNode;
  color: string;
  bgColor: string;
}

interface CliUsagePanelProps {
  connectedClis: ConnectedCli[];
  cliUsage: Record<string, CliUsageEntry> | null;
  refreshing: boolean;
  language: SupportedLocale;
  t: (obj: LangText) => string;
  onRefresh: () => void;
}

export default function CliUsagePanel({
  connectedClis,
  cliUsage,
  refreshing,
  language,
  t,
  onRefresh,
}: CliUsagePanelProps) {
  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window === "undefined") return false;
    try {
      return window.localStorage.getItem(CLI_PANEL_COLLAPSED_KEY) === "1";
    } catch {
      return false;
    }
  });

  useEffect(() => {
    try {
      window.localStorage.setItem(CLI_PANEL_COLLAPSED_KEY, collapsed ? "1" : "0");
    } catch {
      /* ignore */
    }
  }, [collapsed]);

  const toggleCollapsed = () => setCollapsed((prev) => !prev);

  return (
    <div className="mt-4 px-2">
      <div className="rounded-2xl border border-slate-700/60 bg-slate-900/80 p-4 backdrop-blur-sm">
        <div className={`flex items-center justify-between ${collapsed ? "" : "mb-3"}`}>
          <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-200">
            <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-cyan-500/20">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" className="text-cyan-400">
                <path d="M12 2a10 10 0 1 0 10 10" />
                <path d="M12 2a10 10 0 0 1 10 10" strokeOpacity="0.3" />
                <path d="M12 6v6l4 2" />
              </svg>
            </span>
            {t(LOCALE_TEXT.cliUsageTitle)}
          </h3>
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-slate-800 px-2 py-0.5 text-[10px] text-slate-400">
              {connectedClis.length} {t(LOCALE_TEXT.cliConnected)}
            </span>
            <button
              onClick={onRefresh}
              disabled={refreshing}
              className="flex h-6 w-6 items-center justify-center rounded-lg bg-slate-800 text-slate-400 transition-colors hover:bg-slate-700 hover:text-slate-200 disabled:opacity-50"
              title={t(LOCALE_TEXT.cliRefreshTitle)}
              aria-label={t(LOCALE_TEXT.cliRefreshTitle)}
            >
              <svg
                width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                className={refreshing ? "animate-spin" : ""}
              >
                <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                <polyline points="21 3 21 9 15 9" />
              </svg>
            </button>
            <button
              type="button"
              onClick={toggleCollapsed}
              className="flex h-6 w-6 items-center justify-center rounded-lg bg-slate-800 text-slate-400 transition-colors hover:bg-slate-700 hover:text-slate-200"
              title={collapsed ? t(LOCALE_TEXT.cliExpandTitle) : t(LOCALE_TEXT.cliCollapseTitle)}
              aria-expanded={!collapsed}
              aria-label={collapsed ? t(LOCALE_TEXT.cliExpandTitle) : t(LOCALE_TEXT.cliCollapseTitle)}
            >
              {collapsed ? <ChevronDown width={14} height={14} /> : <ChevronUp width={14} height={14} />}
            </button>
          </div>
        </div>
        {!collapsed && (
        <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
          {connectedClis.map((cli) => {
            const usage = cliUsage?.[cli.key];
            return (
              <div
                key={cli.key}
                className={`group rounded-xl border ${cli.bgColor} p-3 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg`}
              >
                <div className="mb-2 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="flex h-[18px] w-[18px] items-center justify-center text-base">{cli.icon}</span>
                    <span className={`text-sm font-semibold ${cli.color}`}>{cli.name}</span>
                  </div>
                </div>

                {usage?.error === "unauthenticated" && (
                  <p className="text-[11px] text-slate-500 italic">{t(LOCALE_TEXT.cliNotSignedIn)}</p>
                )}
                {usage?.error === "not_implemented" && (
                  <p className="text-[11px] text-slate-500 italic">{t(LOCALE_TEXT.cliNoApi)}</p>
                )}
                {usage?.error && usage.error !== "unauthenticated" && usage.error !== "not_implemented" && (
                  <p className="text-[11px] text-slate-500 italic">{t(LOCALE_TEXT.cliUnavailable)}</p>
                )}
                {!usage && (
                  <p className="text-[11px] text-slate-500 italic">{t(LOCALE_TEXT.cliLoading)}</p>
                )}
                {usage && !usage.error && usage.windows.length > 0 && (
                  <div className={
                    usage.windows.length > 3
                      ? "grid grid-cols-1 gap-1.5 sm:grid-cols-2"
                      : "flex flex-col gap-1.5"
                  }>
                    {usage.windows.map((w: CliUsageWindow) => {
                      const pct = Math.round(w.utilization * 100);
                      const barColor =
                        pct >= 80 ? "bg-red-500" : pct >= 50 ? "bg-amber-400" : "bg-emerald-400";
                      return (
                        <div key={w.label}>
                          <div className="mb-0.5 flex items-center justify-between text-[10px]">
                            <span className="text-slate-400">{w.label}</span>
                            <span className="flex items-center gap-1.5">
                              <span className={pct >= 80 ? "font-semibold text-red-400" : pct >= 50 ? "text-amber-400" : "text-slate-400"}>
                                {pct}%
                              </span>
                              {w.resetsAt && (
                                <span className="text-slate-500">
                                  {t(LOCALE_TEXT.cliResets)} {formatReset(w.resetsAt, language)}
                                </span>
                              )}
                            </span>
                          </div>
                          <div className="h-2 overflow-hidden rounded-full bg-slate-700/60">
                            <div
                              className={`h-full rounded-full ${barColor} transition-all duration-700`}
                              style={{ width: `${Math.min(100, pct)}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
                {usage && !usage.error && usage.windows.length === 0 && (
                  <p className="text-[11px] text-slate-500 italic">{t(LOCALE_TEXT.cliNoData)}</p>
                )}
              </div>
            );
          })}
        </div>
        )}
      </div>
    </div>
  );
}
