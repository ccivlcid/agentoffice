import { useState, useMemo, useEffect, useRef } from "react";
import {
  Plug, Plus, RefreshCw, Search, Check, Globe, Download, Loader2,
  ChevronDown, ChevronRight, ExternalLink, HelpCircle,
} from "lucide-react";
import type { Agent } from "../../types";
import type { TFunction } from "./skillsLibraryHelpers";
import { useMcpServers } from "./useMcpServers";
import McpServerCard from "./McpServerCard";
import McpServerEditModal from "./McpServerEditModal";
import McpAddModal from "./McpAddModal";
import type { McpRegistryEntry } from "../../api";
import { MCP_CATEGORY_ICONS } from "../../constants/icons";

const MCP_CATEGORIES = ["All", "filesystem", "database", "api", "dev-tools", "other"] as const;

const MCP_CATEGORY_LABELS: Record<string, { ko: string; en: string }> = {
  All: { ko: "전체", en: "All" },
  filesystem: { ko: "파일시스템", en: "Filesystem" },
  database: { ko: "데이터베이스", en: "Database" },
  api: { ko: "API", en: "API" },
  "dev-tools": { ko: "개발도구", en: "Dev Tools" },
  other: { ko: "기타", en: "Other" },
};

/** 레지스트리 엔트리의 이름/설명에서 카테고리를 추론 */
export function inferMcpCategory(entry: McpRegistryEntry): string {
  const text = `${entry.name} ${entry.title} ${entry.description}`.toLowerCase();
  if (/\b(file|filesystem|fs|directory|folder|path|disk|storage)\b/.test(text)) return "filesystem";
  if (/\b(sql|postgres|mysql|sqlite|mongo|redis|database|db|supabase|prisma|drizzle|dynamo|fauna|firebase)\b/.test(text)) return "database";
  if (/\b(api|http|rest|graphql|webhook|fetch|request|oauth|slack|discord|github|gitlab|jira|notion|stripe|twilio|sendgrid|openai|anthropic|google|aws|azure|cloud)\b/.test(text)) return "api";
  if (/\b(git|docker|npm|yarn|pnpm|lint|test|debug|build|ci|cd|deploy|kubernetes|k8s|terraform|puppeteer|playwright|selenium|browser|chrome|screenshot|scrape|crawl)\b/.test(text)) return "dev-tools";
  return "other";
}

interface McpServerListProps {
  t: TFunction;
  agents: Agent[];
  localeTag: string;
}

