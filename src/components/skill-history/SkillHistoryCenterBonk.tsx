import type { Agent } from '../../types';
import AgentAvatar from '../AgentAvatar';
import { Icon } from '../ui/Icon';
import { Hammer } from 'lucide-react';
import type { SkillHistoryProvider } from '../../api';
import { providerLabel } from './skillHistoryHelpers';

interface SkillHistoryCenterBonkProps {
  provider: SkillHistoryProvider;
  agent: Agent | null;
  agents: Agent[];
}

export default function SkillHistoryCenterBonk({ provider, agent, agents }: SkillHistoryCenterBonkProps) {
  return (
    <div className="pointer-events-none fixed inset-0 z-[120] flex items-center justify-center">
      <div className="skill-history-center-card unlearn-center-card rounded-2xl border border-rose-400/30 bg-slate-900/90 px-6 py-4 shadow-2xl shadow-black/50 backdrop-blur-sm">
        <div className="relative mx-auto h-20 w-20 overflow-visible">
          <div className="unlearn-avatar-hit">
            <AgentAvatar agent={agent ?? undefined} agents={agents} size={80} rounded="xl" />
          </div>
          <span className="unlearn-hammer-swing-center"><Icon icon={Hammer} size="lg" className="text-slate-300" /></span>
          <span className="unlearn-hit-text-center">Bonk!</span>
        </div>
        <div className="skill-history-center-label mt-2 text-center text-xs font-medium text-rose-100">
          {providerLabel(provider)}
        </div>
      </div>
    </div>
  );
}
