import { Castle, Bot, ChevronDown, ChevronUp } from 'lucide-react';
import type { Agent } from '../../types';
import AgentAvatar from '../AgentAvatar';
import { getRankTier } from './dashboardHelpers';
import type { TFunction, Locale } from './dashboardHelpers';

type DeptData = {
  id: string;
  name: string;
  icon: string;
  done: number;
  total: number;
  ratio: number;
  color: { bar: string; badge: string };
};

interface DashboardGuildSquadProps {
  deptData: DeptData[];
  agents: Agent[];
  workingAgents: Agent[];
  idleAgentsList: Agent[];
  numberFormatter: Intl.NumberFormat;
  t: TFunction;
  locale: Locale;
  folded?: boolean;
  onToggleFold?: () => void;
  /** 부서 카드 클릭 시 오피스 뷰로 이동 (Phase 5) */
  onSelectDepartment?: (deptId: string) => void;
  /** 유휴 N명 클릭 시 휴게실(오피스 뷰)로 이동 (Phase 5) */
  onNavigateToBreakRoom?: () => void;
}

export default function DashboardGuildSquad({
  deptData,
  agents,
  workingAgents,
  idleAgentsList,
  numberFormatter,
  t,
  locale,
  folded = false,
  onToggleFold,
  onSelectDepartment,
  onNavigateToBreakRoom,
}: DashboardGuildSquadProps) {
  const toggleLabel = folded
    ? t({ ko: '부서·스쿼드 펼치기', en: 'Expand dept & squad' })
    : t({ ko: '부서·스쿼드 접기', en: 'Collapse dept & squad' });

  if (folded) {
    return (
      <div className="game-panel flex flex-wrap items-center justify-between gap-3 p-5">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <Castle width={16} height={16} className="text-blue-400" aria-hidden />
            <span className="text-sm font-black uppercase tracking-wider" style={{ color: 'var(--th-text-primary)' }}>
              {t({ ko: '부서 성과', en: 'DEPT.' })} / {t({ ko: '스쿼드', en: 'SQUAD' })}
            </span>
          </div>
          <span className="flex flex-wrap items-center gap-x-1.5 gap-y-0 text-[10px]" style={{ color: 'var(--th-text-muted)' }}>
            {t({ ko: '부서', en: 'Depts' })} {numberFormatter.format(deptData.length)}
            <span className="mx-0.5" aria-hidden>·</span>
            {t({ ko: 'ON', en: 'ON' })} {numberFormatter.format(workingAgents.length)}
            <span className="mx-0.5" aria-hidden>·</span>
            {onNavigateToBreakRoom ? (
              <button
                type="button"
                onClick={onNavigateToBreakRoom}
                className="rounded px-1 py-0.5 font-semibold transition hover:bg-white/10 hover:text-cyan-200"
                aria-label={t({ ko: '휴게실(유휴 에이전트) 보기', en: 'View break room (idle agents)' })}
              >
                {t({ ko: 'OFF', en: 'OFF' })} {numberFormatter.format(idleAgentsList.length)}
              </button>
            ) : (
              <span>{t({ ko: 'OFF', en: 'OFF' })} {numberFormatter.format(idleAgentsList.length)}</span>
            )}
          </span>
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
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.2fr_1fr]">

      {/* Guild Rankings */}
      <div className="game-panel p-5">
        <h2 className="mb-4 flex items-center gap-2 text-sm font-black uppercase tracking-wider" style={{ color: 'var(--th-text-primary)' }}>
          <span
            className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-500/15"
            style={{ boxShadow: '0 0 8px rgba(59,130,246,0.3)' }}
          >
            <Castle width={14} height={14} className="text-blue-400" />
          </span>
          {t({ ko: '부서 성과', en: 'DEPT. PERFORMANCE' })}
          <span className="ml-auto text-[9px] font-medium normal-case tracking-normal" style={{ color: 'var(--th-text-muted)' }}>
            {t({ ko: '부서별 성과', en: 'by department' })}
          </span>
          {onToggleFold && (
            <button
              type="button"
              onClick={onToggleFold}
              className="rounded-lg p-1.5 transition hover:bg-white/10"
              aria-label={toggleLabel}
              title={toggleLabel}
            >
              <ChevronUp width={16} height={16} style={{ color: 'var(--th-text-muted)' }} aria-hidden />
            </button>
          )}
        </h2>

        {deptData.length === 0 ? (
          <div className="flex min-h-[200px] flex-col items-center justify-center gap-2 text-sm" style={{ color: 'var(--th-text-muted)' }}>
            <Castle width={32} height={32} className="opacity-30 text-slate-400" />
            {t({ ko: '데이터가 없습니다', en: 'No data available' })}
          </div>
        ) : (
          <div className="space-y-2.5">
            {deptData.map((dept) => (
              <article
                key={dept.id}
                role={onSelectDepartment ? 'button' : undefined}
                tabIndex={onSelectDepartment ? 0 : undefined}
                onClick={onSelectDepartment ? () => onSelectDepartment(dept.id) : undefined}
                onKeyDown={
                  onSelectDepartment
                    ? (e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          onSelectDepartment(dept.id);
                        }
                      }
                    : undefined
                }
                className={`group relative overflow-hidden rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 transition-all duration-200 ${onSelectDepartment ? 'cursor-pointer hover:bg-white/[0.06] hover:translate-x-1 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:ring-offset-2 focus:ring-offset-slate-900' : 'hover:bg-white/[0.04] hover:translate-x-1'}`}
                aria-label={onSelectDepartment ? t({ ko: `오피스 뷰에서 ${dept.name} 보기`, en: `View ${dept.name} in office` }) : undefined}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg transition-transform duration-200 group-hover:scale-110" style={{ background: 'var(--th-bg-surface)' }}>
                      <span className="h-2.5 w-2.5 rounded-full" style={{ background: `var(--th-text-secondary)` }} />
                    </span>
                    <span className="text-sm font-bold" style={{ color: 'var(--th-text-primary)' }}>{dept.name}</span>
                  </div>
                  <span className={`rounded-md border px-2 py-0.5 text-[10px] font-black ${dept.color.badge}`}>
                    {dept.ratio}%
                  </span>
                </div>

                <div className="mt-2.5 relative h-2 overflow-hidden rounded-full border border-white/[0.06] bg-white/[0.04]">
                  <div
                    className={`xp-bar-fill h-full rounded-full bg-gradient-to-r ${dept.color.bar} transition-all duration-700`}
                    style={{ width: `${dept.ratio}%` }}
                  />
                </div>

                <div className="mt-1.5 flex justify-between text-[9px] font-semibold uppercase tracking-wider" style={{ color: 'var(--th-text-muted)' }}>
                  <span>
                    {t({ ko: '클리어', en: 'cleared' })} {numberFormatter.format(dept.done)}
                  </span>
                  <span>
                    {t({ ko: '전체', en: 'total' })} {numberFormatter.format(dept.total)}
                  </span>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>

      {/* Squad Roster */}
      <div className="game-panel p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-sm font-black uppercase tracking-wider" style={{ color: 'var(--th-text-primary)' }}>
            <span
              className="flex h-7 w-7 items-center justify-center rounded-lg bg-cyan-500/15"
              style={{ boxShadow: '0 0 8px rgba(0,240,255,0.2)' }}
            >
              <Bot width={14} height={14} className="text-cyan-400" />
            </span>
            {t({ ko: '스쿼드', en: 'SQUAD' })}
          </h2>
          <div className="flex items-center gap-2 text-[10px]">
            <span className="flex items-center gap-1 rounded-md border border-emerald-400/30 bg-emerald-500/10 px-2 py-0.5 font-bold text-emerald-300">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
              {t({ ko: 'ON', en: 'ON' })} {numberFormatter.format(workingAgents.length)}
            </span>
            {onNavigateToBreakRoom ? (
              <button
                type="button"
                onClick={onNavigateToBreakRoom}
                className="flex items-center gap-1 rounded-md border px-2 py-0.5 font-bold transition hover:bg-white/10 hover:border-cyan-400/40"
                style={{ borderColor: 'var(--th-border)', background: 'var(--th-bg-surface)', color: 'var(--th-text-secondary)' }}
                aria-label={t({ ko: '휴게실(유휴 에이전트) 보기', en: 'View break room (idle agents)' })}
              >
                {t({ ko: 'OFF', en: 'OFF' })} {numberFormatter.format(idleAgentsList.length)}
              </button>
            ) : (
              <span className="flex items-center gap-1 rounded-md border px-2 py-0.5 font-bold" style={{ borderColor: 'var(--th-border)', background: 'var(--th-bg-surface)', color: 'var(--th-text-secondary)' }}>
                {t({ ko: 'OFF', en: 'OFF' })} {numberFormatter.format(idleAgentsList.length)}
              </span>
            )}
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          {agents.map((agent) => {
            const isWorking = agent.status === 'working';
            const tier = getRankTier(agent.stats_xp);
            // Deterministic delay from agent id
            const delay = (agent.id.charCodeAt(0) * 137) % 1500;
            return (
              <div
                key={agent.id}
                title={`${locale === 'ko' ? agent.name_ko ?? agent.name : agent.name ?? agent.name_ko} — ${
                  isWorking
                    ? t({ ko: '작업 중', en: 'Working' })
                    : t({ ko: '대기 중', en: 'Idle' })
                } — ${tier.name}`}
                className={`group relative flex flex-col items-center gap-1.5 ${isWorking ? 'animate-bubble-float' : ''}`}
                style={isWorking ? { animationDelay: `${delay}ms` } : {}}
              >
                <div className="relative">
                  <div
                    className="rounded-2xl overflow-hidden transition-transform duration-200 group-hover:scale-110"
                    style={{
                      boxShadow: isWorking ? `0 0 12px ${tier.glow}` : 'none',
                      border: isWorking ? `2px solid ${tier.color}60` : '1px solid rgba(255,255,255,0.08)',
                    }}
                  >
                    <AgentAvatar agent={agent} agents={agents} size={40} rounded="2xl" />
                  </div>
                  <span
                    className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 ${
                      isWorking ? 'bg-emerald-400 animate-status-glow' : 'bg-slate-600'
                    }`}
                    style={{ borderColor: 'var(--th-bg-primary)' }}
                  />
                </div>
                <span
                  className="max-w-[52px] truncate text-center text-[9px] font-bold leading-tight"
                  style={{ color: isWorking ? 'var(--th-text-primary)' : 'var(--th-text-muted)' }}
                >
                  {locale === 'ko' ? agent.name_ko ?? agent.name : agent.name ?? agent.name_ko}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
