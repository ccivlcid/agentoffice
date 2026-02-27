import { useMemo, useState, useCallback } from "react";
import type { CompanyStats, Agent, Task } from "../types";
import { ViewGuide } from "./ui";
import { useI18n, useNow, DEPT_COLORS, groupAgentsByGrade } from "./dashboard/dashboardHelpers";
import DashboardGameHeader from "./dashboard/DashboardGameHeader";
import DashboardHudStats, { buildHudStats } from "./dashboard/DashboardHudStats";
import DashboardPerformance from "./dashboard/DashboardPerformance";
import DashboardDeptProgress from "./dashboard/DashboardDeptProgress";
import DashboardMissionLog from "./dashboard/DashboardMissionLog";
import DashboardCliUsage from "./dashboard/DashboardCliUsage";

const DASHBOARD_BLOCKS_FOLDED_KEY = "climpire.dashboard.blocksFolded";

interface DashboardProps {
  stats: CompanyStats | null;
  agents: Agent[];
  tasks: Task[];
  companyName: string;
  onPrimaryCtaClick: () => void;
  onSelectDepartment?: (deptId: string) => void;
  onNavigateToBreakRoom?: () => void;
  onOpenAgentManager?: () => void;
}

type BlocksFolded = { hud?: boolean; performance?: boolean; deptProgress?: boolean; missionLog?: boolean };

function readBlocksFolded(): BlocksFolded {
  try {
    const raw = typeof window !== "undefined" ? window.localStorage.getItem(DASHBOARD_BLOCKS_FOLDED_KEY) : null;
    if (raw) {
      const parsed = JSON.parse(raw) as BlocksFolded;
      if (parsed && typeof parsed === "object") return parsed;
    }
  } catch {
    // ignore
  }
  return {};
}

function writeBlocksFolded(next: BlocksFolded): void {
  try {
    if (typeof window !== "undefined") window.localStorage.setItem(DASHBOARD_BLOCKS_FOLDED_KEY, JSON.stringify(next));
  } catch {
    // ignore
  }
}

