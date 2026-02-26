import { Award, ChevronDown, ChevronUp, Swords } from "lucide-react";
import type { Agent } from "../../types";
import type { PerformanceGrade, TFunction, Locale } from "./dashboardHelpers";
import { PERFORMANCE_GRADES } from "./dashboardHelpers";
import AgentAvatar from "../AgentAvatar";
import { XpBar, GradeBadge } from "./DashboardRankingWidgets";

export type GradedAgent = {
  id: string;
  name: string;
  department: string;
  tasksDone: number;
  xp: number;
};

interface DashboardPerformanceProps {
  gradeGroups: Array<{ grade: PerformanceGrade; agents: GradedAgent[] }>;
  agents: Agent[];
  agentMap: Map<string, Agent>;
  numberFormatter: Intl.NumberFormat;
  t: TFunction;
  locale: Locale;
  folded?: boolean;
  onToggleFold?: () => void;
  onOpenAgentManager?: () => void;
}

function gradeMaxXp(grade: PerformanceGrade): number {
  const idx = PERFORMANCE_GRADES.findIndex((g) => g.grade === grade.grade);
  return idx > 0 ? PERFORMANCE_GRADES[idx - 1].minXp : grade.minXp + 5000;
}

export default function DashboardPerformance({
  gradeGroups,
  agents,
  agentMap,
  numberFormatter,
  t,
  locale,
  folded = false,
  onToggleFold,
  onOpenAgentManager,
}: DashboardPerformanceProps) {
  const toggleLabel = folded
    ? t({ ko: "성과관리 펼치기", en: "Expand performance" })
    : t({ ko: "성과관리 접기", en: "Collapse performance" });

  const totalAgents = gradeGroups.reduce((s, g) => s + g.agents.length, 0);

  return (
    <div className="game-panel relative overflow-hidden p-5">
      <h2
        className="mb-4 flex items-center gap-2 text-sm font-black uppercase tracking-wider"
        style={{ color: "var(--th-text-primary)" }}
      >
        <span
          className="flex h-7 w-7 items-center justify-center rounded-lg bg-violet-500/15"
          style={{ boxShadow: "0 0 8px rgba(196,95,246,0.3)" }}
        >
          <Award width={14} height={14} className="text-violet-400" />
        </span>
        {t({ ko: "성과관리", en: "PERFORMANCE" })}
        <span className="rounded-md border border-violet-400/30 bg-violet-500/15 px-2 py-0.5 text-[10px] font-bold text-violet-300">
          {totalAgents}
        </span>
        <span
          className="ml-auto text-[9px] font-medium normal-case tracking-normal"
          style={{ color: "var(--th-text-muted)" }}
        >
          {t({ ko: "XP 기준 에이전트 등급", en: "Agent grades by XP" })}
        </span>
        {onToggleFold && (
          <button
            type="button"
            onClick={onToggleFold}
            className="rounded-lg p-1.5 transition hover:bg-white/10"
            aria-label={toggleLabel}
            title={toggleLabel}
          >
            {folded ? (
              <ChevronDown width={16} height={16} style={{ color: "var(--th-text-muted)" }} aria-hidden />
            ) : (
              <ChevronUp width={16} height={16} style={{ color: "var(--th-text-muted)" }} aria-hidden />
            )}
          </button>
        )}
      </h2>

      {folded ? (
        <div className="flex flex-wrap gap-2 text-xs font-semibold">
          {PERFORMANCE_GRADES.map((pg) => {
            const count = gradeGroups.find((g) => g.grade.grade === pg.grade)?.agents.length ?? 0;
            return (
              <span key={pg.grade} className="rounded-md px-2 py-0.5" style={{ color: pg.color, background: pg.glow }}>
                {pg.grade}:{count}
              </span>
            );
          })}
        </div>
      ) : totalAgents === 0 ? (
        <div
          className="flex min-h-[200px] flex-col items-center justify-center gap-3 text-sm"
          style={{ color: "var(--th-text-muted)" }}
        >
          <Swords width={36} height={36} className="opacity-30" />
          <p>{t({ ko: "등록된 에이전트가 없습니다", en: "No agents registered" })}</p>
          {onOpenAgentManager && (
            <button
              type="button"
              onClick={onOpenAgentManager}
              className="rounded-lg border border-violet-400/40 bg-violet-500/15 px-4 py-2 text-xs font-semibold text-violet-200 transition hover:bg-violet-500/25"
            >
              {t({ ko: "에이전트 관리", en: "Manage agents" })}
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {gradeGroups.map(({ grade, agents: graded }) => {
            const maxXp = gradeMaxXp(grade);
            return (
              <section
                key={grade.grade}
                className="overflow-hidden rounded-xl border-l-[3px] bg-white/[0.02]"
                style={{ borderColor: grade.color }}
              >
                <div className="flex items-center gap-2 px-3 py-2" style={{ background: `${grade.glow}` }}>
                  <span
                    className="flex h-6 w-6 items-center justify-center rounded-lg text-xs font-black"
                    style={{ backgroundColor: `${grade.color}30`, color: grade.color }}
                  >
                    {grade.grade}
                  </span>
                  <span className="text-xs font-bold" style={{ color: grade.color }}>
                    {locale === "ko" ? grade.nameKo : grade.nameEn}
                  </span>
                  <span className="text-[10px] font-medium" style={{ color: "var(--th-text-muted)" }}>
                    — {graded.length}
                    {t({ ko: "명", en: graded.length === 1 ? " agent" : " agents" })}
                  </span>
                </div>
                <div className="space-y-0.5 p-1.5">
                  {graded.map((agent) => {
                    const raw = agentMap.get(agent.id);
                    return (
                      <div
                        key={agent.id}
                        className="flex items-center gap-3 rounded-lg px-2 py-2 transition-all duration-150 hover:bg-white/[0.05] hover:translate-x-1"
                      >
                        <div className="flex-shrink-0">
                          {raw ? (
                            <AgentAvatar agent={raw} agents={agents} size={36} rounded="xl" />
                          ) : (
                            <div className="h-9 w-9 rounded-xl bg-slate-700" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium" style={{ color: "var(--th-text-primary)" }}>
                            {agent.name}
                          </p>
                          {agent.department && (
                            <p className="truncate text-[10px]" style={{ color: "var(--th-text-muted)" }}>
                              {agent.department}
                            </p>
                          )}
                        </div>
                        <div className="hidden w-24 sm:block">
                          <XpBar xp={agent.xp} maxXp={maxXp} color={grade.color} />
                        </div>
                        <span className="text-xs font-bold tabular-nums" style={{ color: grade.color }}>
                          {numberFormatter.format(agent.xp)} XP
                        </span>
                        <GradeBadge xp={agent.xp} size="sm" />
                      </div>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
