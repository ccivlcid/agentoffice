import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  getAvailableLearnedSkills,
  getSkillLearningHistory,
  unlearnSkill,
  type LearnedSkillEntry,
  type SkillHistoryProvider,
  type SkillLearningHistoryEntry,
} from '../api';
import type { Agent } from '../types';
import {
  HISTORY_PREVIEW_COUNT,
  learningRowKey,
  normalizeSkillLabel,
  PROVIDER_ORDER,
  providerLabel,
  ROLE_ORDER,
  type UnlearnEffect,
} from './skill-history/skillHistoryHelpers';
import SkillHistoryRow from './skill-history/SkillHistoryRow';
import SkillHistoryCenterBonk from './skill-history/SkillHistoryCenterBonk';

function pickRepresentativeForProvider(agents: Agent[], provider: SkillHistoryProvider): Agent | null {
  const candidates = agents.filter((a) => a.cli_provider === provider);
  if (candidates.length === 0) return null;
  return [...candidates].sort((a, b) => {
    const roleGap = ROLE_ORDER[a.role] - ROLE_ORDER[b.role];
    if (roleGap !== 0) return roleGap;
    if (b.stats_xp !== a.stats_xp) return b.stats_xp - a.stats_xp;
    return a.id.localeCompare(b.id);
  })[0];
}

interface SkillHistoryPanelProps {
  agents: Agent[];
  refreshToken?: number;
  className?: string;
  onLearningDataChanged?: () => void;
}

