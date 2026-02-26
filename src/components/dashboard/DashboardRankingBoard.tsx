import { Trophy, Swords, ChevronDown, ChevronUp, UserPlus } from 'lucide-react';
import type { Agent } from '../../types';
import AgentAvatar from '../AgentAvatar';
import { getRankTier } from './dashboardHelpers';
import type { TFunction } from './dashboardHelpers';
import { XpBar, RankBadge } from './DashboardRankingWidgets';

type TopAgent = { id: string; name: string; department: string; tasksDone: number; xp: number };

interface DashboardRankingBoardProps {
  topAgents: TopAgent[];
  podiumOrder: TopAgent[];
  maxXp: number;
  agents: Agent[];
  agentMap: Map<string, Agent>;
  numberFormatter: Intl.NumberFormat;
  t: TFunction;
  locale: string;
  folded?: boolean;
  onToggleFold?: () => void;
  /** 에이전트 0명일 때 에이전트 관리 열기 (Phase 6) */
  onOpenAgentManager?: () => void;
}

export default function DashboardRankingBoard({
  topAgents,
  podiumOrder,
  maxXp,
  agents,
  agentMap,
  numberFormatter,
  t,
  folded = false,
  onToggleFold,
  onOpenAgentManager,
}: DashboardRankingBoardProps) {
  const toggleLabel = folded
    ? t({ ko: '랭킹 보드 펼치기', en: 'Expand ranking' })
    : t({ ko: '랭킹 보드 접기', en: 'Collapse ranking' });

  const headerBlock = (
    <div className="relative flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-3">
        <Trophy
          width={24}
          height={24}
          className="animate-crown-wiggle text-amber-400"
          style={{ display: 'inline-block', filter: 'drop-shadow(0 0 8px rgba(255,215,0,0.5))' }}
        />
        <div>
          <h2 className="dashboard-ranking-gradient text-lg font-black uppercase tracking-wider">
            {t({ ko: '랭킹 보드', en: 'RANKING BOARD' })}
          </h2>
          <p className="text-[10px]" style={{ color: 'var(--th-text-muted)' }}>
            {t({ ko: 'XP 기준 에이전트 순위', en: 'Agent ranking by XP' })}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <span className="rounded-md border border-white/[0.06] bg-white/[0.03] px-2.5 py-1 text-[10px] font-bold text-slate-400">
          TOP {topAgents.length}
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
              <ChevronDown width={18} height={18} style={{ color: 'var(--th-text-muted)' }} aria-hidden />
            ) : (
              <ChevronUp width={18} height={18} style={{ color: 'var(--th-text-muted)' }} aria-hidden />
            )}
          </button>
        )}
      </div>
    </div>
  );

  if (folded) {
    return (
      <div className="game-panel relative overflow-hidden p-5">
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-amber-500/[0.03] via-transparent to-transparent" />
        {headerBlock}
      </div>
    );
  }

  return (
    <div className="game-panel relative overflow-hidden p-5">
      {/* Background gradient */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-amber-500/[0.03] via-transparent to-transparent" />

      {/* Title */}
      <div className="relative mb-6">
        {headerBlock}
      </div>

      {topAgents.length === 0 ? (
        <div className="flex min-h-[200px] flex-col items-center justify-center gap-4 text-sm" style={{ color: 'var(--th-text-muted)' }}>
          <Swords width={36} height={36} className="opacity-30 text-slate-400" aria-hidden />
          <p>{t({ ko: '등록된 에이전트가 없습니다', en: 'No agents registered' })}</p>
          <p className="text-[10px]">
            {t({
              ko: '에이전트를 추가하고 미션을 시작하세요',
              en: 'Add agents and start missions',
            })}
          </p>
          {onOpenAgentManager && (
            <button
              type="button"
              onClick={onOpenAgentManager}
              className="inline-flex items-center gap-2 rounded-lg border border-cyan-400/40 bg-cyan-500/20 px-4 py-2 text-xs font-semibold text-cyan-200 transition hover:bg-cyan-500/30 hover:border-cyan-400/60"
              aria-label={t({ ko: '에이전트 관리 열기', en: 'Open agent manager' })}
            >
              <UserPlus width={14} height={14} aria-hidden />
              {t({ ko: '에이전트 추가', en: 'Add agents' })}
            </button>
          )}
        </div>
      ) : (
        <div className="relative space-y-5">

          {/* ── Podium: Top 3 ── */}
          {topAgents.length >= 2 && (
            <div className="flex items-end justify-center gap-4 pb-3 pt-2 sm:gap-6">
              {podiumOrder.map((agent, visualIdx) => {
                const ranks = topAgents.length >= 3 ? [2, 1, 3] : [2, 1];
                const rank = ranks[visualIdx];
                const tier = getRankTier(agent.xp);
                const isFirst = rank === 1;
                const avatarSize = isFirst ? 64 : 48;
                const podiumH = isFirst ? 'h-24' : rank === 2 ? 'h-16' : 'h-12';

                return (
                  <div
                    key={agent.id}
                    className={`flex flex-col items-center gap-2 ${isFirst ? 'animate-rank-float' : ''}`}
                  >
                    {/* Medal */}
                    {rank === 1 && (
                      <span
                        className="animate-crown-wiggle"
                        style={{ display: 'inline-block', filter: 'drop-shadow(0 0 12px rgba(255,215,0,0.6))' }}
                      >
                        <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-yellow-400 text-yellow-900 text-sm font-bold">1</span>
                      </span>
                    )}
                    {rank === 2 && (
                      <span style={{ filter: 'drop-shadow(0 0 6px rgba(192,192,192,0.5))' }}>
                        <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-slate-300 text-slate-700 text-xs font-bold">2</span>
                      </span>
                    )}
                    {rank === 3 && (
                      <span style={{ filter: 'drop-shadow(0 0 6px rgba(205,127,50,0.5))' }}>
                        <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-amber-600 text-white text-xs font-bold">3</span>
                      </span>
                    )}

                    {/* Avatar with neon glow */}
                    <div
                      className="relative rounded-2xl overflow-hidden transition-transform duration-300 hover:scale-105"
                      style={{
                        boxShadow: isFirst
                          ? `0 0 20px ${tier.glow}, 0 0 40px ${tier.glow}`
                          : `0 0 12px ${tier.glow}`,
                        border: `2px solid ${tier.color}80`,
                      }}
                    >
                      <AgentAvatar agent={agentMap.get(agent.id)} agents={agents} size={avatarSize} rounded="2xl" />
                    </div>

                    {/* Name */}
                    <span
                      className={`max-w-[80px] truncate text-center font-bold ${isFirst ? 'text-sm' : 'text-xs'}`}
                      style={{
                        color: tier.color,
                        textShadow: isFirst ? `0 0 8px ${tier.glow}` : 'none',
                      }}
                    >
                      {agent.name}
                    </span>

                    {/* XP + Rank */}
                    <div className="flex flex-col items-center gap-1">
                      <span
                        className="font-mono text-xs font-bold"
                        style={{ color: tier.color, textShadow: `0 0 6px ${tier.glow}` }}
                      >
                        {numberFormatter.format(agent.xp)} XP
                      </span>
                      <RankBadge xp={agent.xp} size="sm" />
                    </div>

                    {/* Podium block */}
                    <div
                      className={`${podiumH} w-20 sm:w-24 rounded-t-xl flex items-center justify-center animate-podium-rise`}
                      style={{
                        background: `linear-gradient(to bottom, ${tier.color}30, ${tier.color}10)`,
                        border: `1px solid ${tier.color}40`,
                        borderBottom: 'none',
                        boxShadow: `inset 0 1px 0 ${tier.color}30, 0 -4px 12px ${tier.glow}`,
                      }}
                    >
                      <span className="text-2xl font-black" style={{ color: `${tier.color}50` }}>
                        #{rank}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* ── Ranked List: #4+ ── */}
          {topAgents.length > 3 && (
            <div className="space-y-2 border-t border-white/[0.06] pt-4">
              {topAgents.slice(3).map((agent, idx) => {
                const rank = idx + 4;
                const tier = getRankTier(agent.xp);
                return (
                  <div
                    key={agent.id}
                    className="group flex items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 transition-all duration-200 hover:bg-white/[0.05] hover:translate-x-1"
                    style={{ borderLeftWidth: '3px', borderLeftColor: `${tier.color}60` }}
                  >
                    <span className="w-8 text-center font-mono text-sm font-black" style={{ color: `${tier.color}80` }}>
                      #{rank}
                    </span>
                    <div className="rounded-xl overflow-hidden flex-shrink-0" style={{ border: `1px solid ${tier.color}40` }}>
                      <AgentAvatar agent={agentMap.get(agent.id)} agents={agents} size={36} rounded="xl" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold" style={{ color: 'var(--th-text-primary)' }}>{agent.name}</p>
                      <p className="text-[10px]" style={{ color: 'var(--th-text-muted)' }}>
                        {agent.department ||
                          t({ ko: '미지정', en: 'Unassigned' })}
                      </p>
                    </div>
                    <div className="hidden w-28 sm:block">
                      <XpBar xp={agent.xp} maxXp={maxXp} color={tier.color} />
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold" style={{ color: tier.color }}>
                        {numberFormatter.format(agent.xp)}
                      </span>
                      <RankBadge xp={agent.xp} size="sm" />
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Single agent */}
          {topAgents.length === 1 && (() => {
            const agent = topAgents[0];
            const tier = getRankTier(agent.xp);
            return (
              <div
                className="flex items-center gap-4 rounded-xl p-4"
                style={{
                  background: `linear-gradient(135deg, ${tier.color}15, transparent)`,
                  border: `1px solid ${tier.color}30`,
                  boxShadow: `0 0 20px ${tier.glow}`,
                }}
              >
                <span className="animate-crown-wiggle" style={{ display: 'inline-block' }}>
                  <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-yellow-400 text-yellow-900 text-sm font-bold">1</span>
                </span>
                <div
                  className="rounded-2xl overflow-hidden"
                  style={{ border: `2px solid ${tier.color}60`, boxShadow: `0 0 15px ${tier.glow}` }}
                >
                  <AgentAvatar agent={agentMap.get(agent.id)} agents={agents} size={52} rounded="2xl" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-base font-black" style={{ color: tier.color }}>{agent.name}</p>
                  <p className="text-xs" style={{ color: 'var(--th-text-muted)' }}>
                    {agent.department ||
                      t({ ko: '미지정', en: 'Unassigned' })}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-mono text-lg font-black" style={{ color: tier.color, textShadow: `0 0 10px ${tier.glow}` }}>
                    {numberFormatter.format(agent.xp)} XP
                  </p>
                  <RankBadge xp={agent.xp} size="md" />
                </div>
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
}
