import { Radio, FileText } from 'lucide-react';
import type { Agent, Task } from '../../types';
import AgentAvatar from '../AgentAvatar';
import { STATUS_LABELS, taskStatusLabel, timeAgo } from './dashboardHelpers';
import type { TFunction, Locale } from './dashboardHelpers';

const STATUS_LEFT_BORDER: Record<string, string> = {
  inbox:       'border-l-slate-400',
  planned:     'border-l-blue-400',
  in_progress: 'border-l-amber-400',
  review:      'border-l-violet-400',
  done:        'border-l-emerald-400',
  pending:     'border-l-orange-400',
  cancelled:   'border-l-rose-400',
};

interface DashboardMissionLogProps {
  recentTasks: Task[];
  agents: Agent[];
  agentMap: Map<string, Agent>;
  idleAgents: number;
  numberFormatter: Intl.NumberFormat;
  localeTag: string;
  locale: Locale;
  t: TFunction;
  /** 클릭 시 업무 보드로 이동 (기획서 §3.2 Phase 4) */
  onNavigateToTasks?: () => void;
}

export default function DashboardMissionLog({
  recentTasks,
  agents,
  agentMap,
  idleAgents,
  numberFormatter,
  localeTag,
  locale,
  t,
  onNavigateToTasks,
}: DashboardMissionLogProps) {
  return (
    <div className="game-panel p-5">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-sm font-black uppercase tracking-wider" style={{ color: 'var(--th-text-primary)' }}>
          <span
            className="flex h-7 w-7 items-center justify-center rounded-lg bg-violet-500/15"
            style={{ boxShadow: '0 0 8px rgba(139,92,246,0.2)' }}
          >
            <Radio width={14} height={14} className="text-violet-400" />
          </span>
          {t({ ko: '미션 로그', en: 'MISSION LOG' })}
          <span className="ml-2 text-[9px] font-medium normal-case tracking-normal" style={{ color: 'var(--th-text-muted)' }}>
            {t({ ko: '최근 활동', en: 'Recent activity' })}
          </span>
        </h2>
        <span className="flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-[10px] font-bold" style={{ borderColor: 'var(--th-border)', background: 'var(--th-bg-surface)', color: 'var(--th-text-secondary)' }}>
          {t({ ko: '유휴', en: 'Idle' })} {numberFormatter.format(idleAgents)}
          {t({ ko: '명', en: '' })}
        </span>
      </div>

      {recentTasks.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 py-10 text-sm" style={{ color: 'var(--th-text-muted)' }} role="status" aria-label={t({ ko: '최근 미션 로그 없음', en: 'No recent mission logs' })}>
          <Radio width={32} height={32} className="opacity-30 text-slate-400" aria-hidden />
          {t({ ko: '로그 없음', en: 'No logs' })}
        </div>
      ) : (
        <div className="space-y-2">
          {recentTasks.map((task) => {
            const statusInfo = STATUS_LABELS[task.status] ?? {
              color: 'bg-slate-600/20 text-slate-200 border-slate-500/30',
              dot: 'bg-slate-400',
            };
            const assignedAgent =
              task.assigned_agent ??
              (task.assigned_agent_id ? agentMap.get(task.assigned_agent_id) : undefined);
            const leftBorder = STATUS_LEFT_BORDER[task.status] ?? 'border-l-slate-500';

            return (
              <article
                key={task.id}
                role={onNavigateToTasks ? 'button' : undefined}
                tabIndex={onNavigateToTasks ? 0 : undefined}
                onClick={onNavigateToTasks ? () => onNavigateToTasks() : undefined}
                onKeyDown={
                  onNavigateToTasks
                    ? (e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          onNavigateToTasks();
                        }
                      }
                    : undefined
                }
                className={`group grid grid-cols-[auto_1fr_auto] items-center gap-3 rounded-xl border border-white/[0.06] border-l-[3px] ${leftBorder} bg-white/[0.02] p-3 transition-all duration-200 ${onNavigateToTasks ? 'cursor-pointer hover:bg-white/[0.06] hover:translate-x-1 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:ring-offset-2 focus:ring-offset-slate-900' : 'hover:bg-white/[0.04] hover:translate-x-1'}`}
                aria-label={onNavigateToTasks ? t({ ko: `업무 보드에서 보기: ${task.title}`, en: `View on task board: ${task.title}` }) : undefined}
              >
                {assignedAgent ? (
                  <AgentAvatar agent={assignedAgent} agents={agents} size={36} rounded="xl" />
                ) : (
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl border" style={{ borderColor: 'var(--th-border)', background: 'var(--th-bg-surface)', color: 'var(--th-text-muted)' }}>
                    <FileText width={16} height={16} />
                  </div>
                )}

                <div className="min-w-0">
                  <p className="truncate text-sm font-bold transition-colors group-hover:text-white" style={{ color: 'var(--th-text-primary)' }}>
                    {task.title}
                  </p>
                  <p className="mt-0.5 flex items-center gap-1.5 text-[10px]" style={{ color: 'var(--th-text-muted)' }}>
                    <span className={`h-1.5 w-1.5 flex-shrink-0 rounded-full ${statusInfo.dot}`} />
                    {assignedAgent
                      ? (locale === 'ko' ? assignedAgent.name_ko : assignedAgent.name)
                      : t({ ko: '미배정', en: 'Unassigned' })}
                  </p>
                </div>

                <div className="flex flex-col items-end gap-1">
                  <span className={`rounded-md border px-2 py-0.5 text-[9px] font-black uppercase tracking-wider ${statusInfo.color}`}>
                    {taskStatusLabel(task.status, t)}
                  </span>
                  <span className="text-[9px] font-medium" style={{ color: 'var(--th-text-muted)' }}>{timeAgo(task.updated_at, localeTag)}</span>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* 더 보기: 업무 보드 전체 보기 (기획서 §3.2 Phase 4) */}
      {onNavigateToTasks && (
        <div className="mt-4 flex justify-end border-t border-white/[0.06] pt-3">
          <button
            type="button"
            onClick={onNavigateToTasks}
            className="inline-flex items-center gap-1.5 rounded-lg border border-cyan-400/40 bg-cyan-500/10 px-3 py-1.5 text-xs font-semibold text-cyan-200 transition hover:bg-cyan-500/20 hover:border-cyan-400/60"
            aria-label={t({ ko: '업무 보드 전체 보기', en: 'View full task board' })}
          >
            {t({ ko: '더 보기', en: 'View all' })}
            <span aria-hidden>→</span>
          </button>
        </div>
      )}
    </div>
  );
}
