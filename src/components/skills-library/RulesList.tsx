import { useState, useMemo } from "react";
import { FileText, RefreshCw, Check, FolderSearch, ChevronDown, ChevronRight } from "lucide-react";
import type { Agent } from "../../types";
import type { TFunction } from "./skillsLibraryHelpers";
import { useRules } from "./useRules";
import RuleRow from "./RuleRow";
import RuleEditModal from "./RuleEditModal";
import RulesGuide from "./RulesGuide";
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
  const [syncPanelOpen, setSyncPanelOpen] = useState(true);

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

  return (
    <div className="space-y-4">
      <RulesGuide t={t} />

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
              <button
                onClick={() => setSearch("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
              >
                &times;
              </button>
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
                return CatIcon ? (
                  <CatIcon width={14} height={14} className="shrink-0 inline-block align-middle" />
                ) : null;
              })()}{" "}
              {t(RULE_CATEGORY_LABELS[cat] || { ko: cat, en: cat })}
              <span className="ml-1 text-slate-500">{categoryCounts[cat] || 0}</span>
            </button>
          ))}
        </div>
      )}

      {rl.error && <div className="text-xs text-rose-400 px-1">{rl.error}</div>}

      <div className="text-xs text-slate-500 px-1">
        {filtered.length}
        {t({ ko: "개 룰 표시중", en: " rules shown" })}
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
          {syncPanelOpen ? (
            <ChevronDown width={18} height={18} className="text-slate-400" />
          ) : (
            <ChevronRight width={18} height={18} className="text-slate-400" />
          )}
        </button>
        {syncPanelOpen && (
          <div className="px-4 pb-4 pt-0 border-t border-slate-700/50">
            <div className="mt-3 max-h-[380px] overflow-y-auto space-y-2">
              {filtered.length > 0 ? (
                filtered.map((rule) => (
                  <RuleRow
                    key={rule.id}
                    rule={rule}
                    agents={agents}
                    t={t}
                    onToggle={() => void rl.handleToggle(rule.id)}
                    onEdit={() => rl.setEditingRule(rule)}
                    onDelete={() => rl.setDeleteConfirmId(rule.id)}
                  />
                ))
              ) : (
                <div className="rounded-lg border border-slate-700 bg-slate-800/40 px-3 py-6 text-center text-xs text-slate-400">
                  {t({ ko: "등록된 룰이 없습니다", en: "No registered rules" })}
                </div>
              )}
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => void rl.handleScan()}
                disabled={rl.scanning}
                className="px-3 py-1.5 text-xs font-medium bg-blue-600/20 text-blue-400 border border-blue-500/30 rounded-lg hover:bg-blue-600/30 transition-all disabled:opacity-50"
              >
                <FolderSearch
                  width={14}
                  height={14}
                  className={`inline-block align-middle mr-0.5 ${rl.scanning ? "animate-pulse" : ""}`}
                />{" "}
                {t({ ko: "프로젝트 스캔", en: "Scan Project" })}
              </button>
              <button
                onClick={() => void rl.handleSync()}
                disabled={rl.syncing}
                className="px-3 py-1.5 text-xs font-medium bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 rounded-lg hover:bg-emerald-600/30 transition-all disabled:opacity-50"
              >
                {rl.syncResult ? (
                  <>
                    <Check width={14} height={14} className="inline-block align-middle mr-0.5" />{" "}
                    {t({ ko: "동기화 완료", en: "Synced" })}
                  </>
                ) : (
                  <>
                    <RefreshCw
                      width={14}
                      height={14}
                      className={`inline-block align-middle mr-0.5 ${rl.syncing ? "animate-spin" : ""}`}
                    />{" "}
                    {t({ ko: "설정 동기화", en: "Sync Config" })}
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>

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
          onClose={() => {
            rl.setIsCreateOpen(false);
            rl.setEditingRule(null);
          }}
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
              <button onClick={() => rl.setDeleteConfirmId(null)} className="px-3 py-1.5 text-sm text-slate-400">
                {t({ ko: "취소", en: "Cancel" })}
              </button>
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