export default function SkillHistoryPanel({
  agents, refreshToken = 0, className = '', onLearningDataChanged,
}: SkillHistoryPanelProps) {
  const [tab, setTab] = useState<'history' | 'available'>('history');
  const [providerFilter, setProviderFilter] = useState<'all' | SkillHistoryProvider>('all');
  const [historyRows, setHistoryRows] = useState<SkillLearningHistoryEntry[]>([]);
  const [availableRows, setAvailableRows] = useState<LearnedSkillEntry[]>([]);
  const [retentionDays, setRetentionDays] = useState<number>(180);
  const [historyExpanded, setHistoryExpanded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [unlearnError, setUnlearnError] = useState<string | null>(null);
  const [unlearningKeys, setUnlearningKeys] = useState<string[]>([]);
  const [unlearnEffects, setUnlearnEffects] = useState<Partial<Record<string, UnlearnEffect>>>({});
  const [centerBonk, setCenterBonk] = useState<{ provider: SkillHistoryProvider; agent: Agent | null } | null>(null);
  const unlearnEffectTimersRef = useRef<Partial<Record<string, number>>>({});
  const centerBonkTimerRef = useRef<number | null>(null);

  const representatives = useMemo(() => {
    const out = new Map<SkillHistoryProvider, Agent | null>();
    for (const p of PROVIDER_ORDER) out.set(p, pickRepresentativeForProvider(agents, p));
    return out;
  }, [agents]);

  const activeProviders = useMemo(() => {
    const fromRows = new Set<SkillHistoryProvider>();
    for (const row of historyRows) fromRows.add(row.provider);
    for (const row of availableRows) fromRows.add(row.provider);
    for (const p of PROVIDER_ORDER) { if (representatives.get(p)) fromRows.add(p); }
    return PROVIDER_ORDER.filter((p) => fromRows.has(p));
  }, [availableRows, historyRows, representatives]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const provider = providerFilter === 'all' ? undefined : providerFilter;
      const [historyData, availableData] = await Promise.all([
        getSkillLearningHistory({ provider, limit: 80 }),
        getAvailableLearnedSkills({ provider, limit: 30 }),
      ]);
      setHistoryRows(historyData.history);
      setAvailableRows(availableData);
      if (historyData.retentionDays > 0) setRetentionDays(historyData.retentionDays);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [providerFilter]);

  useEffect(() => { void load(); }, [load, refreshToken]);
  useEffect(() => {
    const timer = window.setInterval(() => void load(), 20_000);
    return () => window.clearInterval(timer);
  }, [load]);
  useEffect(() => { setHistoryExpanded(false); }, [providerFilter, tab]);
  useEffect(() => {
    return () => {
      for (const id of Object.values(unlearnEffectTimersRef.current)) {
        if (typeof id === 'number') window.clearTimeout(id);
      }
      if (typeof centerBonkTimerRef.current === 'number') window.clearTimeout(centerBonkTimerRef.current);
    };
  }, []);

  function triggerUnlearnEffect(rowKey: string, provider: SkillHistoryProvider) {
    const effect: UnlearnEffect = Math.random() < 0.5 ? 'pot' : 'hammer';
    setUnlearnEffects((prev) => ({ ...prev, [rowKey]: effect }));
    setCenterBonk({ provider, agent: representatives.get(provider) ?? null });
    if (typeof centerBonkTimerRef.current === 'number') window.clearTimeout(centerBonkTimerRef.current);
    centerBonkTimerRef.current = window.setTimeout(() => { setCenterBonk(null); centerBonkTimerRef.current = null; }, 950);
    const existing = unlearnEffectTimersRef.current[rowKey];
    if (typeof existing === 'number') window.clearTimeout(existing);
    unlearnEffectTimersRef.current[rowKey] = window.setTimeout(() => {
      setUnlearnEffects((prev) => { const next = { ...prev }; delete next[rowKey]; return next; });
      delete unlearnEffectTimersRef.current[rowKey];
    }, 1100);
  }

  async function handleUnlearn(row: { provider: SkillHistoryProvider; repo: string; skill_id: string }) {
    const rowKey = learningRowKey(row);
    if (unlearningKeys.includes(rowKey)) return;
    setUnlearnError(null);
    setUnlearningKeys((prev) => [...prev, rowKey]);
    try {
      const result = await unlearnSkill({ provider: row.provider, repo: row.repo, skillId: row.skill_id });
      if (result.removed > 0) {
        setAvailableRows((prev) => prev.filter((item) => learningRowKey(item) !== rowKey));
        setHistoryRows((prev) => prev.filter((item) => !(
          item.provider === row.provider && item.repo === row.repo &&
          item.skill_id === row.skill_id && item.status === 'succeeded'
        )));
        triggerUnlearnEffect(rowKey, row.provider);
      }
      onLearningDataChanged?.();
      void load();
    } catch (e) {
      setUnlearnError(e instanceof Error ? e.message : String(e));
    } finally {
      setUnlearningKeys((prev) => prev.filter((k) => k !== rowKey));
    }
  }

  const visibleHistoryRows = useMemo(
    () => historyExpanded ? historyRows : historyRows.slice(0, HISTORY_PREVIEW_COUNT),
    [historyExpanded, historyRows]
  );
  const hiddenHistoryCount = Math.max(0, historyRows.length - HISTORY_PREVIEW_COUNT);

  return (
    <div className={`skill-history-panel flex h-full min-h-[360px] flex-col rounded-xl border border-slate-700/60 bg-slate-900/60 ${className}`}>
      {/* Tabs */}
      <div className="flex items-center justify-between gap-2 border-b border-slate-700/60 px-3 py-2.5">
        <div className="flex items-center gap-1">
          {(['history', 'available'] as const).map((t) => (
            <button key={t} type="button" onClick={() => setTab(t)}
              className={`rounded-md px-2 py-1 text-[11px] font-medium transition-all ${tab === t ? 'bg-slate-700 text-white' : 'text-slate-400 hover:bg-slate-800/80 hover:text-slate-200'}`}
            >
              {t === 'history' ? 'Learning History' : 'Available Skills'}
            </button>
          ))}
        </div>
        <button type="button" onClick={() => void load()} className="rounded-md border border-slate-600 px-2 py-1 text-[11px] text-slate-300 transition-all hover:bg-slate-800">
          Refresh
        </button>
      </div>

      {/* Provider filter */}
      <div className="flex items-center gap-1 overflow-x-auto px-3 py-2">
        {(['all', ...activeProviders] as const).map((p) => (
          <button key={p} type="button" onClick={() => setProviderFilter(p)}
            className={`rounded-md border px-2 py-1 text-[10px] transition-all ${providerFilter === p ? 'border-blue-500/50 bg-blue-600/20 text-blue-300' : 'border-slate-700 text-slate-400 hover:bg-slate-800/80 hover:text-slate-200'}`}
          >
            {p === 'all' ? 'All' : providerLabel(p)}
          </button>
        ))}
      </div>

      <div className="px-3 pb-2 text-[10px] text-slate-500">Retention: {retentionDays} days</div>

      {/* Rows */}
      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-3 pb-3">
        {loading && historyRows.length === 0 && availableRows.length === 0 && (
          <div className="rounded-lg border border-slate-700 bg-slate-800/40 px-3 py-6 text-center text-xs text-slate-400">Loading memory records...</div>
        )}
        {error && <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-[11px] text-rose-200">{error}</div>}
        {unlearnError && <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-[11px] text-rose-200">{unlearnError}</div>}
        {tab === 'history' && historyRows.length === 0 && !loading && !error && (
          <div className="rounded-lg border border-slate-700 bg-slate-800/40 px-3 py-6 text-center text-xs text-slate-400">No learning history yet.</div>
        )}

        {tab === 'history' && visibleHistoryRows.map((row) => {
          const rowKey = learningRowKey(row);
          return (
            <SkillHistoryRow
              key={row.id}
              agent={representatives.get(row.provider) ?? null}
              agents={agents}
              label={normalizeSkillLabel(row)}
              repo={row.repo}
              providerName={providerLabel(row.provider)}
              isUnlearning={unlearningKeys.includes(rowKey)}
              unlearnEffect={unlearnEffects[rowKey]}
              canUnlearn={row.status === 'succeeded'}
              timestamp={row.run_completed_at ?? row.updated_at ?? row.created_at}
              status={row.status}
              error={row.error}
              onUnlearn={() => void handleUnlearn(row)}
            />
          );
        })}

        {tab === 'history' && hiddenHistoryCount > 0 && (
          <div className="flex justify-center pt-1">
            <button type="button" onClick={() => setHistoryExpanded((p) => !p)}
              className="rounded-md border border-slate-600 px-2.5 py-1 text-[11px] text-slate-300 transition-all hover:bg-slate-800 hover:text-white"
            >
              {historyExpanded ? 'Show less' : `Show ${hiddenHistoryCount} more`}
            </button>
          </div>
        )}

        {tab === 'available' && availableRows.length === 0 && !loading && !error && (
          <div className="rounded-lg border border-slate-700 bg-slate-800/40 px-3 py-6 text-center text-xs text-slate-400">No available skills.</div>
        )}

        {tab === 'available' && availableRows.map((row) => {
          const rowKey = learningRowKey(row);
          return (
            <SkillHistoryRow
              key={`${row.provider}-${row.repo}-${row.skill_id}`}
              agent={representatives.get(row.provider) ?? null}
              agents={agents}
              label={normalizeSkillLabel(row)}
              repo={row.repo}
              providerName={providerLabel(row.provider)}
              isUnlearning={unlearningKeys.includes(rowKey)}
              unlearnEffect={unlearnEffects[rowKey]}
              canUnlearn
              timestamp={row.learned_at}
              onUnlearn={() => void handleUnlearn(row)}
            />
          );
        })}
      </div>

      {centerBonk && (
        <SkillHistoryCenterBonk
          provider={centerBonk.provider}
          agent={centerBonk.agent}
          agents={agents}
        />
      )}
    </div>
  );
}
