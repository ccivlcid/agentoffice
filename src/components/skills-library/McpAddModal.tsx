import { useState } from "react";
import { X, Plug, Terminal } from "lucide-react";
import type { McpRegistryEntry } from "../../api";
import type { Agent } from "../../types";
import type { TFunction } from "./skillsLibraryHelpers";
import { pickRepresentativeForProvider } from "./skillsLibraryHelpers";
import AgentAvatar from "../AgentAvatar";
import { configProviderIcon } from "./SkillsLibraryProviderLogos";
import { inferMcpCategory } from "./McpServerList";

const PROVIDER_OPTIONS = ["claude", "cursor", "gemini", "opencode"] as const;
const PROVIDER_LABEL: Record<string, string> = {
  claude: "Claude Code",
  cursor: "Cursor",
  gemini: "Gemini CLI",
  opencode: "OpenCode",
};

const MCP_CATEGORY_LABEL: Record<string, { ko: string; en: string }> = {
  filesystem: { ko: "파일시스템", en: "Filesystem" },
  database: { ko: "데이터베이스", en: "Database" },
  api: { ko: "API", en: "API" },
  "dev-tools": { ko: "개발도구", en: "Dev Tools" },
  other: { ko: "기타", en: "Other" },
};

interface McpAddModalProps {
  entry: McpRegistryEntry;
  agents: Agent[];
  submitting: boolean;
  t: TFunction;
  onClose: () => void;
  onAdd: (entry: McpRegistryEntry, providers: string[]) => void;
}

