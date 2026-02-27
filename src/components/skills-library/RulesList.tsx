import { useState, useMemo } from "react";
import {
  FileText, Plus, RefreshCw, Search, Check, HelpCircle,
  ChevronDown, ChevronRight,
} from "lucide-react";
import type { Agent } from "../../types";
import type { TFunction } from "./skillsLibraryHelpers";
import { useRules } from "./useRules";
import RuleCard from "./RuleCard";
import RuleEditModal from "./RuleEditModal";
import { RULE_CATEGORY_ICONS } from "../../constants/icons";

const RULE_CATEGORIES = ["All", "general", "coding", "architecture", "testing", "style"] as const;

const RULE_CATEGORY_LABELS: Record<string, { ko: string; en: string }> = {
  All: { ko: "전체", en: "All" },
  general: { ko: "일반", en: "General" },
  coding: { ko: "코딩", en: "Coding" },
  architecture: { ko: "아키텍처", en: "Architecture" },
  testing: { ko: "테스팅", en: "Testing" },
  style: { ko: "스타일", en: "Style" },
};

interface RulesListProps {
  t: TFunction;
  agents: Agent[];
  localeTag: string;
}

export default function RulesList({ t, agents }: RulesListProps) {
  const rl = useRules();
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [sortBy, setSortBy] = useState<"name" | "updated" | "category">("name");
  const [guideOpen, setGuideOpen] = useState(true);
  const [syncPanelOpen, setSyncPanelOpen] = useState(true);
  const [hoveredRule, setHoveredRule] = useState<string | null>(null);

  const filtered = useMemo(() => {
    let result = rl.rules;
    if (selectedCategory !== "All") {
      result = result.filter((r) => r.category === selectedCategory);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (r) =>
          r.name.toLowerCase().includes(q) ||
          r.title.toLowerCase().includes(q) ||
          r.description.toLowerCase().includes(q),
      );
    }
    result = [...result].sort((a, b) => {
      if (sortBy === "name") return (a.title || a.name).localeCompare(b.title || b.name);
      if (sortBy === "updated") return b.updated_at - a.updated_at;
      return a.category.localeCompare(b.category);
    });
    return result;
  }, [rl.rules, search, selectedCategory, sortBy]);

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { All: rl.rules.length };
    for (const r of rl.rules) {
      counts[r.category] = (counts[r.category] || 0) + 1;
    }
    return counts;
  }, [rl.rules]);

  const deleteTarget = rl.deleteConfirmId ? rl.rules.find((r) => r.id === rl.deleteConfirmId) : null;

  // Provider sync summary
  const providerSyncSummary = useMemo(() => {
    const summary: Record<string, string[]> = {};
    for (const r of rl.rules) {
      if (!r.enabled) continue;
      let providers: string[];
      try { providers = JSON.parse(r.providers); } catch { providers = []; }
      for (const p of providers) {
        (summary[p] ??= []).push(r.title || r.name);
      }
    }
    return summary;
  }, [rl.rules]);

  return (
    <div className="space-y-4">
      {/* Guide */}
      <div className="bg-slate-800/60 backdrop-blur-sm border border-slate-700/50 rounded-xl overflow-hidden">
        <button
          type="button"
          onClick={() => setGuideOpen((v) => !v)}
          className="w-full flex items-center gap-2 px-5 py-4 text-left hover:bg-slate-700/30 transition-colors"
          aria-expanded={guideOpen}
        >
          <HelpCircle width={22} height={22} className="text-amber-400 shrink-0" aria-hidden />
          <span className="font-semibold text-white">
            {t({ ko: "사용법 및 가이드", en: "Usage & Guide" })}
          </span>
          {guideOpen ? <ChevronDown width={18} height={18} className="text-slate-400 ml-auto" /> : <ChevronRight width={18} height={18} className="text-slate-400 ml-auto" />}
        </button>
        {guideOpen && (
          <div className="px-5 pb-5 pt-0 border-t border-slate-700/50">
            <div className="text-sm text-slate-300 space-y-3 mt-3">
              <p>
                {t({
                  ko: "에이전트 룰을 등록하면 AI 에이전트(CLI)가 작업 시 해당 지침을 따릅니다. 등록된 룰은 '동기화'로 각 CLI 설정 파일에 자동 반영됩니다.",
                  en: "Register agent rules to guide AI agents (CLI) during work. Rules are auto-synced to CLI config files when you click 'Sync'.",
                })}
              </p>
              <ul className="list-disc list-inside space-y-1.5 text-slate-400">
                <li>{t({ ko: "검색/카테고리로 룰을 필터링한 뒤, 카드의 「동기화」로 설정 파일에 반영할 수 있습니다.", en: "Filter rules by search or category, then use \"Sync\" on a card to write to config files." })}</li>
                <li>{t({ ko: "프리셋에서 인기 룰을 추가하거나, 직접 마크다운으로 작성할 수 있습니다.", en: "Add popular rules from presets or write your own in Markdown." })}</li>
                <li>{t({ ko: "에이전트 룰 동기화 현황에서 CLI별로 어떤 룰이 동기화되었는지 확인할 수 있습니다.", en: "Check Rule Sync Status to see which rules are synced per CLI." })}</li>
              </ul>
              <p className="text-slate-500 text-xs mt-2">
                {t({ ko: "룰을 동기화한 에이전트는 해당 룰의 지침에 따라 작업을 수행할 수 있습니다.", en: "Agents with synced rules can follow the instructions in those rules." })}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Header */}
      <div className="bg-slate-800/60 backdrop-blur-sm border border-slate-700/50 rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <FileText width={20} height={20} className="text-amber-400 shrink-0" aria-hidden />
            <span className="text-sm font-semibold text-white">
              {t({ ko: "에이전트 룰 목록", en: "Agent Rule List" })}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <div className="text-2xl font-bold text-empire-gold">{rl.rules.length}</div>
              <div className="text-xs text-slate-500">{t({ ko: "등록된 룰", en: "Registered" })}</div>
            </div>
            <button
              onClick={() => rl.setIsCreateOpen(true)}
              className="px-3 py-1.5 text-xs font-medium bg-blue-600/20 text-blue-400 border border-blue-500/30 rounded-lg hover:bg-blue-600/30 transition-all"
            >
              + {t({ ko: "직접 추가", en: "Manual" })}
            </button>
          </div>
        </div>

        <div className="flex gap-3">
          <div className="flex-1 relative">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t({ ko: "룰 검색... (이름, 제목, 설명)", en: "Search rules... (name, title, description)" })}
              className="w-full bg-slate-900/60 border border-slate-600/50 rounded-lg px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/25"
            />
            {search && (
              <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300">&times;</button>
            )}
          </div>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
            className="bg-slate-900/60 border border-slate-600/50 rounded-lg px-3 py-2.5 text-sm text-slate-300 focus:outline-none focus:border-blue-500/50"
          >
            <option value="name">{t({ ko: "이름순", en: "By Name" })}</option>
            <option value="updated">{t({ ko: "최신순", en: "By Updated" })}</option>
            <option value="category">{t({ ko: "카테고리순", en: "By Category" })}</option>
          </select>
        </div>
      </div>

      {/* Category filter with icons — only show when items exist */}
      {rl.rules.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {RULE_CATEGORIES.filter((cat) => cat === "All" || (categoryCounts[cat] || 0) > 0).map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                selectedCategory === cat
                  ? "bg-blue-600/20 text-blue-400 border-blue-500/40"
                  : "bg-slate-800/40 text-slate-400 border-slate-700/50 hover:bg-slate-700/40 hover:text-slate-300"
              }`}
            >
              {(() => {
                const CatIcon = RULE_CATEGORY_ICONS[cat];
                return CatIcon ? <CatIcon width={14} height={14} className="shrink-0 inline-block align-middle" /> : null;
              })()}{" "}
              {t(RULE_CATEGORY_LABELS[cat] || { ko: cat, en: cat })}
              <span className="ml-1 text-slate-500">{categoryCounts[cat] || 0}</span>
            </button>
          ))}
        </div>
      )}

      {rl.error && <div className="text-xs text-rose-400 px-1">{rl.error}</div>}

      <div className="text-xs text-slate-500 px-1">
        {filtered.length}{t({ ko: "개 룰 표시중", en: " rules shown" })}
        {search && ` · "${search}" ${t({ ko: "검색 결과", en: "search results" })}`}
      </div>

      {/* Sync Status Panel — like "에이전트 학습 스킬" */}
      <div className="rounded-xl border border-slate-700/60 bg-slate-900/50 overflow-hidden">
        <button
          type="button"
          onClick={() => setSyncPanelOpen((v) => !v)}
          className="w-full flex items-center gap-2 px-4 py-3 text-left hover:bg-slate-700/30 transition-colors"
          aria-expanded={syncPanelOpen}
        >
          <div className="text-sm font-semibold text-slate-100">
            {t({ ko: "에이전트 룰 동기화 현황", en: "Rule Sync Status" })}
          </div>
          <div className="text-[11px] text-slate-500 ml-auto mr-2">
            {t({ ko: "CLI별 룰 현황", en: "Per-CLI rule status" })}
          </div>
          {syncPanelOpen ? <ChevronDown width={18} height={18} className="text-slate-400" /> : <ChevronRight width={18} height={18} className="text-slate-400" />}
        </button>
        {syncPanelOpen && (
          <div className="px-4 pb-4 pt-0 border-t border-slate-700/50">
            <div className="mt-3 space-y-2">
              {Object.keys(providerSyncSummary).length > 0 ? (
                Object.entries(providerSyncSummary).map(([provider, ruleNames]) => (
                  <div key={provider} className="flex items-start gap-2 rounded-lg border border-slate-700 bg-slate-800/40 px-3 py-2">
                    <span className="text-[10px] px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20 shrink-0 mt-0.5 font-medium">
                      {provider}
                    </span>
                    <div className="flex flex-wrap gap-1 flex-1 min-w-0">
                      {ruleNames.map((name) => (
                        <span key={name} className="text-[10px] px-1.5 py-0.5 rounded bg-slate-700/50 text-slate-400">{name}</span>
                      ))}
                    </div>
                    <span className="text-[10px] text-emerald-400 font-medium shrink-0">{ruleNames.length}</span>
                  </div>
                ))
              ) : (
                <div className="rounded-lg border border-slate-700 bg-slate-800/40 px-3 py-6 text-center text-xs text-slate-400">
                  {t({ ko: "활성화된 룰이 없습니다", en: "No active rules" })}
                </div>
              )}
              <div className="flex justify-end pt-1">
                <button
                  onClick={() => void rl.handleSync()}
                  disabled={rl.syncing}
                  className="px-3 py-1.5 text-xs font-medium bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 rounded-lg hover:bg-emerald-600/30 transition-all disabled:opacity-50"
                >
                  {rl.syncResult ? (
                    <><Check width={14} height={14} className="inline-block align-middle mr-0.5" /> {t({ ko: "동기화 완료", en: "Synced" })}</>
                  ) : (
                    <><RefreshCw width={14} height={14} className={`inline-block align-middle mr-0.5 ${rl.syncing ? "animate-spin" : ""}`} /> {t({ ko: "설정 동기화", en: "Sync Config" })}</>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Rule Card Grid */}
      {filtered.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {filtered.map((rule) => (
            <RuleCard
              key={rule.id}
              rule={rule}
              agents={agents}
              t={t}
              isHovered={hoveredRule === rule.id}
              onMouseEnter={() => setHoveredRule(rule.id)}
              onMouseLeave={() => setHoveredRule(null)}
              onToggle={() => void rl.handleToggle(rule.id)}
              onEdit={() => rl.setEditingRule(rule)}
              onDelete={() => rl.setDeleteConfirmId(rule.id)}
              onSync={() => void rl.handleSync()}
            />
          ))}
        </div>
      )}

      <div className="text-center text-xs text-slate-600 py-4">
        {t({
          ko: "에이전트 룰을 등록하고 '동기화'를 누르면 CLI별 설정 파일에 자동 반영됩니다",
          en: "Register rules and click 'Sync' to auto-write CLI config files",
        })}
      </div>

      {/* Modals */}
      {(rl.isCreateOpen || rl.editingRule) && (
        <RuleEditModal
          rule={rl.editingRule}
          submitting={rl.submitting}
          t={t}
          onClose={() => { rl.setIsCreateOpen(false); rl.setEditingRule(null); }}
          onSave={(data) => {
            if (rl.editingRule) void rl.handleUpdate(rl.editingRule.id, data);
            else void rl.handleCreate(data as Parameters<typeof rl.handleCreate>[0]);
          }}
        />
      )}

      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="w-80 rounded-2xl border border-slate-700 bg-slate-800 p-6">
            <h4 className="text-sm font-bold text-white mb-2">{t({ ko: "룰 삭제", en: "Delete Rule" })}</h4>
            <p className="text-xs text-slate-400 mb-4">{deleteTarget.title || deleteTarget.name}</p>
            <div className="flex justify-end gap-2">
              <button onClick={() => rl.setDeleteConfirmId(null)} className="px-3 py-1.5 text-sm text-slate-400">{t({ ko: "취소", en: "Cancel" })}</button>
              <button
                onClick={() => void rl.handleDelete(deleteTarget.id)}
                disabled={rl.submitting}
                className="px-3 py-1.5 text-sm font-medium bg-rose-600 text-white rounded-lg hover:bg-rose-500 disabled:opacity-50"
              >
                {t({ ko: "삭제", en: "Delete" })}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
