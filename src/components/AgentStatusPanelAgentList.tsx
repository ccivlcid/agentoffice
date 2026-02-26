import type { Agent } from '../types';
import type { ActiveAgentInfo } from '../api';
import type { UiLanguage } from '../i18n';
import { pickLang } from '../i18n';
import { fmtElapsed, fmtTime } from './AgentStatusPanelHelpers';
import AgentAvatar from './AgentAvatar';

interface AgentStatusPanelAgentListProps {
  activeAgents: ActiveAgentInfo[];
  agents: Agent[];
  uiLanguage: UiLanguage;
  killing: Set<string>;
  onKill: (taskId: string) => void;
}

export default function AgentStatusPanelAgentList({
  activeAgents,
  agents,
  uiLanguage,
  killing,
  onKill,
}: AgentStatusPanelAgentListProps) {
  const t = (text: { ko: string; en: string; ja?: string; zh?: string }) => pickLang(uiLanguage, text);

  return (
    <div className="divide-y divide-slate-700/30">
      {activeAgents.map((ag) => {
        const fullAgent = agents.find((a) => a.id === ag.id);
        const agentName = uiLanguage === 'ko' ? (ag.name_ko || ag.name) : ag.name;
        const deptName = uiLanguage === 'ko' ? (ag.dept_name_ko || ag.dept_name) : ag.dept_name;
        const isKilling = ag.task_id ? killing.has(ag.task_id) : false;
        const idleText = ag.idle_seconds !== null ? fmtElapsed(ag.idle_seconds) : '-';
        const isIdle = ag.idle_seconds !== null && ag.idle_seconds > 300;

        return (
          <div key={ag.id} className="px-6 py-3">
            <div className="flex items-center gap-3">
              <AgentAvatar agent={fullAgent} agents={agents} size={40} rounded="xl" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-white">{agentName}</span>
                  <span className="rounded bg-slate-700/80 px-1.5 py-0.5 text-[10px] text-slate-400">{deptName}</span>
                  <span className="rounded bg-slate-700/60 px-1.5 py-0.5 text-[10px] text-slate-500">{ag.cli_provider}</span>
                </div>
                {ag.task_title && (
                  <p className="mt-0.5 truncate text-xs text-slate-400">{ag.task_title}</p>
                )}
                <div className="mt-1 flex flex-wrap items-center gap-3 text-[11px] text-slate-500">
                  {ag.has_active_process ? (
                    <span className="flex items-center gap-1">
                      <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-green-500" />
                      {t({ ko: '프로세스 활성', en: 'Process active' })}
                    </span>
                  ) : (
                    <span className="flex items-center gap-1">
                      <span className="inline-block h-1.5 w-1.5 rounded-full bg-amber-500" />
                      {t({ ko: '프로세스 없음', en: 'No process' })}
                    </span>
                  )}
                  <span>
                    {t({ ko: '마지막 응답', en: 'Last activity' })}: {fmtTime(ag.last_activity_at)}
                  </span>
                  <span className={isIdle ? 'text-amber-400' : ''}>
                    Idle: {idleText}
                  </span>
                </div>
              </div>
              {ag.task_id && (
                <button
                  onClick={() => onKill(ag.task_id!)}
                  disabled={isKilling}
                  className={`flex-shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                    isKilling
                      ? 'bg-slate-700 text-slate-500 cursor-not-allowed'
                      : 'bg-red-600/20 border border-red-500/30 text-red-400 hover:bg-red-600/30'
                  }`}
                >
                  {isKilling
                    ? t({ ko: '중지 중...', en: 'Stopping...' })
                    : t({ ko: '강제 중지', en: 'Kill' })}
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