export default function McpServerList({ t, agents }: McpServerListProps) {
  const mcp = useMcpServers();
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [sortBy, setSortBy] = useState<"name" | "updated" | "category">("name");
  const [guideOpen, setGuideOpen] = useState(true);
  const [syncPanelOpen, setSyncPanelOpen] = useState(true);
  const [registryOpen, setRegistryOpen] = useState(true);
  const [hoveredServer, setHoveredServer] = useState<string | null>(null);
  const [registrySearchInput, setRegistrySearchInput] = useState("");
  const [registryCategoryFilter, setRegistryCategoryFilter] = useState("All");
  const [addModalEntry, setAddModalEntry] = useState<McpRegistryEntry | null>(null);
  const registryLoaded = useRef(false);

  useEffect(() => {
    if (registryOpen && !registryLoaded.current) {
      registryLoaded.current = true;
      void mcp.loadRegistry();
    }
  }, [registryOpen, mcp.loadRegistry]);

  const filtered = useMemo(() => {
    let result = mcp.servers;
    if (selectedCategory !== "All") {
      result = result.filter((s) => s.category === selectedCategory);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          s.server_key.toLowerCase().includes(q) ||
          s.package.toLowerCase().includes(q) ||
          s.description.toLowerCase().includes(q),
      );
    }
    result = [...result].sort((a, b) => {
      if (sortBy === "name") return a.name.localeCompare(b.name);
      if (sortBy === "updated") return b.updated_at - a.updated_at;
      return a.category.localeCompare(b.category);
    });
    return result;
  }, [mcp.servers, search, selectedCategory, sortBy]);

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { All: mcp.servers.length };
    for (const s of mcp.servers) {
      counts[s.category] = (counts[s.category] || 0) + 1;
    }
    return counts;
  }, [mcp.servers]);

  const existingKeys = useMemo(() => new Set(mcp.servers.map((s) => s.server_key)), [mcp.servers]);
  const deleteTarget = mcp.deleteConfirmId ? mcp.servers.find((s) => s.id === mcp.deleteConfirmId) : null;

  // Provider sync summary
  const providerSyncSummary = useMemo(() => {
    const summary: Record<string, string[]> = {};
    for (const s of mcp.servers) {
      if (!s.enabled) continue;
      let providers: string[];
      try { providers = JSON.parse(s.providers); } catch { providers = []; }
      for (const p of providers) {
        (summary[p] ??= []).push(s.name);
      }
    }
    return summary;
  }, [mcp.servers]);

  /** 레지스트리 엔트리 + 추론 카테고리 */
  const registryWithCategory = useMemo(
    () => mcp.registry.map((e) => ({ ...e, _cat: inferMcpCategory(e) })),
    [mcp.registry],
  );

  const registryCategoryCounts = useMemo(() => {
    const counts: Record<string, number> = { All: registryWithCategory.length };
    for (const e of registryWithCategory) {
      counts[e._cat] = (counts[e._cat] || 0) + 1;
    }
    return counts;
  }, [registryWithCategory]);

  const filteredRegistry = useMemo(
    () => registryCategoryFilter === "All"
      ? registryWithCategory
      : registryWithCategory.filter((e) => e._cat === registryCategoryFilter),
    [registryWithCategory, registryCategoryFilter],
  );

  const handleRegistrySearch = () => {
    setRegistryCategoryFilter("All");
    void mcp.loadRegistry(registrySearchInput.trim() || undefined);
  };

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
                  ko: "MCP(Model Context Protocol) 서버를 등록하면 AI 에이전트가 외부 도구와 데이터 소스에 접근할 수 있습니다. 등록된 서버는 '설정 동기화'로 각 CLI 설정 파일에 자동 반영됩니다.",
                  en: "Register MCP servers to give AI agents access to external tools and data sources. Registered servers are auto-synced to CLI config files.",
                })}
              </p>
              <ul className="list-disc list-inside space-y-1.5 text-slate-400">
                <li>{t({ ko: "검색/카테고리로 서버를 필터링한 뒤, 카드의 「동기화」로 설정 파일에 반영할 수 있습니다.", en: "Filter servers by search or category, then use \"Sync\" on a card to write to config files." })}</li>
                <li>{t({ ko: "프리셋에서 인기 MCP 서버를 추가하거나, 레지스트리에서 검색하여 추가할 수 있습니다.", en: "Add popular MCP servers from presets or search the registry." })}</li>
                <li>{t({ ko: "MCP 동기화 현황에서 CLI별로 어떤 서버가 동기화되었는지 확인할 수 있습니다.", en: "Check MCP Sync Status to see which servers are synced per CLI." })}</li>
              </ul>
              <p className="text-slate-500 text-xs mt-2">
                {t({ ko: "동기화된 서버는 해당 CLI의 설정 파일에서 에이전트가 사용할 수 있습니다.", en: "Synced servers are available to agents through the CLI config files." })}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Header */}
      <div className="bg-slate-800/60 backdrop-blur-sm border border-slate-700/50 rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Plug width={20} height={20} className="text-purple-400 shrink-0" aria-hidden />
            <span className="text-sm font-semibold text-white">
              {t({ ko: "MCP 서버 목록", en: "MCP Server List" })}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <div className="text-2xl font-bold text-empire-gold">{mcp.servers.length}</div>
              <div className="text-xs text-slate-500">
                {t({ ko: "등록된 서버", en: "Registered" })}
              </div>
            </div>
            <button
              onClick={() => mcp.setIsCreateOpen(true)}
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
              placeholder={t({ ko: "MCP 서버 검색... (이름, 패키지, 설명)", en: "Search MCP servers... (name, package, description)" })}
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

      {/* Category filter — unified for registry + registered servers (same position as Skills page) */}
      <div className="flex flex-wrap gap-2">
        {MCP_CATEGORIES.map((cat) => {
          const regCount = registryCategoryCounts[cat] || 0;
          const srvCount = categoryCounts[cat] || 0;
          const total = cat === "All" ? regCount + srvCount - mcp.servers.length : regCount + srvCount;
          return (
            <button
              key={cat}
              onClick={() => { setSelectedCategory(cat); setRegistryCategoryFilter(cat); }}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                selectedCategory === cat
                  ? "bg-blue-600/20 text-blue-400 border-blue-500/40"
                  : "bg-slate-800/40 text-slate-400 border-slate-700/50 hover:bg-slate-700/40 hover:text-slate-300"
              }`}
            >
              {(() => {
                const CatIcon = MCP_CATEGORY_ICONS[cat];
                return CatIcon ? <CatIcon width={14} height={14} className="shrink-0 inline-block align-middle" /> : null;
              })()}{" "}
              {t(MCP_CATEGORY_LABELS[cat] || { ko: cat, en: cat })}
              <span className="ml-1 text-slate-500">{total}</span>
            </button>
          );
        })}
      </div>

      {mcp.error && <div className="text-xs text-rose-400 px-1">{mcp.error}</div>}

      <div className="text-xs text-slate-500 px-1">
        {filteredRegistry.length + filtered.length}
        {t({ ko: "개 표시중", en: " shown" })}
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
            {t({ ko: "MCP 서버 동기화 현황", en: "MCP Sync Status" })}
          </div>
          <div className="text-[11px] text-slate-500 ml-auto mr-2">
            {t({ ko: "CLI별 서버 현황", en: "Per-CLI server status" })}
          </div>
          {syncPanelOpen ? <ChevronDown width={18} height={18} className="text-slate-400" /> : <ChevronRight width={18} height={18} className="text-slate-400" />}
        </button>
        {syncPanelOpen && (
          <div className="px-4 pb-4 pt-0 border-t border-slate-700/50">
            <div className="mt-3 space-y-2">
              {Object.keys(providerSyncSummary).length > 0 ? (
                Object.entries(providerSyncSummary).map(([provider, serverNames]) => (
                  <div key={provider} className="flex items-start gap-2 rounded-lg border border-slate-700 bg-slate-800/40 px-3 py-2">
                    <span className="text-[10px] px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20 shrink-0 mt-0.5 font-medium">
                      {provider}
                    </span>
                    <div className="flex flex-wrap gap-1 flex-1 min-w-0">
                      {serverNames.map((name) => (
                        <span key={name} className="text-[10px] px-1.5 py-0.5 rounded bg-slate-700/50 text-slate-400">{name}</span>
                      ))}
                    </div>
                    <span className="text-[10px] text-emerald-400 font-medium shrink-0">{serverNames.length}</span>
                  </div>
                ))
              ) : (
                <div className="rounded-lg border border-slate-700 bg-slate-800/40 px-3 py-6 text-center text-xs text-slate-400">
                  {t({ ko: "활성화된 서버가 없습니다", en: "No active servers" })}
                </div>
              )}
              <div className="flex justify-end pt-1">
                <button
                  onClick={() => void mcp.handleSync()}
                  disabled={mcp.syncing}
                  className="px-3 py-1.5 text-xs font-medium bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 rounded-lg hover:bg-emerald-600/30 transition-all disabled:opacity-50"
                >
                  {mcp.syncResult ? (
                    <><Check width={14} height={14} className="inline-block align-middle mr-0.5" /> {t({ ko: "동기화 완료", en: "Synced" })}</>
                  ) : (
                    <><RefreshCw width={14} height={14} className={`inline-block align-middle mr-0.5 ${mcp.syncing ? "animate-spin" : ""}`} /> {t({ ko: "설정 동기화", en: "Sync Config" })}</>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* MCP Registry — like "Available Skills" */}
      <div className="rounded-xl border border-slate-700/60 bg-slate-900/50 overflow-hidden">
        <button
          type="button"
          onClick={() => setRegistryOpen((v) => !v)}
          className="w-full flex items-center gap-2 px-4 py-3 text-left hover:bg-slate-700/30 transition-colors"
          aria-expanded={registryOpen}
        >
          <Globe width={16} height={16} className="text-purple-400 shrink-0" />
          <div className="text-sm font-semibold text-slate-100">
            {t({ ko: "MCP 레지스트리", en: "MCP Registry" })}
          </div>
          {mcp.registryTotal > 0 && (
            <span className="text-xs text-slate-500">({mcp.registryTotal})</span>
          )}
          <div className="text-[11px] text-slate-500 ml-auto mr-2">
            registry.modelcontextprotocol.io
          </div>
          {registryOpen ? <ChevronDown width={18} height={18} className="text-slate-400" /> : <ChevronRight width={18} height={18} className="text-slate-400" />}
        </button>
        {registryOpen && (
          <div className="px-4 pb-4 pt-0 border-t border-slate-700/50">
            <div className="flex gap-2 mt-3 mb-3">
              <div className="flex-1 relative">
                <input
                  type="text"
                  value={registrySearchInput}
                  onChange={(e) => setRegistrySearchInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") handleRegistrySearch(); }}
                  placeholder={t({ ko: "레지스트리에서 검색...", en: "Search registry..." })}
                  className="w-full bg-slate-900/60 border border-slate-600/50 rounded-lg px-4 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-purple-500/50"
                />
                {registrySearchInput && (
                  <button
                    onClick={() => { setRegistrySearchInput(""); void mcp.loadRegistry(); }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                  >
                    &times;
                  </button>
                )}
              </div>
              <button
                onClick={handleRegistrySearch}
                disabled={mcp.registryLoading}
                className="px-3 py-2 text-xs font-medium bg-purple-600/20 text-purple-400 border border-purple-500/30 rounded-lg hover:bg-purple-600/30 transition-all disabled:opacity-50"
              >
                {mcp.registryLoading
                  ? <Loader2 width={14} height={14} className="animate-spin" />
                  : <Search width={14} height={14} />}
              </button>
            </div>

            {mcp.registryLoading && mcp.registry.length === 0 ? (
              <div className="text-center py-8">
                <Loader2 className="mx-auto mb-2 h-6 w-6 text-purple-400 animate-spin" />
                <div className="text-xs text-slate-500">{t({ ko: "레지스트리 로딩 중...", en: "Loading registry..." })}</div>
              </div>
            ) : mcp.registry.length === 0 ? (
              <div className="text-center py-8">
                <Globe className="mx-auto mb-2 h-8 w-8 text-slate-600" />
                <div className="text-xs text-slate-500">{t({ ko: "검색 결과가 없습니다", en: "No results found" })}</div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2 max-h-[480px] overflow-y-auto pr-1">
                {filteredRegistry.map((entry) => {
                  const packages = entry.packages || [];
                  const npmPkg = packages.find((p) => p.registryType === "npm");
                  const alreadyAdded = existingKeys.has(entry.name);
                  return (
                    <div key={entry.name} className="relative bg-slate-800/30 border border-slate-700/40 rounded-xl p-3 hover:bg-slate-800/50 hover:border-slate-600/50 transition-all">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="flex min-w-0 items-start gap-2">
                          {entry.iconUrl ? (
                            <img src={entry.iconUrl} alt="" className="w-7 h-7 rounded-lg shrink-0 bg-slate-900/60 p-0.5" />
                          ) : (
                            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-900/60">
                              <Plug width={14} height={14} className="text-purple-400" />
                            </div>
                          )}
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-xs font-semibold text-white">{entry.title || entry.name}</div>
                            {npmPkg && (
                              <div className="mt-0.5 truncate text-[10px] text-slate-500 font-mono">{npmPkg.identifier}</div>
                            )}
                          </div>
                        </div>
                        <button
                          onClick={() => { if (!alreadyAdded && npmPkg) setAddModalEntry(entry); }}
                          disabled={!npmPkg || alreadyAdded || mcp.submitting}
                          className="shrink-0 px-2 py-1 text-[10px] font-medium rounded-md transition-colors disabled:opacity-40 disabled:cursor-not-allowed bg-purple-600/20 text-purple-400 border border-purple-500/30 hover:bg-purple-600/30"
                          title={alreadyAdded ? t({ ko: "이미 추가됨", en: "Already added" }) : !npmPkg ? t({ ko: "npm 패키지 없음", en: "No npm package" }) : t({ ko: "추가", en: "Add" })}
                        >
                          {alreadyAdded ? <Check width={12} height={12} /> : <Download width={12} height={12} />}
                        </button>
                      </div>
                      {entry.description && (
                        <div className="text-[10px] text-slate-500 line-clamp-2 mb-2">{entry.description}</div>
                      )}
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-700/50 text-slate-400 border border-slate-600/30">
                          {t(MCP_CATEGORY_LABELS[entry._cat] || { ko: entry._cat, en: entry._cat })}
                        </span>
                        {entry.version && <span className="text-[10px] text-slate-600">v{entry.version}</span>}
                        {entry.repoUrl && (
                          <a href={entry.repoUrl} target="_blank" rel="noopener noreferrer" className="text-slate-600 hover:text-slate-400 transition-colors">
                            <ExternalLink width={10} height={10} />
                          </a>
                        )}
                        {npmPkg && (npmPkg.envVars || []).length > 0 && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-500 border border-amber-500/20">
                            {(npmPkg.envVars || []).length} env
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Server Card Grid */}
      {filtered.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {filtered.map((server) => (
            <McpServerCard
              key={server.id}
              server={server}
              agents={agents}
              t={t}
              isHovered={hoveredServer === server.id}
              onMouseEnter={() => setHoveredServer(server.id)}
              onMouseLeave={() => setHoveredServer(null)}
              onToggle={() => void mcp.handleToggle(server.id)}
              onEdit={() => mcp.setEditingServer(server)}
              onDelete={() => mcp.setDeleteConfirmId(server.id)}
              onSync={() => void mcp.handleSync()}
            />
          ))}
        </div>
      )}

      <div className="text-center text-xs text-slate-600 py-4">
        {t({
          ko: "MCP 서버를 등록하고 '동기화'를 누르면 CLI별 설정 파일에 자동 반영됩니다",
          en: "Register MCP servers and click 'Sync' to auto-write CLI config files",
        })}
      </div>

      {/* Modals */}
      {addModalEntry && (
        <McpAddModal
          entry={addModalEntry}
          agents={agents}
          submitting={mcp.submitting}
          t={t}
          onClose={() => setAddModalEntry(null)}
          onAdd={(entry, providers) => {
            void mcp.handleAddFromRegistry(entry, providers).then(() => setAddModalEntry(null));
          }}
        />
      )}

      {(mcp.isCreateOpen || mcp.editingServer) && (
        <McpServerEditModal
          server={mcp.editingServer}
          submitting={mcp.submitting}
          t={t}
          onClose={() => { mcp.setIsCreateOpen(false); mcp.setEditingServer(null); }}
          onSave={(data) => {
            if (mcp.editingServer) void mcp.handleUpdate(mcp.editingServer.id, data);
            else void mcp.handleCreate(data as Parameters<typeof mcp.handleCreate>[0]);
          }}
        />
      )}

      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="w-80 rounded-2xl border border-slate-700 bg-slate-800 p-6">
            <h4 className="text-sm font-bold text-white mb-2">{t({ ko: "MCP 서버 삭제", en: "Delete MCP Server" })}</h4>
            <p className="text-xs text-slate-400 mb-4">{deleteTarget.name} ({deleteTarget.server_key})</p>
            <div className="flex justify-end gap-2">
              <button onClick={() => mcp.setDeleteConfirmId(null)} className="px-3 py-1.5 text-sm text-slate-400">{t({ ko: "취소", en: "Cancel" })}</button>
              <button
                onClick={() => void mcp.handleDelete(deleteTarget.id)}
                disabled={mcp.submitting}
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
