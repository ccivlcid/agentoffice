import type { McpServer } from "../../api";
import type { Agent } from "../../types";
import AgentAvatar from "../AgentAvatar";
import { Pencil, Trash2, Server } from "lucide-react";
import type { TFunction } from "./skillsLibraryHelpers";
import { pickRepresentativeForProvider } from "./skillsLibraryHelpers";
import { configProviderIcon } from "./SkillsLibraryProviderLogos";
import { MCP_CATEGORY_ICONS } from "../../constants/icons";

const CATEGORY_COLORS: Record<string, string> = {
  filesystem: "text-emerald-400 bg-emerald-500/15 border-emerald-500/30",
  database: "text-blue-400 bg-blue-500/15 border-blue-500/30",
  api: "text-purple-400 bg-purple-500/15 border-purple-500/30",
  "dev-tools": "text-amber-400 bg-amber-500/15 border-amber-500/30",
  registry: "text-cyan-400 bg-cyan-500/15 border-cyan-500/30",
  other: "text-slate-400 bg-slate-500/15 border-slate-500/30",
};

const MCP_PROVIDER_LABEL: Record<string, string> = {
  claude: "Claude Code",
  cursor: "Cursor",
  gemini: "Gemini CLI",
  codex: "Codex CLI",
  opencode: "OpenCode",
};

const MCP_CATEGORY_LABEL: Record<string, { ko: string; en: string }> = {
  filesystem: { ko: "파일시스템", en: "Filesystem" },
  database: { ko: "데이터베이스", en: "Database" },
  api: { ko: "API", en: "API" },
  "dev-tools": { ko: "개발도구", en: "Dev Tools" },
  registry: { ko: "레지스트리", en: "Registry" },
  other: { ko: "기타", en: "Other" },
};

interface McpServerCardProps {
  server: McpServer;
  agents: Agent[];
  t: TFunction;
  isHovered: boolean;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onSync: () => void;
}

