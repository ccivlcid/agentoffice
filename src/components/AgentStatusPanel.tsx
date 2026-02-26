import { useEffect, useState, useCallback } from 'react';
import type { Agent } from '../types';
import type { ActiveAgentInfo } from '../api';
import type { UiLanguage } from '../i18n';
import { pickLang } from '../i18n';
import { getActiveAgents, getCliProcesses, killCliProcess, stopTask } from '../api';
import AgentStatusPanelCliList from './AgentStatusPanelCliList';
import AgentStatusPanelAgentList from './AgentStatusPanelAgentList';

interface AgentStatusPanelProps {
  agents: Agent[];
  uiLanguage: UiLanguage;
  onClose: () => void;
}

export default function AgentStatusPanel({ agents, uiLanguage, onClose }: AgentStatusPanelProps) {
  const t = (text: { ko: string; en: string; ja?: string; zh?: string }) => pickLang(uiLanguage, text);
  const [activeAgents, setActiveAgents] = useState<ActiveAgentInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [killing, setKilling] = useState<Set<string>>(new Set());
  const [inspectorMode, setInspectorMode] = useState<'idle_cli' | 'script' | null>(null);
  const [cliProcesses, setCliProcesses] = useState<import('../api').CliProcessInfo[]>([]);
  const [cliLoading, setCliLoading] = useState(false);
  const [killingCliPids, setKillingCliPids] = useState<Set<number>>(new Set());

  const refresh = useCallback(() => {
    getActiveAgents()
      .then(setActiveAgents)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const refreshCli = useCallback(() => {
    setCliLoading(true);
    getCliProcesses()
      .then(setCliProcesses)
      .catch(console.error)
      .finally(() => setCliLoading(false));
  }, []);

  useEffect(() => {
    refresh();
    let interval: ReturnType<typeof setInterval>;
    function start() { interval = setInterval(refresh, 5000); }
    function onVis() { clearInterval(interval); if (!document.hidden) { refresh(); start(); } }
    start();
    document.addEventListener('visibilitychange', onVis);
    return () => { clearInterval(interval); document.removeEventListener('visibilitychange', onVis); };
  }, [refresh]);

  useEffect(() => {
    if (!inspectorMode) return;
    refreshCli();
    let interval: ReturnType<typeof setInterval>;
    function start() { interval = setInterval(refreshCli, 5000); }
    function onVis() { clearInterval(interval); if (!document.hidden) { refreshCli(); start(); } }
    start();
    document.addEventListener('visibilitychange', onVis);
    return () => { clearInterval(interval); document.removeEventListener('visibilitychange', onVis); };
  }, [inspectorMode, refreshCli]);

  const handleKill = async (taskId: string) => {
    if (!taskId || killing.has(taskId)) return;
    setKilling((prev) => new Set(prev).add(taskId));
    try {
      await stopTask(taskId);
      setTimeout(refresh, 1000);
    } catch (e) {
      console.error('Failed to stop task:', e);
    } finally {
      setKilling((prev) => {
        const next = new Set(prev);
        next.delete(taskId);
        return next;
      });
    }
  };

  const handleKillCliProcess = async (pid: number) => {
    if (!Number.isFinite(pid) || pid <= 0 || killingCliPids.has(pid)) return;
    setKillingCliPids((prev) => new Set(prev).add(pid));
    try {
      await killCliProcess(pid);
      setTimeout(refreshCli, 600);
      setTimeout(refresh, 800);
    } catch (e) {
      console.error('Failed to kill CLI process:', e);
    } finally {
      setKillingCliPids((prev) => {
        const next = new Set(prev);
        next.delete(pid);
        return next;
      });
    }
  };

  const visibleCliProcesses = inspectorMode === 'script'
    ? cliProcesses.filter((proc) => proc.provider === 'node' || proc.provider === 'python')
    : cliProcesses.filter((proc) => proc.provider !== 'node' && proc.provider !== 'python');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div
        className={`relative mx-4 w-full rounded-2xl border border-blue-500/30 bg-slate-900 shadow-2xl shadow-blue-500/10 ${
          inspectorMode ? 'max-w-3xl' : 'max-w-lg'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-700/50 px-6 py-4">
          <div className="flex items-center gap-3">
            <span className="text-2xl">&#x1F6E0;</span>
            <h2 className="text-lg font-bold text-white">
              {t({ ko: '활성 에이전트', en: 'Active Agents' })}
            </h2>
            <span className="rounded-full bg-blue-500/20 px-2 py-0.5 text-xs font-medium text-blue-400">
              {activeAgents.length}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={(e) => {
                e.stopPropagation();
                const nextMode = inspectorMode === 'script' ? null : 'script';
                setInspectorMode(nextMode);
                if (nextMode) refreshCli();
              }}
              className={`flex h-8 items-center gap-1 rounded-lg border px-2 text-[11px] font-medium whitespace-nowrap transition ${
                inspectorMode === 'script'
                  ? 'border-violet-500/40 bg-violet-500/20 text-violet-300'
                  : 'border-slate-700 text-slate-400 hover:border-slate-500 hover:bg-slate-800 hover:text-white'
              }`}
              title={t({ ko: 'Script 조회', en: 'Script Inspector' })}
            >
              <span>{t({ ko: 'Script조회', en: 'Script' })}</span>
              <span aria-hidden>&#x2699;</span>
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                const nextMode = inspectorMode === 'idle_cli' ? null : 'idle_cli';
                setInspectorMode(nextMode);
                if (nextMode) refreshCli();
              }}
              className={`flex h-8 items-center gap-1 rounded-lg border px-2 text-[11px] font-medium whitespace-nowrap transition ${
                inspectorMode === 'idle_cli'
                  ? 'border-blue-500/40 bg-blue-500/20 text-blue-300'
                  : 'border-slate-700 text-slate-400 hover:border-slate-500 hover:bg-slate-800 hover:text-white'
              }`}
              title={t({ ko: '유휴 CLI 조회', en: 'Idle CLI Inspector' })}
            >
              <span>{t({ ko: '유휴CLI조회', en: 'Idle CLI' })}</span>
              <span aria-hidden>&#x1F5A5;</span>
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); refresh(); }}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-800 hover:text-white"
              title={t({ ko: '새로고침', en: 'Refresh' })}
            >
              &#x21BB;
            </button>
            <button
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-800 hover:text-white"
            >
              &#x2715;
            </button>
          </div>
        </div>

        <div className="max-h-[70vh] overflow-y-auto">
          <AgentStatusPanelCliList
            visibleCliProcesses={visibleCliProcesses}
            cliLoading={cliLoading}
            inspectorMode={inspectorMode}
            uiLanguage={uiLanguage}
            killingCliPids={killingCliPids}
            onKillProcess={handleKillCliProcess}
            onRefreshCli={refreshCli}
          />

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-sm text-slate-500">
                {t({ ko: '불러오는 중...', en: 'Loading...' })}
              </div>
            </div>
          ) : activeAgents.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <span className="mb-2 text-3xl opacity-40">&#x1F634;</span>
              <p className="text-sm text-slate-500">
                {t({ ko: '현재 작업 중인 에이전트가 없습니다', en: 'No agents currently working' })}
              </p>
            </div>
          ) : (
            <AgentStatusPanelAgentList
              activeAgents={activeAgents}
              agents={agents}
              uiLanguage={uiLanguage}
              killing={killing}
              onKill={handleKill}
            />
          )}
        </div>

        <div className="border-t border-slate-700/50 px-6 py-3">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-500">
              {t({ ko: '5초마다 자동 갱신', en: 'Auto-refresh every 5s' })}
            </span>
            <button
              onClick={onClose}
              className="rounded-lg bg-slate-700 px-4 py-1.5 text-sm font-medium text-slate-300 transition hover:bg-slate-600"
            >
              {t({ ko: '닫기', en: 'Close' })}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