export default function McpAddModal({ entry, agents, submitting, t, onClose, onAdd }: McpAddModalProps) {
  const [selectedProviders, setSelectedProviders] = useState<string[]>(["claude", "cursor"]);

  const packages = entry.packages || [];
  const npmPkg = packages.find((p) => p.registryType === "npm");
  const envVars = npmPkg?.envVars || [];
  const category = inferMcpCategory(entry);
  const cmdPreview = npmPkg ? `npx -y ${npmPkg.identifier}` : "";

  const toggleProvider = (p: string) => {
    setSelectedProviders((prev) =>
      prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p],
    );
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/75 backdrop-blur-sm p-4">
      <div className="w-full max-w-3xl max-h-[90vh] overflow-hidden rounded-2xl border border-slate-700/60 bg-slate-900/95 shadow-2xl">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 border-b border-slate-700/60 px-5 py-4">
          <div className="flex items-start gap-3">
            {entry.iconUrl ? (
              <img src={entry.iconUrl} alt="" className="w-10 h-10 rounded-xl bg-slate-800 p-0.5 shrink-0" />
            ) : (
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-800">
                <Plug width={20} height={20} className="text-purple-400" />
              </div>
            )}
            <div>
              <h3 className="text-base font-semibold text-white">
                {t({ ko: "MCP 서버 추가", en: "Add MCP Server" })}
              </h3>
              <div className="mt-0.5 text-xs text-slate-400">
                {entry.title || entry.name}
                <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-slate-700/50 text-slate-500 border border-slate-600/30">
                  {t(MCP_CATEGORY_LABEL[category] || { ko: category, en: category })}
                </span>
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={submitting}
            className="rounded-lg border border-slate-600 px-2.5 py-1 text-xs text-slate-300 hover:bg-slate-800 transition-all"
          >
            {t({ ko: "닫기", en: "Close" })}
          </button>
        </div>

        <div className="space-y-4 overflow-y-auto px-5 py-4 max-h-[calc(90vh-72px)]">
          {/* Description */}
          {entry.description && (
            <p className="text-sm text-slate-300 leading-relaxed">{entry.description}</p>
          )}

          {/* Command preview */}
          {cmdPreview && (
            <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/8 px-3 py-2">
              <div className="text-[11px] text-emerald-200">
                {t({ ko: "실행 명령", en: "Install command" })}
              </div>
              <div className="mt-1 text-[11px] font-mono text-emerald-300 break-all flex items-center gap-1.5">
                <Terminal width={12} height={12} className="shrink-0" />
                {cmdPreview}
              </div>
            </div>
          )}

          {/* Env vars */}
          {envVars.length > 0 && (
            <div className="rounded-xl border border-amber-500/25 bg-amber-500/8 px-3 py-2">
              <div className="text-[11px] text-amber-200 mb-1.5">
                {t({ ko: "필요한 환경변수", en: "Required Environment Variables" })}
              </div>
              <div className="space-y-1">
                {envVars.map((ev) => (
                  <div key={ev.name} className="flex items-start gap-2 text-[11px]">
                    <span className="font-mono text-amber-300 shrink-0">{ev.name}</span>
                    {ev.description && <span className="text-amber-200/60">{ev.description}</span>}
                    {ev.isSecret && (
                      <span className="text-[9px] px-1 py-0.5 rounded bg-rose-500/15 text-rose-400 border border-rose-500/20 shrink-0">secret</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Provider selection — same style as SkillLearnModal */}
          <div className="flex items-center justify-between gap-3">
            <div className="text-xs text-slate-400">
              {t({ ko: "적용할 CLI 프로바이더를 선택하세요 (복수 선택 가능)", en: "Select CLI providers to apply (multi-select)" })}
            </div>
            <div className="text-[11px] text-slate-500">
              {selectedProviders.length}{t({ ko: "개 선택됨", en: " selected" })}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {PROVIDER_OPTIONS.map((provider) => {
              const agent = pickRepresentativeForProvider(agents, provider as Agent["cli_provider"]);
              const isSelected = selectedProviders.includes(provider);
              const hasAgent = !!agent;
              return (
                <div
                  key={provider}
                  role="button"
                  tabIndex={0}
                  onClick={() => toggleProvider(provider)}
                  onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggleProvider(provider); } }}
                  className={`relative overflow-hidden rounded-xl border p-3 text-left transition-all cursor-pointer ${
                    isSelected
                      ? "border-emerald-500/50 bg-emerald-500/10"
                      : "border-slate-700/70 bg-slate-800/60 hover:border-slate-500/80 hover:bg-slate-800/80"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <AgentAvatar agent={agent ?? undefined} agents={agents} size={50} rounded="xl" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                        <span className="flex h-3 w-3 items-center justify-center">
                          {configProviderIcon(provider)}
                        </span>
                        {PROVIDER_LABEL[provider] || provider}
                      </div>
                      <div className="text-sm font-medium text-white truncate">
                        {hasAgent ? agent.name : t({ ko: "배치된 인원 없음", en: "No assigned member" })}
                      </div>
                      <div className="text-[11px] text-slate-500">
                        {hasAgent ? agent.role : t({ ko: "사용 불가", en: "Unavailable" })}
                      </div>
                    </div>
                    <div
                      className={`text-[11px] px-2 py-0.5 rounded-full border ${
                        isSelected
                          ? "border-emerald-400/50 text-emerald-300 bg-emerald-500/15"
                          : "border-slate-600 text-slate-400 bg-slate-700/40"
                      }`}
                    >
                      {isSelected
                        ? t({ ko: "선택됨", en: "Selected" })
                        : t({ ko: "대기", en: "Idle" })}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Info */}
          <div className="flex flex-wrap gap-3 text-[11px] text-slate-500">
            {entry.version && <span>v{entry.version}</span>}
            {npmPkg && <span className="font-mono">{npmPkg.identifier}</span>}
            {entry.repoUrl && (
              <a href={entry.repoUrl} target="_blank" rel="noopener noreferrer" className="text-purple-400 hover:text-purple-300">
                {t({ ko: "저장소", en: "Repository" })}
              </a>
            )}
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2">
            <button
              onClick={onClose}
              disabled={submitting}
              className="px-3 py-1.5 rounded-lg text-xs border border-slate-600 text-slate-300 hover:bg-slate-800 transition-all"
            >
              {t({ ko: "취소", en: "Cancel" })}
            </button>
            <button
              onClick={() => onAdd(entry, selectedProviders)}
              disabled={selectedProviders.length === 0 || submitting || !npmPkg}
              className={`px-3 py-1.5 rounded-lg text-xs border transition-all ${
                selectedProviders.length === 0 || !npmPkg
                  ? "cursor-not-allowed border-slate-700 text-slate-600"
                  : "border-emerald-500/50 bg-emerald-500/20 text-emerald-200 hover:bg-emerald-500/30"
              }`}
            >
              {submitting
                ? t({ ko: "추가 중...", en: "Adding..." })
                : t({ ko: "서버 추가", en: "Add Server" })}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
