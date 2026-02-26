import { useMemo, useState, useCallback } from 'react';
import { Clock, Bell, Rocket } from 'lucide-react';
import type { CompanyStats, Agent, Task } from '../types';
import { useI18n, useNow, DEPT_COLORS } from './dashboard/dashboardHelpers';
import DashboardHudStats, { buildHudStats } from './dashboard/DashboardHudStats';
import DashboardRankingBoard from './dashboard/DashboardRankingBoard';
import DashboardGuildSquad from './dashboard/DashboardGuildSquad';
import DashboardMissionLog from './dashboard/DashboardMissionLog';

const DASHBOARD_BLOCKS_FOLDED_KEY = 'climpire.dashboard.blocksFolded';

interface DashboardProps {
  stats: CompanyStats | null;
  agents: Agent[];
  tasks: Task[];
  companyName: string;
  onPrimaryCtaClick: () => void;
  /** 부서 카드 클릭 시 오피스 뷰로 이동 (기획서 Phase 5) */
  onSelectDepartment?: (deptId: string) => void;
  /** 유휴 N명 클릭 시 휴게실(오피스 뷰)로 이동 (기획서 Phase 5) */
  onNavigateToBreakRoom?: () => void;
  /** 에이전트 0명 빈 상태 시 에이전트 관리 열기 (Phase 6) */
  onOpenAgentManager?: () => void;
}

type BlocksFolded = { hud?: boolean; ranking?: boolean; guildSquad?: boolean };

function readBlocksFolded(): BlocksFolded {
  try {
    const raw = typeof window !== 'undefined' ? window.localStorage.getItem(DASHBOARD_BLOCKS_FOLDED_KEY) : null;
    if (raw) {
      const parsed = JSON.parse(raw) as BlocksFolded;
      if (parsed && typeof parsed === 'object') return parsed;
    }
  } catch {
    // ignore
  }
  return {};
}