export default function McpServerCard({
  server, agents, t, isHovered,
  onMouseEnter, onMouseLeave, onToggle, onEdit, onDelete, onSync,
}: McpServerCardProps) {
  const providers: string[] = (() => { try { return JSON.parse(server.providers); } catch { return []; } })();
  const args: string[] = (() => { try { return JSON.parse(server.args); } catch { return []; } })();
  const env: Record<string, string> = (() => { try { const o = JSON.parse(server.env); return typeof o === "object" && o !== null ? o : {}; } catch { return {}; } })();
  const catColor = CATEGORY_COLORS[server.category] ?? CATEGORY_COLORS.other;
  const providersForCard = providers.slice(0, 4);
  const cmdPreview = [server.command, ...args].join(" ");

  return (
    <div
      className={`relative bg-slate-800/50 border border-slate-700/40 rounded-xl p-4 hover:bg-slate-800/70 hover:border-slate-600/50 transition-all group ${
        !server.enabled ? "opacity-60" : ""
      }`}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      {/* Badge row: toggle + status + edit/delete */}
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={onToggle}
            className={`shrink-0 w-10 h-5 rounded-full transition-colors relative ${
              server.enabled ? "bg-emerald-500" : "bg-slate-600"
            }`}
            title={server.enabled ? t({ ko: "비활성화", en: "Disable" }) : t({ ko: "활성화", en: "Enable" })}
          >
            <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${
              server.enabled ? "left-[22px]" : "left-0.5"
            }`} />
          </button>
          <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
            server.enabled
              ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
              : "bg-slate-500/15 text-slate-400 border border-slate-500/30"
          }`}>
            {server.enabled ? t({ ko: "활성", en: "Active" }) : t({ ko: "비활성", en: "Inactive" })}
          </span>
        </div>
        <div className="flex gap-1">
          <button
            onClick={onEdit}
            className="px-1.5 py-0.5 text-[10px] rounded border border-slate-600/50 text-slate-400 hover:text-blue-300 hover:border-blue-500/40 transition-all"
            title={t({ ko: "편집", en: "Edit" })}
          >
            <Pencil width={12} height={12} className="inline-block" />
          </button>
          <button
            onClick={onDelete}
            className="px-1.5 py-0.5 text-[10px] rounded border border-slate-600/50 text-slate-400 hover:text-rose-300 hover:border-rose-500/40 transition-all"
            title={t({ ko: "삭제", en: "Delete" })}
          >
            <Trash2 width={12} height={12} className="inline-block" />
          </button>
        </div>
      </div>

      {/* Top row: icon + name + providers grid */}
      <div className="mb-3 flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-start gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-900/60">
            <Server width={16} height={16} className="text-purple-400" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-semibold text-white">{server.name}</div>
            <div className="mt-0.5 truncate text-xs text-slate-500 font-mono">
              {server.package || server.server_key}
            </div>
          </div>
        </div>
        {providersForCard.length > 0 && (
          <div className="grid w-[64px] shrink-0 grid-cols-2 gap-1 rounded-lg border border-emerald-500/25 bg-emerald-500/5 p-1">
            {providersForCard.map((provider) => {
              const agent = pickRepresentativeForProvider(agents, provider as Agent["cli_provider"]);
              return (
                <span
                  key={`${server.id}-${provider}`}
                  className="inline-flex h-5 w-6 items-center justify-center gap-0.5 rounded-md border border-emerald-500/20 bg-slate-900/70"
                  title={`${MCP_PROVIDER_LABEL[provider] || provider}${agent ? ` · ${agent.name}` : ""}`}
                >
                  <span className="flex h-2.5 w-2.5 items-center justify-center">
                    {configProviderIcon(provider)}
                  </span>
                  <span className="h-2.5 w-2.5 overflow-hidden rounded-[3px] bg-slate-800/80">
                    <AgentAvatar
                      agent={agent ?? undefined}
                      agents={agents}
                      size={10}
                      rounded="xl"
                    />
                  </span>
                </span>
              );
            })}
          </div>
        )}
      </div>

      {/* Bottom row: category + command + sync/edit */}
      <div className="flex items-center justify-between gap-2">
        <span className={`text-[10px] px-2 py-0.5 rounded-full border inline-flex items-center gap-1 ${catColor}`}>
          {(() => {
            const CatIcon = MCP_CATEGORY_ICONS[server.category];
            return CatIcon ? <CatIcon width={12} height={12} className="shrink-0" /> : null;
          })()}
          {t(MCP_CATEGORY_LABEL[server.category] || { ko: server.category, en: server.category })}
        </span>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-[10px] text-slate-500 font-mono truncate max-w-[80px]" title={cmdPreview}>
            $ {server.command}
          </span>
          <div className="flex flex-col gap-1">
            <button
              onClick={onSync}
              className="px-2 py-1 text-[10px] bg-emerald-600/20 text-emerald-300 border border-emerald-500/30 rounded-md hover:bg-emerald-600/30 transition-all"
              title={t({ ko: "설정 파일에 동기화", en: "Sync to config files" })}
            >
              {t({ ko: "동기화", en: "Sync" })}
            </button>
            <button
              onClick={onEdit}
              className="px-2 py-1 text-[10px] bg-blue-600/20 text-blue-400 border border-blue-500/30 rounded-md hover:bg-blue-600/30 transition-all"
              title={t({ ko: "서버 편집", en: "Edit server" })}
            >
              {t({ ko: "편집", en: "Edit" })}
            </button>
          </div>
        </div>
      </div>

      {/* Hover Detail Tooltip */}
      {isHovered && (
        <div
          className="absolute z-50 left-0 right-0 top-full mt-2 bg-slate-900/95 backdrop-blur-md border border-slate-600/60 rounded-xl p-4 shadow-2xl shadow-black/40 animate-in fade-in slide-in-from-top-1 duration-200"
          onMouseEnter={onMouseEnter}
          onMouseLeave={onMouseLeave}
        >
          <div className="space-y-3">
            <div className="text-sm font-semibold text-white">{server.name}</div>
            {server.description && (
              <p className="text-xs text-slate-300 leading-relaxed">{server.description}</p>
            )}
            <div className="text-[10px] text-slate-500 font-mono bg-slate-800/60 rounded-md px-2 py-1.5 truncate">
              $ {cmdPreview}
            </div>
            {Object.keys(env).length > 0 && (
              <div>
                <div className="text-[10px] text-slate-500 mb-1.5 uppercase tracking-wider">
                  {t({ ko: "환경변수", en: "Environment" })}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {Object.keys(env).map((key) => (
                    <span key={key} className="text-[10px] px-2 py-0.5 bg-slate-800/80 border border-slate-700/50 rounded-md text-slate-400 font-mono">
                      {key}
                    </span>
                  ))}
                </div>
              </div>
            )}
            <div className="flex flex-wrap gap-3 text-[11px]">
              <span className="text-slate-500">
                {t({ ko: "서버 키", en: "Server Key" })}: <span className="text-slate-400 font-mono">{server.server_key}</span>
              </span>
              <span className="text-slate-500">
                {t({ ko: "출처", en: "Source" })}: <span className="text-slate-400">{server.source}</span>
              </span>
            </div>
            {providers.length > 0 && (
              <div>
                <div className="text-[10px] text-slate-500 mb-1.5 uppercase tracking-wider">
                  {t({ ko: "적용 프로바이더", en: "Target Providers" })}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {providers.map((p) => (
                    <span key={p} className="text-[10px] px-2 py-0.5 bg-slate-800/80 border border-slate-700/50 rounded-md text-slate-400">
                      {MCP_PROVIDER_LABEL[p] || p}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
