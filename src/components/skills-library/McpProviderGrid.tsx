import type { Agent } from "../../types";
import type { TFunction } from "./skillsLibraryHelpers";
import { pickRepresentativeForProvider } from "./skillsLibraryHelpers";
import AgentAvatar from "../AgentAvatar";
import { configProviderIcon } from "./SkillsLibraryProviderLogos";

export const MCP_PROVIDER_OPTIONS = ["claude", "codex", "gemini", "opencode"];
export const MCP_PROVIDER_LABEL: Record<string, string> = {
  claude: "Claude Code",
  codex: "Codex CLI",
  gemini: "Gemini CLI",
  opencode: "OpenCode",
};

interface McpProviderGridProps {
  agents: Agent[];
  providers: string[];
  t: TFunction;
  onToggle: (provider: string) => void;
}

export default function McpProviderGrid({ agents, providers, t, onToggle }: McpProviderGridProps) {
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <label className="text-xs text-slate-400">
          {t({ ko: "적용할 CLI 프로바이더 (복수 선택)", en: "CLI Providers (multi-select)" })}
        </label>
        <span className="text-[11px] text-slate-500">
          {providers.length}
          {t({ ko: "개 선택됨", en: " selected" })}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {MCP_PROVIDER_OPTIONS.map((p) => {
          const agent = pickRepresentativeForProvider(agents, p as Agent["cli_provider"]);
          const isSelected = providers.includes(p);
          const hasAgent = !!agent;
          return (
            <div
              key={p}
              role="button"
              tabIndex={0}
              onClick={() => onToggle(p)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onToggle(p);
                }
              }}
              className={`relative overflow-hidden rounded-xl border p-2.5 text-left transition-all cursor-pointer ${
                isSelected
                  ? "border-emerald-500/50 bg-emerald-500/10"
                  : "border-slate-700/70 bg-slate-800/60 hover:border-slate-500/80 hover:bg-slate-800/80"
              }`}
            >
              <div className="flex items-center gap-2.5">
                <AgentAvatar agent={agent ?? undefined} agents={agents} size={40} rounded="xl" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1 text-[10px] text-slate-400">
                    <span className="flex h-3 w-3 items-center justify-center">{configProviderIcon(p)}</span>
                    {MCP_PROVIDER_LABEL[p] || p}
                  </div>
                  <div className="text-xs font-medium text-white truncate">
                    {hasAgent ? agent.name : t({ ko: "배치된 인원 없음", en: "No member" })}
                  </div>
                </div>
                <div
                  className={`text-[10px] px-1.5 py-0.5 rounded-full border shrink-0 ${
                    isSelected
                      ? "border-emerald-400/50 text-emerald-300 bg-emerald-500/15"
                      : "border-slate-600 text-slate-400 bg-slate-700/40"
                  }`}
                >
                  {isSelected ? t({ ko: "선택", en: "On" }) : t({ ko: "대기", en: "Off" })}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