export default function Dashboard({
  stats,
  agents,
  tasks,
  companyName,
  onPrimaryCtaClick,
  onSelectDepartment,
  onOpenAgentManager,
}: DashboardProps) {
  const { t, locale, localeTag } = useI18n();
  const { date, time, briefing } = useNow(localeTag, t);
  const agentMap = useMemo(() => new Map(agents.map((a) => [a.id, a])), [agents]);
  const numberFormatter = useMemo(() => new Intl.NumberFormat(localeTag), [localeTag]);

  const [blocksFolded, setBlocksFolded] = useState<BlocksFolded>(readBlocksFolded);
  const hudFolded = blocksFolded.hud ?? false;
  const performanceFolded = blocksFolded.performance ?? false;
  const deptProgressFolded = blocksFolded.deptProgress ?? false;
  const missionLogFolded = blocksFolded.missionLog ?? false;

  const setBlockFolded = useCallback(<K extends keyof BlocksFolded>(key: K, value: boolean) => {
    setBlocksFolded((prev) => {
      const next = { ...prev, [key]: value };
      writeBlocksFolded(next);
      return next;
    });
  }, []);

  const setHudFolded = useCallback((v: boolean) => setBlockFolded("hud", v), [setBlockFolded]);
  const setPerformanceFolded = useCallback((v: boolean) => setBlockFolded("performance", v), [setBlockFolded]);
  const setDeptProgressFolded = useCallback((v: boolean) => setBlockFolded("deptProgress", v), [setBlockFolded]);
  const setMissionLogFolded = useCallback((v: boolean) => setBlockFolded("missionLog", v), [setBlockFolded]);

  const totalTasks = stats?.tasks?.total ?? tasks.length;
  const completedTasks = stats?.tasks?.done ?? tasks.filter((t) => t.status === "done").length;
  const inProgressTasks = stats?.tasks?.in_progress ?? tasks.filter((t) => t.status === "in_progress").length;
  const plannedTasks = stats?.tasks?.planned ?? tasks.filter((t) => t.status === "planned").length;
  const reviewTasks = stats?.tasks?.review ?? tasks.filter((t) => t.status === "review").length;
  const pendingTasks = tasks.filter((t) => t.status === "pending").length;
  const activeAgents = stats?.agents?.working ?? agents.filter((a) => a.status === "working").length;
  const idleAgents = stats?.agents?.idle ?? agents.filter((a) => a.status === "idle").length;
  const totalAgents = stats?.agents?.total ?? agents.length;
  const completionRate =
    stats?.tasks?.completion_rate ?? (totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0);
  const activeRate = totalAgents > 0 ? Math.round((activeAgents / totalAgents) * 100) : 0;
  const reviewQueue = reviewTasks + pendingTasks;
  const primaryCtaLabel = t({ ko: "미션 시작", en: "Start Mission" });
  const primaryCtaEyebrow = t({ ko: "빠른 실행", en: "Quick Start" });
  const primaryCtaDescription = t(
    totalTasks === 0
      ? { ko: "미션을 생성하세요", en: "Create your first mission." }
      : {
          ko: "핵심 업무를 바로 생성하고 실행으로 전환하세요",
          en: "Create a priority task and move execution immediately.",
        },
  );

  const allAgentsGraded = useMemo(
    () =>
      groupAgentsByGrade(
        agents
          .filter((a) => !(a as { disabled?: boolean }).disabled)
          .map((a) => ({
            id: a.id,
            name: locale === "ko" ? (a.name_ko ?? a.name) : (a.name ?? a.name_ko),
            department:
              locale === "ko"
                ? (a.department?.name_ko ?? a.department?.name ?? "")
                : (a.department?.name ?? a.department?.name_ko ?? ""),
            tasksDone: a.stats_tasks_done,
            xp: a.stats_xp,
          })),
      ),
    [agents, locale],
  );

  const deptData = useMemo(() => {
    if (stats?.tasks_by_department && stats.tasks_by_department.length > 0) {
      return stats.tasks_by_department
        .map((d, i) => ({
          id: d.id,
          name: d.name,
          icon: d.icon ?? "",
          done: d.done_tasks,
          total: d.total_tasks,
          ratio: d.total_tasks > 0 ? Math.round((d.done_tasks / d.total_tasks) * 100) : 0,
          color: DEPT_COLORS[i % DEPT_COLORS.length],
        }))
        .sort((a, b) => b.ratio - a.ratio || b.total - a.total);
    }
    const deptMap = new Map<string, { name: string; icon: string; done: number; total: number }>();
    for (const agent of agents) {
      if (!agent.department_id) continue;
      if (!deptMap.has(agent.department_id)) {
        deptMap.set(agent.department_id, {
          name:
            locale === "ko"
              ? (agent.department?.name_ko ?? agent.department?.name ?? agent.department_id)
              : (agent.department?.name ?? agent.department?.name_ko ?? agent.department_id),
          icon: agent.department?.icon ?? "",
          done: 0,
          total: 0,
        });
      }
    }
    for (const task of tasks) {
      if (!task.department_id) continue;
      const entry = deptMap.get(task.department_id);
      if (!entry) continue;
      entry.total += 1;
      if (task.status === "done") entry.done += 1;
    }
    return Array.from(deptMap.entries())
      .map(([id, value], i) => ({
        id,
        ...value,
        ratio: value.total > 0 ? Math.round((value.done / value.total) * 100) : 0,
        color: DEPT_COLORS[i % DEPT_COLORS.length],
      }))
      .sort((a, b) => b.ratio - a.ratio || b.total - a.total);
  }, [stats, agents, tasks, locale]);

  const recentTasks = useMemo(() => [...tasks].sort((a, b) => b.updated_at - a.updated_at).slice(0, 6), [tasks]);

  const hudStats = buildHudStats({
    totalTasks,
    completedTasks,
    completionRate,
    activeAgents,
    totalAgents,
    activeRate,
    inProgressTasks,
    plannedTasks,
    numberFormatter,
    t,
  });

  return (
    <section
      className="relative isolate space-y-4 max-w-7xl mx-auto"
      style={{ color: "var(--th-text-primary)" }}
      aria-label={t({ ko: "대시보드", en: "Dashboard" })}
    >
      <div className="pointer-events-none absolute -left-40 -top-32 h-96 w-96 rounded-full bg-violet-600/10 blur-[100px] animate-drift-slow" />
      <div className="pointer-events-none absolute -right-32 top-20 h-80 w-80 rounded-full bg-cyan-500/10 blur-[100px] animate-drift-slow-rev" />
      <div className="pointer-events-none absolute left-1/3 bottom-32 h-72 w-72 rounded-full bg-amber-500/[0.05] blur-[80px]" />

      <DashboardGameHeader
        companyName={companyName}
        time={time}
        date={date}
        briefing={briefing}
        reviewQueue={reviewQueue}
        numberFormatter={numberFormatter}
        primaryCtaLabel={primaryCtaLabel}
        primaryCtaEyebrow={primaryCtaEyebrow}
        primaryCtaDescription={primaryCtaDescription}
        onPrimaryCtaClick={onPrimaryCtaClick}
        t={t}
      />

      <ViewGuide
        title={t({ ko: "사용법 및 가이드", en: "Usage & Guide" })}
        defaultOpen={false}
      >
        <p>
          {t({
            ko: "대시보드는 전사 지표, 에이전트 성과, 부서별 진행률, 최근 미션 로그를 한눈에 보는 뷰입니다.",
            en: "Dashboard shows company metrics, agent performance, department progress, and recent mission log at a glance.",
          })}
        </p>
        <ul className="list-disc list-inside space-y-1.5 text-slate-400">
          <li>{t({ ko: "「미션 시작」으로 업무 관리 뷰로 이동해 새 태스크를 만들 수 있습니다.", en: "Use \"Start Mission\" to go to Tasks and create new tasks." })}</li>
          <li>{t({ ko: "각 블록은 접기/펼치기가 가능하며, 상태가 저장됩니다.", en: "Each block can be collapsed; state is saved." })}</li>
        </ul>
      </ViewGuide>

      <DashboardHudStats
        hudStats={hudStats}
        numberFormatter={numberFormatter}
        folded={hudFolded}
        onToggleFold={() => setHudFolded(!hudFolded)}
        t={t}
        reviewQueue={reviewQueue}
        inProgressTasks={inProgressTasks}
        onQuickActionClick={onPrimaryCtaClick}
      />

      <DashboardPerformance
        gradeGroups={allAgentsGraded}
        agents={agents}
        agentMap={agentMap}
        numberFormatter={numberFormatter}
        t={t}
        locale={locale}
        folded={performanceFolded}
        onToggleFold={() => setPerformanceFolded(!performanceFolded)}
        onOpenAgentManager={onOpenAgentManager}
      />

      <DashboardDeptProgress
        deptData={deptData}
        numberFormatter={numberFormatter}
        t={t}
        onSelectDepartment={onSelectDepartment}
        folded={deptProgressFolded}
        onToggleFold={() => setDeptProgressFolded(!deptProgressFolded)}
      />

      <DashboardMissionLog
        recentTasks={recentTasks}
        agents={agents}
        agentMap={agentMap}
        idleAgents={idleAgents}
        numberFormatter={numberFormatter}
        localeTag={localeTag}
        locale={locale}
        t={t}
        onNavigateToTasks={onPrimaryCtaClick}
        folded={missionLogFolded}
        onToggleFold={() => setMissionLogFolded(!missionLogFolded)}
      />

      <DashboardCliUsage tasks={tasks} language={locale} t={t} />
    </section>
  );
}