function writeBlocksFolded(next: BlocksFolded): void {
  try {
    if (typeof window !== 'undefined') window.localStorage.setItem(DASHBOARD_BLOCKS_FOLDED_KEY, JSON.stringify(next));
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
  onNavigateToBreakRoom,
  onOpenAgentManager,
}: DashboardProps) {
  const { t, locale, localeTag } = useI18n();
  const { date, time, briefing } = useNow(localeTag, t);
  const agentMap = useMemo(() => new Map(agents.map((a) => [a.id, a])), [agents]);
  const numberFormatter = useMemo(() => new Intl.NumberFormat(localeTag), [localeTag]);

  const [blocksFolded, setBlocksFolded] = useState<BlocksFolded>(readBlocksFolded);
  const hudFolded = blocksFolded.hud ?? false;
  const rankingFolded = blocksFolded.ranking ?? false;
  const guildSquadFolded = blocksFolded.guildSquad ?? false;

  const setBlockFolded = useCallback(<K extends keyof BlocksFolded>(key: K, value: boolean) => {
    setBlocksFolded((prev) => {
      const next = { ...prev, [key]: value };
      writeBlocksFolded(next);
      return next;
    });
  }, []);

  const setHudFolded = useCallback((value: boolean) => setBlockFolded('hud', value), [setBlockFolded]);
  const setRankingFolded = useCallback((value: boolean) => setBlockFolded('ranking', value), [setBlockFolded]);
  const setGuildSquadFolded = useCallback((value: boolean) => setBlockFolded('guildSquad', value), [setBlockFolded]);

  // ─── Stats ───
  const totalTasks = stats?.tasks?.total ?? tasks.length;
  const completedTasks = stats?.tasks?.done ?? tasks.filter((t) => t.status === 'done').length;
  const inProgressTasks = stats?.tasks?.in_progress ?? tasks.filter((t) => t.status === 'in_progress').length;
  const plannedTasks = stats?.tasks?.planned ?? tasks.filter((t) => t.status === 'planned').length;
  const reviewTasks = stats?.tasks?.review ?? tasks.filter((t) => t.status === 'review').length;
  const pendingTasks = tasks.filter((t) => t.status === 'pending').length;
  const activeAgents = stats?.agents?.working ?? agents.filter((a) => a.status === 'working').length;
  const idleAgents = stats?.agents?.idle ?? agents.filter((a) => a.status === 'idle').length;
  const totalAgents = stats?.agents?.total ?? agents.length;
  const completionRate = stats?.tasks?.completion_rate ?? (totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0);
  const activeRate = totalAgents > 0 ? Math.round((activeAgents / totalAgents) * 100) : 0;
  const reviewQueue = reviewTasks + pendingTasks;
  const primaryCtaLabel = t({ ko: '미션 시작', en: 'Start Mission' });
  const primaryCtaEyebrow = t({ ko: '빠른 실행', en: 'Quick Start' });
  const primaryCtaDescription =
    totalTasks === 0
      ? t({ ko: '미션을 생성하세요', en: 'Create your first mission.' })
      : t({
          ko: '핵심 업무를 바로 생성하고 실행으로 전환하세요',
          en: 'Create a priority task and move execution immediately.',
        });

  // ─── Department data ───
  const deptData = useMemo(() => {
    if (stats?.tasks_by_department && stats.tasks_by_department.length > 0) {
      return stats.tasks_by_department
        .map((d, i) => ({
          id: d.id,
          name: d.name,
          icon: d.icon ?? '',
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
            locale === 'ko'
              ? agent.department?.name_ko ?? agent.department?.name ?? agent.department_id
              : agent.department?.name ?? agent.department?.name_ko ?? agent.department_id,
          icon: agent.department?.icon ?? '',
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
      if (task.status === 'done') entry.done += 1;
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

  // ─── Top agents ───
  const topAgents = useMemo(() => {
    if (stats?.top_agents && stats.top_agents.length > 0) {
      return stats.top_agents.slice(0, 5).map((topAgent) => {
        const agent = agentMap.get(topAgent.id);
        return {
          id: topAgent.id,
          name: locale === 'ko' ? agent?.name_ko ?? agent?.name ?? topAgent.name : agent?.name ?? agent?.name_ko ?? topAgent.name,
          department:
            locale === 'ko'
              ? agent?.department?.name_ko ?? agent?.department?.name ?? ''
              : agent?.department?.name ?? agent?.department?.name_ko ?? '',
          tasksDone: topAgent.stats_tasks_done,
          xp: topAgent.stats_xp,
        };
      });
    }
    return [...agents]
      .sort((a, b) => b.stats_xp - a.stats_xp)
      .slice(0, 5)
      .map((agent) => ({
        id: agent.id,
        name: locale === 'ko' ? agent.name_ko ?? agent.name : agent.name ?? agent.name_ko,
        department:
          locale === 'ko'
            ? agent.department?.name_ko ?? agent.department?.name ?? ''
            : agent.department?.name ?? agent.department?.name_ko ?? '',
        tasksDone: agent.stats_tasks_done,
        xp: agent.stats_xp,
      }));
  }, [stats, agents, agentMap, locale]);

  const maxXp = topAgents.length > 0 ? Math.max(...topAgents.map((a) => a.xp), 1) : 1;
  const recentTasks = useMemo(
    () => [...tasks].sort((a, b) => b.updated_at - a.updated_at).slice(0, 6),
    [tasks]
  );
  const workingAgents = agents.filter((a) => a.status === 'working');
  const idleAgentsList = agents.filter((a) => a.status === 'idle');

  // Podium: [2nd, 1st, 3rd]
  const podiumOrder =
    topAgents.length >= 3
      ? [topAgents[1], topAgents[0], topAgents[2]]
      : topAgents.length === 2
      ? [topAgents[1], topAgents[0]]
      : topAgents;

  const hudStats = buildHudStats({
    totalTasks, completedTasks, completionRate,
    activeAgents, totalAgents, activeRate,
    inProgressTasks, plannedTasks,
    numberFormatter, t,
  });

  return (
    <section
      className="relative isolate space-y-4"
      style={{ color: 'var(--th-text-primary)' }}
      aria-label={t({ ko: '대시보드', en: 'Dashboard' })}
    >

      {/* Ambient background orbs */}
      <div className="pointer-events-none absolute -left-40 -top-32 h-96 w-96 rounded-full bg-violet-600/10 blur-[100px] animate-drift-slow" />
      <div className="pointer-events-none absolute -right-32 top-20 h-80 w-80 rounded-full bg-cyan-500/10 blur-[100px] animate-drift-slow-rev" />
      <div className="pointer-events-none absolute left-1/3 bottom-32 h-72 w-72 rounded-full bg-amber-500/[0.05] blur-[80px]" />

      {/* ═══ GAME HEADER ═══ */}
      <div className="game-panel relative overflow-hidden p-5">
        <div className="pointer-events-none absolute inset-0 bg-[repeating-linear-gradient(0deg,transparent,transparent_2px,rgba(0,0,0,0.03)_2px,rgba(0,0,0,0.03)_4px)]" />
        <div className="relative flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-3">
              <h1 className="dashboard-title-gradient text-2xl font-black tracking-tight sm:text-3xl">
                {companyName}
              </h1>
              <span className="flex items-center gap-1.5 rounded-full border border-emerald-400/40 bg-emerald-500/15 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-widest text-emerald-300">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
                {t({ ko: '실시간', en: 'LIVE' })}
              </span>
            </div>
            <p className="text-xs" style={{ color: 'var(--th-text-muted)' }}>
              {t({
                ko: '에이전트들이 실시간으로 미션을 수행 중입니다',
                en: 'Agents are executing missions in real time',
})}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <div className="flex items-center gap-2 rounded-xl border border-cyan-400/20 bg-cyan-500/[0.06] px-4 py-2">
              <Clock width={14} height={14} className="text-cyan-400/60" aria-hidden />
              <span className="dashboard-time-display font-mono text-xl font-bold tracking-tight">{time}</span>
            </div>
            {/* 날짜·브리핑 한 줄 압축 (기획서 §3.2 게임 헤더) */}
            <div className="flex flex-wrap items-center gap-1.5 rounded-lg border border-white/[0.06] bg-white/[0.03] px-2.5 py-1.5 text-[10px]">
              <span className="text-slate-400">{date}</span>
              <span className="text-slate-600" aria-hidden>·</span>
              <span className="text-cyan-300">{briefing}</span>
            </div>
            {reviewQueue > 0 && (
              <span
                className="flex items-center gap-1.5 rounded-lg border border-orange-400/30 bg-orange-500/15 px-3 py-1.5 text-xs font-bold text-orange-300 animate-neon-pulse-orange"
                role="status"
                aria-label={t({ ko: `리뷰 대기 ${reviewQueue}건`, en: `${reviewQueue} in review queue` })}
              >
                <Bell width={14} height={14} className="inline -mt-0.5" aria-hidden />
                {t({ ko: '대기', en: 'Queued' })} {numberFormatter.format(reviewQueue)}
                {t({ ko: '건', en: '' })}
              </span>
            )}
          </div>
        </div>
        <div className="relative mt-4 rounded-xl border border-cyan-400/40 bg-gradient-to-r from-cyan-500/20 via-blue-500/15 to-emerald-500/20 p-4 shadow-[0_0_20px_rgba(34,211,238,0.12)]">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-cyan-200/85">{primaryCtaEyebrow}</p>
              <p className="mt-1 text-xs sm:text-sm" style={{ color: 'var(--th-text-primary)' }}>{primaryCtaDescription}</p>
            </div>
            <button
              type="button"
              onClick={onPrimaryCtaClick}
              className="animate-cta-glow group inline-flex w-full items-center justify-center gap-2 rounded-xl border-0 bg-gradient-to-r from-cyan-500 to-blue-500 px-6 py-3 text-sm font-black tracking-tight text-white shadow-[0_4px_20px_rgba(34,211,238,0.35)] transition-all duration-200 hover:-translate-y-0.5 hover:from-cyan-400 hover:to-blue-400 hover:shadow-[0_8px_30px_rgba(34,211,238,0.5)] active:translate-y-0 sm:w-auto sm:min-w-[200px]"
            >
              <Rocket width={16} height={16} aria-hidden="true" />
              <span>{primaryCtaLabel}</span>
              <span className="text-xs text-white/80 transition-transform duration-200 group-hover:translate-x-0.5" aria-hidden="true">→</span>
            </button>
          </div>
        </div>
      </div>

      {/* ═══ HUD STATS (Phase 2: 접기/펼치기 + localStorage) ═══ */}
      <DashboardHudStats
        hudStats={hudStats}
        numberFormatter={numberFormatter}
        folded={hudFolded}
        onToggleFold={() => setHudFolded(!hudFolded)}
        t={t}
      />

      {/* ═══ 즉시 액션 (기획서 §3.1·§3.2) ═══ */}
      {(reviewQueue > 0 || inProgressTasks > 0) && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-600/50 bg-slate-800/40 px-4 py-3">
          {reviewQueue > 0 && (
            <button
              type="button"
              onClick={onPrimaryCtaClick}
              className="inline-flex items-center gap-1.5 rounded-lg border border-orange-400/40 bg-orange-500/20 px-3 py-1.5 text-xs font-semibold text-orange-200 transition hover:bg-orange-500/30 hover:border-orange-400/60"
              aria-label={t({ ko: `리뷰 대기 ${reviewQueue}건 보기`, en: `View ${reviewQueue} in review` })}
            >
              {t({ ko: '리뷰 대기', en: 'Review' })} {numberFormatter.format(reviewQueue)}
              {t({ ko: '건', en: '' })} <span aria-hidden>→</span> {t({ ko: '보기', en: 'View' })}
            </button>
          )}
          {inProgressTasks > 0 && (
            <button
              type="button"
              onClick={onPrimaryCtaClick}
              className="inline-flex items-center gap-1.5 rounded-lg border border-cyan-400/40 bg-cyan-500/20 px-3 py-1.5 text-xs font-semibold text-cyan-200 transition hover:bg-cyan-500/30 hover:border-cyan-400/60"
              aria-label={t({ ko: `진행중 미션 ${inProgressTasks}건 보기`, en: `View ${inProgressTasks} in progress` })}
            >
              {t({ ko: '진행중 미션', en: 'In progress' })} {numberFormatter.format(inProgressTasks)}
              {t({ ko: '건', en: '' })} <span aria-hidden>→</span> {t({ ko: '보기', en: 'View' })}
            </button>
          )}
        </div>
      )}

      {/* ═══ RANKING BOARD (Phase 3: 접기/펼치기) ═══ */}
      <DashboardRankingBoard
        topAgents={topAgents}
        podiumOrder={podiumOrder}
        maxXp={maxXp}
        agents={agents}
        agentMap={agentMap}
        numberFormatter={numberFormatter}
        t={t}
        locale={locale}
        folded={rankingFolded}
        onToggleFold={() => setRankingFolded(!rankingFolded)}
        onOpenAgentManager={onOpenAgentManager}
      />

      {/* ═══ GUILDS + SQUAD (Phase 3 접기/펼치기, Phase 5 부서·휴게실 연동) ═══ */}
      <DashboardGuildSquad
        deptData={deptData}
        agents={agents}
        workingAgents={workingAgents}
        idleAgentsList={idleAgentsList}
        numberFormatter={numberFormatter}
        t={t}
        locale={locale}
        folded={guildSquadFolded}
        onToggleFold={() => setGuildSquadFolded(!guildSquadFolded)}
        onSelectDepartment={onSelectDepartment}
        onNavigateToBreakRoom={onNavigateToBreakRoom}
      />

      {/* ═══ MISSION LOG (Phase 4: 행 클릭·더 보기 → 업무 보드) ═══ */}
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
      />
    </section>
  );
}
