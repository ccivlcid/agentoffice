import type { Agent } from '../../types';
import AgentAvatar from '../AgentAvatar';
import { Icon } from '../ui/Icon';
import { Hammer, Leaf } from 'lucide-react';
import type { SkillLearningHistoryEntry } from '../../api';
import { providerLabel, relativeTime, statusClass, statusLabel, type UnlearnEffect } from './skillHistoryHelpers';

interface SkillHistoryRowProps {
  agent: Agent | null;
  agents: Agent[];
  label: string;
  repo: string;
  providerName: string;
  isUnlearning: boolean;
  unlearnEffect: UnlearnEffect | undefined;
  canUnlearn: boolean;
  timestamp?: number | null;
  status?: SkillLearningHistoryEntry['status'];
  error?: string | null;
  onUnlearn: () => void;
}

export default function SkillHistoryRow({
  agent, agents, label, repo, providerName, isUnlearning,
  unlearnEffect, canUnlearn, timestamp, status, error, onUnlearn,
}: SkillHistoryRowProps) {
  return (
    <div className="skill-history-card rounded-lg border border-slate-700/70 bg-slate-800/50 p-2.5">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate text-xs font-semibold text-slate-100">{label}</div>
          <div className="mt-0.5 truncate text-[10px] text-slate-500">{repo}</div>
        </div>
        {status && (
          <span className={`rounded-full border px-1.5 py-0.5 text-[10px] ${statusClass(status)}`}>
            {statusLabel(status)}
          </span>
        )}
      </div>
      <div className="skill-history-meta mt-2 flex items-center justify-between gap-2 text-[10px] text-slate-400">
        <div className="flex min-w-0 items-center gap-2">
          <div className={`relative h-5 w-5 overflow-hidden rounded-md bg-slate-800/80 ${unlearnEffect ? 'unlearn-avatar-hit' : ''}`}>
            <AgentAvatar agent={agent ?? undefined} agents={agents} size={20} rounded="xl" />
            {unlearnEffect === 'pot' && <span className="unlearn-pot-drop-sm"><Icon icon={Leaf} size="xs" className="text-emerald-400" /></span>}
            {unlearnEffect === 'hammer' && <span className="unlearn-hammer-swing-sm"><Icon icon={Hammer} size="xs" className="text-slate-300" /></span>}
            {unlearnEffect && <span className="unlearn-hit-text-sm">Bonk!</span>}
          </div>
          <span className="truncate">{providerName}{agent ? ` · ${agent.name}` : ''}</span>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {canUnlearn && (
            <button
              type="button"
              onClick={onUnlearn}
              disabled={isUnlearning}
              className={`skill-unlearn-btn rounded-md border px-1.5 py-0.5 text-[10px] transition-all ${
                isUnlearning
                  ? 'cursor-not-allowed border-slate-700 text-slate-600'
                  : 'border-rose-500/35 bg-rose-500/10 text-rose-300 hover:bg-rose-500/20'
              }`}
            >
              {isUnlearning ? 'Unlearning...' : 'Unlearn'}
            </button>
          )}
          <span className="skill-history-time text-slate-500">{relativeTime(timestamp)}</span>
        </div>
      </div>
      {error && <div className="mt-1 break-words text-[10px] text-rose-300">{error}</div>}
    </div>
  );
}

// Re-export for convenience
export { providerLabel };
