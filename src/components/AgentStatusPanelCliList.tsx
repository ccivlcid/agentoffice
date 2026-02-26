import type { CliProcessInfo } from '../api';
import type { UiLanguage } from '../i18n';
import { pickLang } from '../i18n';
import { fmtElapsed, displayCliProvider } from './AgentStatusPanelHelpers';

interface AgentStatusPanelCliListProps {
  visibleCliProcesses: CliProcessInfo[];
  cliLoading: boolean;
  inspectorMode: 'idle_cli' | 'script' | null;
  uiLanguage: UiLanguage;
  killingCliPids: Set<number>;
  onKillProcess: (pid: number) => void;
  onRefreshCli: () => void;
}

export default function AgentStatusPanelCliList({
  visibleCliProcesses,
  cliLoading,
  inspectorMode,
  uiLanguage,
  killingCliPids,
  onKillProcess,
  onRefreshCli,
}: AgentStatusPanelCliListProps) {
  const t = (text: { ko: string; en: string; ja?: string; zh?: string }) => pickLang(uiLanguage, text);

  if (!inspectorMode) return null;

  return (
    <div className="border-b border-slate-700/50 bg-slate-950/40 px-4 py-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-300">
          {inspectorMode === 'script'
            ? t({ ko: '실행 중인 Script', en: 'Running Script Processes' })
            : t({ ko: '실행 중인 유휴CLI', en: 'Running Idle CLI Processes' })}
        </span>
        <div className="flex items-center gap-2">
          <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] text-slate-400">
            {visibleCliProcesses.length}
          </span>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onRefreshCli(); }}
            className="rounded border border-slate-700 px-2 py-0.5 text-[11px] text-slate-300 transition hover:border-slate-500 hover:text-white"
          >
            {t({ ko: '새로고침', en: 'Refresh' })}
          </button>
        </div>
      </div>
      {cliLoading && visibleCliProcesses.length === 0 ? (
        <div className="py-2 text-xs text-slate-500">
          {inspectorMode === 'script'
            ? t({ ko: 'Script 목록 불러오는 중...', en: 'Loading script list...' })
            : t({ ko: '유휴 CLI 목록 불러오는 중...', en: 'Loading idle CLI list...' })}
        </div>
      ) : visibleCliProcesses.length === 0 ? (
        <div className="py-2 text-xs text-slate-500">
          {inspectorMode === 'script'
            ? t({ ko: '실행 중인 Script가 없습니다', en: 'No running script process' })
            : t({ ko: '실행 중인 유휴 CLI가 없습니다', en: 'No running idle CLI' })}
        </div>
      ) : (
        <div className="max-h-56 divide-y divide-slate-800 overflow-y-auto rounded-lg border border-slate-800/80 bg-slate-900/50">
          {visibleCliProcesses.map((proc) => {
            const isKilling = killingCliPids.has(proc.pid);
            const agentName = uiLanguage === 'ko'
              ? (proc.agent_name_ko || proc.agent_name || '-')
              : (proc.agent_name || '-');
            const commandText = proc.command || proc.executable;
            const displayTitle = proc.task_title && proc.task_title !== commandText ? proc.task_title : null;
            return (
              <div key={proc.pid} className="px-3 py-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 text-[11px]">
                      <span className="rounded bg-slate-700/80 px-1.5 py-0.5 text-slate-200">
                        {displayCliProvider(proc.provider)}
                      </span>
                      <span className="text-slate-400">PID {proc.pid}</span>
                      {proc.is_idle ? (
                        <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-amber-300">
                          {t({ ko: '유휴', en: 'Idle' })}
                        </span>
                      ) : (
                        <span className="rounded bg-emerald-500/15 px-1.5 py-0.5 text-emerald-300">
                          {t({ ko: '활성', en: 'Active' })}
                        </span>
                      )}
                    </div>
                    {displayTitle ? (
                      <p className="mt-1 text-[11px] text-slate-300 break-all">{displayTitle}</p>
                    ) : null}
                    <p
                      className="mt-1 overflow-x-auto font-mono text-[10px] leading-relaxed text-slate-400 whitespace-pre-wrap break-all"
                      title={commandText}
                    >
                      {commandText}
                    </p>
                    <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[10px] text-slate-500">
                      <span>{t({ ko: '담당', en: 'Agent' })}: {agentName}</span>
                      <span>{t({ ko: '작업', en: 'Task' })}: {proc.task_status || '-'}</span>
                      <span>Idle: {fmtElapsed(proc.idle_seconds)}</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => onKillProcess(proc.pid)}
                    disabled={isKilling}
                    className={`flex-shrink-0 rounded border px-2 py-1 text-[11px] font-medium transition ${
                      isKilling
                        ? 'cursor-not-allowed border-slate-700 bg-slate-800 text-slate-500'
                        : 'border-red-500/40 bg-red-600/15 text-red-300 hover:bg-red-600/25'
                    }`}
                  >
                    {isKilling
                      ? t({ ko: '중지 중...', en: 'Killing...' })
                      : t({ ko: 'Kill', en: 'Kill' })}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
